import {createPublicClient, type Hex, http, parseAbiItem, type PublicClient,} from "viem";
import {mapLimit} from "async";
import {ChainConfig, DepositEvent, RagequitEvent, WithdrawalEvent,} from "../types/events.js";
import {PoolInfo} from "../types/account.js";
import {Hash} from "../types/commitment.js";
import {BlockRange, ChainLogFetchConfig, DEFAULT_LOG_FETCH_CONFIG, LogFetchConfig,} from "../types/rateLimit.js";
import {Logger, LogLevel} from "../utils/logger.js";
import {DataError} from "../errors/data.error.js";
import {ErrorCode} from "../errors/base.error.js";

/**
 * How many times a refused block range may be halved before we give up.
 *
 * 8 takes a 1,500,000 block chunk (what a hypersync-backed deployment
 * configures) down to under 6,000, which is below every documented provider
 * cap, and a 10,000 block default down to 39. Past that the endpoint is not
 * rate limiting us, it is broken, and splitting further only multiplies the
 * requests we make while it is already refusing them.
 */
const MAX_RANGE_SPLIT_DEPTH = 8;

// Event signatures from the contract
const DEPOSIT_EVENT = parseAbiItem('event Deposited(address indexed _depositor, uint256 _commitment, uint256 _label, uint256 _value, uint256 _merkleRoot)');
const WITHDRAWAL_EVENT = parseAbiItem('event Withdrawn(address indexed _processooor, uint256 _value, uint256 _spentNullifier, uint256 _newCommitment)');
const RAGEQUIT_EVENT = parseAbiItem('event Ragequit(address indexed _ragequitter, uint256 _commitment, uint256 _label, uint256 _value)');

/**
 * Service responsible for fetching and managing privacy pool events across multiple chains.
 * Handles event retrieval, parsing, and validation for deposits, withdrawals, and ragequits.
 *
 * @remarks
 * This service uses viem's PublicClient to efficiently fetch and process blockchain events.
 * It supports multiple chains and provides robust error handling and validation.
 * All uint256 values from events are handled as bigints, with Hash type assertions for commitment-related fields.
 */
export class DataService {
  private readonly clients: Map<number, PublicClient> = new Map();
  private readonly logger: Logger;
  private readonly logFetchConfigs: Map<number, LogFetchConfig>;

  /**
   * Initialize the data service with chain configurations
   *
   * @param chainConfigs - Array of chain configurations containing chainId, RPC URL, and API key
   * @param logFetchConfig - Per-chain configuration for rate-limited log fetching as a Map<chainId, config>.
   *                         Each chain can have its own specific settings (e.g., different block chunk sizes).
   * @throws {DataError} If client initialization fails for any chain
   */
  constructor(
    private readonly chainConfigs: ChainConfig[],
    logFetchConfig: ChainLogFetchConfig = new Map()
  ) {
    this.logger = new Logger({ prefix: "Data", level: LogLevel.DEBUG });

    // Initialize per-chain configs with defaults merged with chain-specific overrides
    this.logFetchConfigs = new Map();
    for (const config of chainConfigs) {
      const chainSpecificConfig = logFetchConfig.get(config.chainId);
      this.logFetchConfigs.set(
        config.chainId,
        { ...DEFAULT_LOG_FETCH_CONFIG, ...chainSpecificConfig }
      );
    }

    try {
      for (const config of chainConfigs) {
        if (!config.rpcUrl) {
          throw new Error(`Missing RPC URL for chain ${config.chainId}`);
        }

        const client = createPublicClient({
          transport: http(config.rpcUrl),
        });
        this.clients.set(config.chainId, client);
      }
    } catch (error) {
      throw new DataError(
        "Failed to initialize PublicClient",
        ErrorCode.NETWORK_ERROR,
        { error: error instanceof Error ? error.message : "Unknown error" },
      );
    }
  }

  /**
   * Get deposit events for a specific chain
   *
   * @param pool - Pool info containing chainId, address, and deployment block
   * @returns Array of deposit events with properly typed fields (bigint for numbers, Hash for commitments)
   * @throws {DataError} If client is not configured, network error occurs, or event data is invalid
   */
  async getDeposits(pool: PoolInfo): Promise<DepositEvent[]> {
    try {
      const client = this.getClientForChain(pool.chainId);
      const chainConfig = this.getConfigForChain(pool.chainId);
      const logConfig = this.getLogFetchConfigForChain(pool.chainId);

      const fromBlock = pool.deploymentBlock ?? chainConfig.startBlock;
      const toBlock = await this.getCurrentBlock(pool.chainId);
      const ranges = this.generateBlockRanges(
        fromBlock,
        toBlock,
        logConfig.blockChunkSize
      );

      this.logger.info(
        `Fetching deposits in ${ranges.length} chunks for pool ${pool.address}, chunk size is: ${logConfig.blockChunkSize}`
      );

      // Use async.mapLimit for controlled concurrency
      const allLogs = await mapLimit<BlockRange, unknown[]>(
        ranges,
        logConfig.concurrency,
        async (range: BlockRange) => {
          if (logConfig.chunkDelayMs > 0) {
            await this.sleep(logConfig.chunkDelayMs);
          }
          return this.fetchLogsWithRetry(
            client,
            pool.address,
            DEPOSIT_EVENT,
            range,
            logConfig
          );
        }
      );

      // Flatten and parse results
      const flatLogs = allLogs.flat();

      return flatLogs.map((log: unknown) => {
        try {
          const typedLog = log as {
            args?: {
              _depositor?: string;
              _commitment?: bigint;
              _label?: bigint;
              _value?: bigint;
              _merkleRoot?: bigint;
            };
            blockNumber?: bigint;
            transactionHash?: Hex;
          };

          if (!typedLog.args) {
            throw DataError.invalidLog("deposit", "missing args");
          }

          const {
            _depositor: depositor,
            _commitment: commitment,
            _label: label,
            _value: value,
            _merkleRoot: precommitment,
          } = typedLog.args;

          if (
            !depositor ||
            !commitment ||
            !label ||
            !precommitment ||
            !typedLog.blockNumber ||
            !typedLog.transactionHash
          ) {
            throw DataError.invalidLog("deposit", "missing required fields");
          }

          return {
            depositor: depositor.toLowerCase(),
            commitment: commitment as Hash,
            label: label as Hash,
            value: value ?? BigInt(0),
            precommitment: precommitment as Hash,
            blockNumber: BigInt(typedLog.blockNumber),
            transactionHash: typedLog.transactionHash,
          };
        } catch (error) {
          if (error instanceof DataError) throw error;
          throw DataError.invalidLog(
            "deposit",
            error instanceof Error ? error.message : "Unknown error"
          );
        }
      });
    } catch (error) {
      if (error instanceof DataError) throw error;
      throw DataError.networkError(
        pool.chainId,
        error instanceof Error ? error : new Error(String(error))
      );
    }
  }

  /**
   * Get withdrawal events for a specific chain
   *
   * @param pool - Pool info containing chainId, address, and deployment block
   * @param fromBlock - Optional starting block (defaults to pool deployment block)
   * @returns Array of withdrawal events with properly typed fields (bigint for numbers, Hash for commitments)
   * @throws {DataError} If client is not configured, network error occurs, or event data is invalid
   */
  async getWithdrawals(
    pool: PoolInfo,
    fromBlock: bigint = pool.deploymentBlock
  ): Promise<WithdrawalEvent[]> {
    try {
      const client = this.getClientForChain(pool.chainId);
      const chainConfig = this.getConfigForChain(pool.chainId);
      const logConfig = this.getLogFetchConfigForChain(pool.chainId);

      const startBlock = fromBlock ?? chainConfig.startBlock;
      const toBlock = await this.getCurrentBlock(pool.chainId);
      const ranges = this.generateBlockRanges(
        startBlock,
        toBlock,
        logConfig.blockChunkSize
      );

      this.logger.debug(
        `Fetching withdrawals in ${ranges.length} chunks for pool ${pool.address}`
      );

      // Use async.mapLimit for controlled concurrency
      const allLogs = await mapLimit<BlockRange, unknown[]>(
        ranges,
        logConfig.concurrency,
        async (range: BlockRange) => {
          if (logConfig.chunkDelayMs > 0) {
            await this.sleep(logConfig.chunkDelayMs);
          }
          return this.fetchLogsWithRetry(
            client,
            pool.address,
            WITHDRAWAL_EVENT,
            range,
            logConfig
          );
        }
      );

      // Flatten and parse results
      const flatLogs = allLogs.flat();

      return flatLogs.map((log: unknown) => {
        try {
          const typedLog = log as {
            args?: {
              _value?: bigint;
              _spentNullifier?: bigint;
              _newCommitment?: bigint;
            };
            blockNumber?: bigint;
            transactionHash?: Hex;
          };

          if (!typedLog.args) {
            throw DataError.invalidLog("withdrawal", "missing args");
          }

          const {
            _value: value,
            _spentNullifier: spentNullifier,
            _newCommitment: newCommitment,
          } = typedLog.args;

          if (value == null || !spentNullifier || !newCommitment || !typedLog.blockNumber || !typedLog.transactionHash) {
            throw DataError.invalidLog("withdrawal", "missing required fields");
          }

          return {
            withdrawn: value,
            spentNullifier: spentNullifier as Hash,
            newCommitment: newCommitment as Hash,
            blockNumber: BigInt(typedLog.blockNumber),
            transactionHash: typedLog.transactionHash,
          };
        } catch (error) {
          if (error instanceof DataError) throw error;
          throw DataError.invalidLog(
            "withdrawal",
            error instanceof Error ? error.message : "Unknown error"
          );
        }
      });
    } catch (error) {
      if (error instanceof DataError) throw error;
      throw DataError.networkError(
        pool.chainId,
        error instanceof Error ? error : new Error(String(error))
      );
    }
  }

  /**
   * Get ragequit events for a specific chain
   *
   * @param pool - Pool info containing chainId, address, and deployment block
   * @param fromBlock - Optional starting block (defaults to pool deployment block)
   * @returns Array of ragequit events with properly typed fields (bigint for numbers, Hash for commitments)
   * @throws {DataError} If client is not configured, network error occurs, or event data is invalid
   */
  async getRagequits(
    pool: PoolInfo,
    fromBlock: bigint = pool.deploymentBlock
  ): Promise<RagequitEvent[]> {
    try {
      const client = this.getClientForChain(pool.chainId);
      const chainConfig = this.getConfigForChain(pool.chainId);
      const logConfig = this.getLogFetchConfigForChain(pool.chainId);

      const startBlock = fromBlock ?? chainConfig.startBlock;
      const toBlock = await this.getCurrentBlock(pool.chainId);
      const ranges = this.generateBlockRanges(
        startBlock,
        toBlock,
        logConfig.blockChunkSize
      );

      this.logger.debug(
        `Fetching ragequits in ${ranges.length} chunks for pool ${pool.address}`
      );

      // Use async.mapLimit for controlled concurrency
      const allLogs = await mapLimit<BlockRange, unknown[]>(
        ranges,
        logConfig.concurrency,
        async (range: BlockRange) => {
          if (logConfig.chunkDelayMs > 0) {
            await this.sleep(logConfig.chunkDelayMs);
          }
          return this.fetchLogsWithRetry(
            client,
            pool.address,
            RAGEQUIT_EVENT,
            range,
            logConfig
          );
        }
      );

      // Flatten and parse results
      const flatLogs = allLogs.flat();

      return flatLogs.map((log: unknown) => {
        try {
          const typedLog = log as {
            args?: {
              _ragequitter?: string;
              _commitment?: bigint;
              _label?: bigint;
              _value?: bigint;
            };
            blockNumber?: bigint;
            transactionHash?: Hex;
          };

          if (!typedLog.args) {
            throw DataError.invalidLog("ragequit", "missing args");
          }

          const {
            _ragequitter: ragequitter,
            _commitment: commitment,
            _label: label,
            _value: value,
          } = typedLog.args;

          if (
            !ragequitter ||
            !commitment ||
            !label ||
            !typedLog.blockNumber ||
            !typedLog.transactionHash
          ) {
            throw DataError.invalidLog("ragequit", "missing required fields");
          }

          return {
            ragequitter: ragequitter.toLowerCase(),
            commitment: commitment as Hash,
            label: label as Hash,
            value: value ?? BigInt(0),
            blockNumber: BigInt(typedLog.blockNumber),
            transactionHash: typedLog.transactionHash,
          };
        } catch (error) {
          if (error instanceof DataError) throw error;
          throw DataError.invalidLog(
            "ragequit",
            error instanceof Error ? error.message : "Unknown error"
          );
        }
      });
    } catch (error) {
      if (error instanceof DataError) throw error;
      throw DataError.networkError(
        pool.chainId,
        error instanceof Error ? error : new Error(String(error))
      );
    }
  }

  /**
   * Gets the current block number for a chain
   */
  private async getCurrentBlock(chainId: number): Promise<bigint> {
    const client = this.getClientForChain(chainId);
    return client.getBlockNumber();
  }

  /**
   * Generates block ranges for chunked fetching
   */
  private generateBlockRanges(
    fromBlock: bigint,
    toBlock: bigint,
    chunkSize: number
  ): BlockRange[] {
    const ranges: BlockRange[] = [];
    let current = fromBlock;

    while (current <= toBlock) {
      const end = current + BigInt(chunkSize) - 1n;
      ranges.push({
        fromBlock: current,
        toBlock: end > toBlock ? toBlock : end,
      });
      current = end + 1n;
    }

    return ranges;
  }

  /**
   * Fetches logs for a single block range with retry logic
   */
  private async fetchLogsWithRetry<T>(
    client: PublicClient,
    address: string,
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    event: any,
    range: BlockRange,
    logConfig: LogFetchConfig,
    splitDepth = 0
  ): Promise<T[]> {
    const maxRetries = logConfig.retryOnFailure
      ? logConfig.maxRetries
      : 0;
    let lastError: Error | undefined;

    for (let attempt = 0; attempt <= maxRetries; attempt++) {
      try {
        const logs = await client.getLogs({
          address: address as `0x${string}`,
          event,
          fromBlock: range.fromBlock,
          toBlock: range.toBlock,
        });
        return logs as T[];
      } catch (error) {
        lastError = error instanceof Error ? error : new Error(String(error));

        if (attempt < maxRetries) {
          const delay =
            logConfig.retryBaseDelayMs * Math.pow(2, attempt);
          this.logger.warn(
            `Log fetch failed, retrying in ${delay}ms (attempt ${attempt + 1}/${maxRetries})`,
            { error: lastError.message, range }
          );
          await this.sleep(delay);
        }
      }
    }

    // Retrying was never going to help for these two.
    //
    // A 429 means the endpoint is asking us to slow down, and re-sending the
    // identical request at the identical size is not slowing down. A
    // range-too-large means this request will NEVER succeed, however many
    // times it is repeated, because the endpoint caps the span.
    //
    // So adapt instead: halve the range and fetch both halves in sequence.
    // Sequential matters - the point is to be gentler, and firing the two
    // halves together would keep the same instantaneous rate that earned the
    // 429. Halving repeats as needed, so a caller configured for a hypersync
    // proxy (some deployments use chunks in the millions) converges on
    // whatever the endpoint will actually serve rather than failing the whole
    // scan. A failed scan is not a log line to the user: it is an account
    // that loads with no pools and no balances.
    const span = range.toBlock - range.fromBlock;
    if (
      this.shouldNarrowRange(lastError) &&
      splitDepth < MAX_RANGE_SPLIT_DEPTH &&
      span > 0n
    ) {
      const midpoint = range.fromBlock + span / 2n;
      this.logger.warn(
        `Log fetch failed on a ${span + 1n} block range; halving and retrying`,
        { error: lastError?.message, range, splitDepth }
      );
      const first = await this.fetchLogsWithRetry<T>(
        client,
        address,
        event,
        { fromBlock: range.fromBlock, toBlock: midpoint },
        logConfig,
        splitDepth + 1
      );
      if (logConfig.chunkDelayMs > 0) {
        await this.sleep(logConfig.chunkDelayMs);
      }
      const second = await this.fetchLogsWithRetry<T>(
        client,
        address,
        event,
        { fromBlock: midpoint + 1n, toBlock: range.toBlock },
        logConfig,
        splitDepth + 1
      );
      return [...first, ...second];
    }

    throw lastError;
  }

  /**
   * Is this the kind of failure a smaller range fixes?
   *
   * Matched on the message because that is all a JSON-RPC error reliably
   * gives us: providers disagree on codes and shapes, but every one of them
   * says something recognisable in the text. Deliberately narrow - a wrong
   * chain, a bad address or a dead host are not helped by splitting, and
   * splitting them would turn one clear failure into 2^depth of them.
   */
  private shouldNarrowRange(error: Error | undefined): boolean {
    if (!error) return false;
    const text = `${error.message} ${String(
      (error as Error & { cause?: unknown }).cause ?? ""
    )}`.toLowerCase();
    return (
      // Rate limited. -32005 is the de facto "limit exceeded" code across
      // Alchemy, Infura and QuickNode.
      /\b429\b|too many requests|rate limit|ratelimit|-32005|compute unit|capacity exceeded/.test(
        text
      ) ||
      // The span itself is refused.
      /block range|range is too large|query returned more than|exceeds? the (?:maximum|limit)|logs matched|response size|query timeout/.test(
        text
      )
    );
  }

  /**
   * Helper to add delay between requests
   */
  private sleep(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }

  private getClientForChain(chainId: number): PublicClient {
    const client = this.clients.get(chainId);
    if (!client) {
      throw DataError.chainNotConfigured(chainId);
    }
    return client;
  }

  private getConfigForChain(chainId: number): ChainConfig {
    const config = this.chainConfigs.find((c) => c.chainId === chainId);
    if (!config) {
      throw DataError.chainNotConfigured(chainId);
    }
    return config;
  }

  private getLogFetchConfigForChain(chainId: number): LogFetchConfig {
    const config = this.logFetchConfigs.get(chainId);
    if (!config) {
      // Fallback to default if not found (shouldn't happen if constructor is correct)
      return DEFAULT_LOG_FETCH_CONFIG;
    }
    return config;
  }
}
