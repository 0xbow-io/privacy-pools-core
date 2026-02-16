import {
  type PublicClient,
  type Hex,
  createPublicClient,
  http,
  parseAbiItem,
} from "viem";
import { mapLimit } from "async";
import {
  ChainConfig,
  DepositEvent,
  WithdrawalEvent,
  RagequitEvent,
} from "../types/events.js";
import { PoolInfo } from "../types/account.js";
import { Hash } from "../types/commitment.js";
import {
  LogFetchConfig,
  DEFAULT_LOG_FETCH_CONFIG,
  BlockRange,
} from "../types/rateLimit.js";
import { Logger } from "../utils/logger.js";
import { DataError } from "../errors/data.error.js";
import { ErrorCode } from "../errors/base.error.js";

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
  private readonly logFetchConfig: LogFetchConfig;

  /**
   * Initialize the data service with chain configurations
   *
   * @param chainConfigs - Array of chain configurations containing chainId, RPC URL, and API key
   * @param logFetchConfig - Optional configuration for rate-limited log fetching
   * @throws {DataError} If client initialization fails for any chain
   */
  constructor(
    private readonly chainConfigs: ChainConfig[],
    logFetchConfig: Partial<LogFetchConfig> = {}
  ) {
    this.logger = new Logger({ prefix: "Data" });
    this.logFetchConfig = { ...DEFAULT_LOG_FETCH_CONFIG, ...logFetchConfig };

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
      const config = this.getConfigForChain(pool.chainId);

      const fromBlock = pool.deploymentBlock ?? config.startBlock;
      const toBlock = await this.getCurrentBlock(pool.chainId);
      const ranges = this.generateBlockRanges(
        fromBlock,
        toBlock,
        this.logFetchConfig.blockChunkSize
      );

      this.logger.debug(
        `Fetching deposits in ${ranges.length} chunks for pool ${pool.address}`
      );

      // Use async.mapLimit for controlled concurrency
      const allLogs = await mapLimit<BlockRange, unknown[]>(
        ranges,
        this.logFetchConfig.concurrency,
        async (range: BlockRange) => {
          if (this.logFetchConfig.chunkDelayMs > 0) {
            await this.sleep(this.logFetchConfig.chunkDelayMs);
          }
          return this.fetchLogsWithRetry(
            client,
            pool.address,
            DEPOSIT_EVENT,
            range
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
            value: value || BigInt(0),
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
      const config = this.getConfigForChain(pool.chainId);

      const startBlock = fromBlock ?? config.startBlock;
      const toBlock = await this.getCurrentBlock(pool.chainId);
      const ranges = this.generateBlockRanges(
        startBlock,
        toBlock,
        this.logFetchConfig.blockChunkSize
      );

      this.logger.debug(
        `Fetching withdrawals in ${ranges.length} chunks for pool ${pool.address}`
      );

      // Use async.mapLimit for controlled concurrency
      const allLogs = await mapLimit<BlockRange, unknown[]>(
        ranges,
        this.logFetchConfig.concurrency,
        async (range: BlockRange) => {
          if (this.logFetchConfig.chunkDelayMs > 0) {
            await this.sleep(this.logFetchConfig.chunkDelayMs);
          }
          return this.fetchLogsWithRetry(
            client,
            pool.address,
            WITHDRAWAL_EVENT,
            range
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

          if (
            !value ||
            !spentNullifier ||
            !newCommitment ||
            !typedLog.blockNumber ||
            !typedLog.transactionHash
          ) {
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
      const config = this.getConfigForChain(pool.chainId);

      const startBlock = fromBlock ?? config.startBlock;
      const toBlock = await this.getCurrentBlock(pool.chainId);
      const ranges = this.generateBlockRanges(
        startBlock,
        toBlock,
        this.logFetchConfig.blockChunkSize
      );

      this.logger.debug(
        `Fetching ragequits in ${ranges.length} chunks for pool ${pool.address}`
      );

      // Use async.mapLimit for controlled concurrency
      const allLogs = await mapLimit<BlockRange, unknown[]>(
        ranges,
        this.logFetchConfig.concurrency,
        async (range: BlockRange) => {
          if (this.logFetchConfig.chunkDelayMs > 0) {
            await this.sleep(this.logFetchConfig.chunkDelayMs);
          }
          return this.fetchLogsWithRetry(
            client,
            pool.address,
            RAGEQUIT_EVENT,
            range
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
            value: value || BigInt(0),
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
    range: BlockRange
  ): Promise<T[]> {
    const maxRetries = this.logFetchConfig.retryOnFailure
      ? this.logFetchConfig.maxRetries
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
            this.logFetchConfig.retryBaseDelayMs * Math.pow(2, attempt);
          this.logger.warn(
            `Log fetch failed, retrying in ${delay}ms (attempt ${attempt + 1}/${maxRetries})`,
            { error: lastError.message, range }
          );
          await this.sleep(delay);
        }
      }
    }

    throw lastError;
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
}
