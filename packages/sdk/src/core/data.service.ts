import {
  HypersyncClient,
  presetQueryLogsOfEvent,
  Query,
} from "@envio-dev/hypersync-client";
import {
  ChainConfig,
  DepositEvent,
  EventFilterOptions,
  WithdrawalEvent,
  RagequitEvent,
} from "../types/events.js";
import { bigintToHash } from "../crypto.js";
import { Hash } from "../types/commitment.js";
import { Logger } from "../utils/logger.js";
import { DataError } from "../errors/data.error.js";
import { ErrorCode } from "../errors/base.error.js";

/**
 * Service responsible for fetching and managing privacy pool events across multiple chains.
 * Handles event retrieval, parsing, and validation for deposits, withdrawals, and ragequits.
 * 
 * @remarks
 * This service uses HypersyncClient to efficiently fetch and process blockchain events.
 * It supports multiple chains and provides robust error handling and validation.
 */
export class DataService {
  private readonly clients: Map<number, HypersyncClient> = new Map();
  private readonly logger: Logger;

  /**
   * Initialize the data service with chain configurations
   * 
   * @param chainConfigs - Array of chain configurations
   * @throws {DataError} If client initialization fails for any chain
   */
  constructor(private readonly chainConfigs: ChainConfig[]) {
    this.logger = new Logger({ prefix: "Data" });

    try {
      for (const config of chainConfigs) {
        const client = HypersyncClient.new({
          url: this.getHypersyncUrlForChain(config.chainId),
        });
        this.clients.set(config.chainId, client);
      }
    } catch (error) {
      throw new DataError(
        "Failed to initialize HypersyncClient",
        ErrorCode.NETWORK_ERROR,
        { error: error instanceof Error ? error.message : "Unknown error" },
      );
    }
  }

  /**
   * Get deposits for a specific chain
   * 
   * @param chainId - Chain ID to fetch deposits from
   * @param options - Event filter options
   * @returns Array of deposit events
   * @throws {DataError} If client is not configured or network error occurs
   */
  async getDeposits(
    chainId: number,
    options: EventFilterOptions = {},
  ): Promise<DepositEvent[]> {
    try {
      const client = this.getClientForChain(chainId);
      const config = this.getConfigForChain(chainId);

      const fromBlock = options.fromBlock ?? config.startBlock;
      const toBlock = options.toBlock ?? undefined;

      this.logger.debug(
        `Fetching deposits for chain ${chainId} from block ${fromBlock}${
          toBlock ? ` to ${toBlock}` : ""
        }`,
      );

      const query = presetQueryLogsOfEvent(
        config.privacyPoolAddress,
        // topic0 is keccak256("Deposited(address,uint256,uint256,uint256,uint256)")
        "0xe3b53cd1a44fbf11535e145d80b8ef1ed6d57a73bf5daa7e939b6b01657d6549",
        Number(fromBlock),
        toBlock ? Number(toBlock) : undefined,
      );

      if (options.depositor) {
        const queryWithTopics = query as Query & { topics: (string | null)[] };
        const topic0 = queryWithTopics.topics[0];
        if (!topic0) {
          throw DataError.invalidLog("deposit", "missing topic0");
        }

        queryWithTopics.topics = [
          topic0,
          `0x000000000000000000000000${options.depositor.slice(2)}`,
        ];
      }

      const res = await client.get(query);

      return res.data.logs.map((log) => {
        if (!log.topics || log.topics.length < 2) {
          throw DataError.invalidLog("deposit", "missing topics");
        }

        const depositorTopic = log.topics[1];
        if (!depositorTopic) {
          throw DataError.invalidLog("deposit", "missing depositor topic");
        }
        const depositor = BigInt(depositorTopic);

        if (!log.data) {
          throw DataError.invalidLog("deposit", "missing data");
        }

        const data = log.data.slice(2).match(/.{64}/g);
        if (!data || data.length < 4) {
          throw DataError.invalidLog("deposit", "insufficient data");
        }

        const commitment = BigInt("0x" + data[0]);
        const label = BigInt("0x" + data[1]);
        const value = BigInt("0x" + data[2]);
        const precommitment = BigInt("0x" + data[3]);

        if (
          !depositor ||
          !commitment ||
          !label ||
          !value ||
          !log.blockNumber ||
          !log.transactionHash
        ) {
          throw DataError.invalidLog("deposit", "missing required fields");
        }

        return {
          depositor: `0x${depositor.toString(16).padStart(40, "0")}`,
          commitment: bigintToHash(commitment),
          label: bigintToHash(label),
          value,
          precommitment: bigintToHash(precommitment),
          blockNumber: BigInt(log.blockNumber),
          transactionHash: log.transactionHash as unknown as Hash,
        };
      });
    } catch (error) {
      if (error instanceof DataError) throw error;
      throw DataError.networkError(chainId, error instanceof Error ? error : new Error(String(error)));
    }
  }

  /**
   * Get withdrawals for a specific chain
   * 
   * @param chainId - Chain ID to fetch withdrawals from
   * @param options - Event filter options
   * @returns Array of withdrawal events
   * @throws {DataError} If client is not configured or network error occurs
   */
  async getWithdrawals(
    chainId: number,
    options: EventFilterOptions = {},
  ): Promise<WithdrawalEvent[]> {
    try {
      const client = this.getClientForChain(chainId);
      const config = this.getConfigForChain(chainId);

      const fromBlock = options.fromBlock ?? config.startBlock;
      const toBlock = options.toBlock ?? undefined;

      this.logger.debug(
        `Fetching withdrawals for chain ${chainId} from block ${fromBlock}${
          toBlock ? ` to ${toBlock}` : ""
        }`,
      );

      const query = presetQueryLogsOfEvent(
        config.privacyPoolAddress,
        // topic0 is keccak256("Withdrawn(address,uint256,uint256,uint256)")
        "0x75e161b3e824b114fc1a33274bd7091918dd4e639cede50b78b15a4eea956a21",
        Number(fromBlock),
        toBlock ? Number(toBlock) : undefined,
      );

      const res = await client.get(query);

      return res.data.logs.map((log) => {
        if (!log.topics || log.topics.length < 2) {
          throw DataError.invalidLog("withdrawal", "missing topics");
        }

        const processorTopic = log.topics[1];
        if (!processorTopic) {
          throw DataError.invalidLog("withdrawal", "missing processor topic");
        }
        const processor = BigInt(processorTopic);

        if (!log.data) {
          throw DataError.invalidLog("withdrawal", "missing data");
        }

        const data = log.data.slice(2).match(/.{64}/g);
        if (!data || data.length < 3) {
          throw DataError.invalidLog("withdrawal", "insufficient data");
        }

        const value = BigInt("0x" + data[0]);
        const spentNullifier = BigInt("0x" + data[1]);
        const newCommitment = BigInt("0x" + data[2]);

        if (
          !value ||
          !spentNullifier ||
          !newCommitment ||
          !log.blockNumber ||
          !log.transactionHash
        ) {
          throw DataError.invalidLog("withdrawal", "missing required fields");
        }

        return {
          withdrawn: value,
          spentNullifier: bigintToHash(spentNullifier),
          newCommitment: bigintToHash(newCommitment),
          blockNumber: BigInt(log.blockNumber),
          transactionHash: log.transactionHash as unknown as Hash,
        };
      });
    } catch (error) {
      if (error instanceof DataError) throw error;
      throw DataError.networkError(chainId, error instanceof Error ? error : new Error(String(error)));
    }
  }

  /**
   * Get ragequit events for a specific chain
   * 
   * @param chainId - Chain ID to fetch ragequits from
   * @param options - Event filter options
   * @returns Array of ragequit events
   * @throws {DataError} If client is not configured or network error occurs
   */
  async getRagequits(
    chainId: number,
    options: EventFilterOptions = {},
  ): Promise<RagequitEvent[]> {
    try {
      const client = this.getClientForChain(chainId);
      const config = this.getConfigForChain(chainId);

      const fromBlock = options.fromBlock ?? config.startBlock;
      const toBlock = options.toBlock ?? undefined;

      this.logger.debug(
        `Fetching ragequits for chain ${chainId} from block ${fromBlock}${
          toBlock ? ` to ${toBlock}` : ""
        }`,
      );

      const query = presetQueryLogsOfEvent(
        config.privacyPoolAddress,
        // topic0 is keccak256("Ragequit(address,uint256,uint256,uint256)")
        "0xd2b3e868ae101106371f2bd93abc8d5a4de488b9fe47ed122c23625aa7172f13",
        Number(fromBlock),
        toBlock ? Number(toBlock) : undefined,
      );

      const res = await client.get(query);

      return res.data.logs.map((log) => {
        if (!log.topics || log.topics.length < 2) {
          throw DataError.invalidLog("ragequit", "missing topics");
        }

        const ragequitterTopic = log.topics[1];
        if (!ragequitterTopic) {
          throw DataError.invalidLog("ragequit", "missing ragequitter topic");
        }
        const ragequitter = BigInt(ragequitterTopic);

        if (!log.data) {
          throw DataError.invalidLog("ragequit", "missing data");
        }

        const data = log.data.slice(2).match(/.{64}/g);
        if (!data || data.length < 3) {
          throw DataError.invalidLog("ragequit", "insufficient data");
        }

        const commitment = BigInt("0x" + data[0]);
        const label = BigInt("0x" + data[1]);
        const value = BigInt("0x" + data[2]);

        if (
          !ragequitter ||
          !commitment ||
          !label ||
          !value ||
          !log.blockNumber ||
          !log.transactionHash
        ) {
          throw DataError.invalidLog("ragequit", "missing required fields");
        }

        return {
          ragequitter: `0x${ragequitter.toString(16).padStart(40, "0")}`,
          commitment: bigintToHash(commitment),
          label: bigintToHash(label),
          value,
          blockNumber: BigInt(log.blockNumber),
          transactionHash: log.transactionHash as unknown as Hash,
        };
      });
    } catch (error) {
      if (error instanceof DataError) throw error;
      throw DataError.networkError(chainId, error instanceof Error ? error : new Error(String(error)));
    }
  }

  /**
   * Get all events (deposits and withdrawals) for a specific chain in chronological order
   * 
   * @param chainId - Chain ID to fetch events from
   * @param options - Event filter options
   * @returns Array of events sorted by block number
   * @throws {DataError} If client is not configured or network error occurs
   */
  async getAllEvents(chainId: number, options: EventFilterOptions = {}) {
    try {
      const [deposits, withdrawals] = await Promise.all([
        this.getDeposits(chainId, options),
        this.getWithdrawals(chainId, options),
      ]);

      return [
        ...deposits.map((d) => ({ type: "deposit" as const, ...d })),
        ...withdrawals.map((w) => ({ type: "withdrawal" as const, ...w })),
      ].sort((a, b) => {
        const blockDiff = a.blockNumber - b.blockNumber;
        if (blockDiff === 0n) {
          return a.type === "deposit" ? -1 : 1;
        }
        return Number(blockDiff);
      });
    } catch (error) {
      if (error instanceof DataError) throw error;
      throw DataError.networkError(chainId, error instanceof Error ? error : new Error(String(error)));
    }
  }

  private getClientForChain(chainId: number): HypersyncClient {
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

  private getHypersyncUrlForChain(chainId: number): string {
    switch (chainId) {
      case 1: // Ethereum Mainnet
        return "https://eth.hypersync.xyz";
      case 137: // Polygon
        return "https://polygon.hypersync.xyz";
      case 42161: // Arbitrum
        return "https://arbitrum.hypersync.xyz";
      case 10: // Optimism
        return "https://optimism.hypersync.xyz";
      case 11155111: // Sepolia
        return "https://sepolia.hypersync.xyz";
      default:
        throw DataError.chainNotConfigured(chainId);
    }
  }
}
