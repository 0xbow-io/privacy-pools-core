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

/**
 * Service responsible for fetching and managing privacy pool events across multiple chains
 */
export class DataService {
  private readonly clients: Map<number, HypersyncClient> = new Map();

  /**
   * Initialize the data service with chain configurations
   * @param chainConfigs Array of chain configurations
   */
  constructor(private readonly chainConfigs: ChainConfig[]) {
    // Initialize clients for each chain
    for (const config of chainConfigs) {
      const client = HypersyncClient.new({
        url: this.getHypersyncUrlForChain(config.chainId),
      });
      this.clients.set(config.chainId, client);
    }
  }

  /**
   * Get deposits for a specific chain
   * @param chainId Chain ID to fetch deposits from
   * @param options Event filter options
   */
  async getDeposits(
    chainId: number,
    options: EventFilterOptions = {},
  ): Promise<DepositEvent[]> {
    const client = this.getClientForChain(chainId);
    const config = this.getConfigForChain(chainId);

    const fromBlock = options.fromBlock ?? config.startBlock;
    const toBlock = options.toBlock ?? undefined;

    // Create query for deposit events
    const query = presetQueryLogsOfEvent(
      config.privacyPoolAddress,
      // topic0 is keccak256("Deposited(address,uint256,uint256,uint256,uint256)")
      "0xe3b53cd1a44fbf11535e145d80b8ef1ed6d57a73bf5daa7e939b6b01657d6549",
      Number(fromBlock),
      toBlock ? Number(toBlock) : undefined,
    );

    // Add depositor filter if provided
    if (options.depositor) {
      const queryWithTopics = query as Query & { topics: (string | null)[] };
      const topic0 = queryWithTopics.topics[0];
      if (!topic0) throw new Error("Invalid query: missing topic0");

      queryWithTopics.topics = [
        topic0,
        `0x000000000000000000000000${options.depositor.slice(2)}`,
      ];
    }

    const res = await client.get(query);

    return res.data.logs.map((log) => {
      // Only depositor is indexed, so we expect 2 topics (topic0 + depositor)
      if (!log.topics || log.topics.length < 2) {
        throw new Error(`Invalid deposit log: missing topics`);
      }

      // Get depositor from indexed parameter
      const depositorTopic = log.topics[1];
      if (!depositorTopic) {
        throw new Error("Invalid deposit log: missing depositor topic");
      }
      const depositor = BigInt(depositorTopic);

      // Parse non-indexed parameters from data
      if (!log.data) throw new Error("Invalid deposit log: missing data");

      // Remove '0x' and split into 32-byte chunks
      const data = log.data.slice(2).match(/.{64}/g);
      if (!data || data.length < 4) {
        throw new Error("Invalid deposit log: insufficient data");
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
        throw new Error(`Invalid deposit log: missing required fields`);
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
  }

  /**
   * Get withdrawals for a specific chain
   * @param chainId Chain ID to fetch withdrawals from
   * @param options Event filter options
   */
  async getWithdrawals(
    chainId: number,
    options: EventFilterOptions = {},
  ): Promise<WithdrawalEvent[]> {
    const client = this.getClientForChain(chainId);
    const config = this.getConfigForChain(chainId);

    const fromBlock = options.fromBlock ?? config.startBlock;
    const toBlock = options.toBlock ?? undefined;

    // Create query for withdrawal events
    const query = presetQueryLogsOfEvent(
      config.privacyPoolAddress,
      // topic0 is keccak256("Withdrawn(address,uint256,uint256,uint256)")
      "0x75e161b3e824b114fc1a33274bd7091918dd4e639cede50b78b15a4eea956a21",
      Number(fromBlock),
      toBlock ? Number(toBlock) : undefined,
    );

    const res = await client.get(query);

    return res.data.logs.map((log) => {
      // Expect 2 topics (topic0 + processor)
      if (!log.topics || log.topics.length < 2) {
        throw new Error(`Invalid withdrawal log: missing topics`);
      }

      // Get processor from indexed parameter
      const processorTopic = log.topics[1];
      if (!processorTopic) {
        throw new Error("Invalid withdrawal log: missing processor topic");
      }
      const processor = BigInt(processorTopic);

      // Parse non-indexed parameters from data
      if (!log.data) throw new Error("Invalid withdrawal log: missing data");

      // Remove '0x' and split into 32-byte chunks
      const data = log.data.slice(2).match(/.{64}/g);
      if (!data || data.length < 3) {
        throw new Error("Invalid withdrawal log: insufficient data");
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
        throw new Error(`Invalid withdrawal log: missing required fields`);
      }

      return {
        withdrawn: value,
        spentNullifier: bigintToHash(spentNullifier),
        newCommitment: bigintToHash(newCommitment),
        blockNumber: BigInt(log.blockNumber),
        transactionHash: log.transactionHash as unknown as Hash,
      };
    });
  }

  /**
   * Get ragequit events for a specific chain
   * @param chainId Chain ID to fetch ragequits from
   * @param options Event filter options
   */
  async getRagequits(
    chainId: number,
    options: EventFilterOptions = {},
  ): Promise<RagequitEvent[]> {
    const client = this.getClientForChain(chainId);
    const config = this.getConfigForChain(chainId);

    const fromBlock = options.fromBlock ?? config.startBlock;
    const toBlock = options.toBlock ?? undefined;

    // Create query for ragequit events
    const query = presetQueryLogsOfEvent(
      config.privacyPoolAddress,
      // topic0 is keccak256("Ragequit(address,uint256,uint256,uint256)")
      "0xd2b3e868ae101106371f2bd93abc8d5a4de488b9fe47ed122c23625aa7172f13",
      Number(fromBlock),
      toBlock ? Number(toBlock) : undefined,
    );

    const res = await client.get(query);

    return res.data.logs.map((log) => {
      // Only ragequitter is indexed, so we expect 2 topics (topic0 + ragequitter)
      if (!log.topics || log.topics.length < 2) {
        throw new Error(`Invalid ragequit log: missing topics`);
      }

      // Get ragequitter from indexed parameter
      const ragequitterTopic = log.topics[1];
      if (!ragequitterTopic) {
        throw new Error("Invalid ragequit log: missing ragequitter topic");
      }
      const ragequitter = BigInt(ragequitterTopic);

      // Parse non-indexed parameters from data
      if (!log.data) throw new Error("Invalid ragequit log: missing data");

      // Remove '0x' and split into 32-byte chunks
      const data = log.data.slice(2).match(/.{64}/g);
      if (!data || data.length < 3) {
        throw new Error("Invalid ragequit log: insufficient data");
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
        throw new Error(`Invalid ragequit log: missing required fields`);
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
  }

  /**
   * Get all events (deposits and withdrawals) for a specific chain in chronological order
   * @param chainId Chain ID to fetch events from
   * @param options Event filter options
   */
  async getAllEvents(chainId: number, options: EventFilterOptions = {}) {
    const [deposits, withdrawals] = await Promise.all([
      this.getDeposits(chainId, options),
      this.getWithdrawals(chainId, options),
    ]);

    // Combine and sort events by block number
    const allEvents = [
      ...deposits.map((d) => ({ type: "deposit" as const, ...d })),
      ...withdrawals.map((w) => ({ type: "withdrawal" as const, ...w })),
    ].sort((a, b) => {
      const blockDiff = a.blockNumber - b.blockNumber;
      if (blockDiff === 0n) {
        // If same block, deposits come before withdrawals
        return a.type === "deposit" ? -1 : 1;
      }
      return Number(blockDiff);
    });

    return allEvents;
  }

  private getClientForChain(chainId: number): HypersyncClient {
    const client = this.clients.get(chainId);
    if (!client) {
      throw new Error(`No client configured for chain ID ${chainId}`);
    }
    return client;
  }

  private getConfigForChain(chainId: number): ChainConfig {
    const config = this.chainConfigs.find((c) => c.chainId === chainId);
    if (!config) {
      throw new Error(`No configuration found for chain ID ${chainId}`);
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
        throw new Error(
          `No Hypersync endpoint available for chain ID ${chainId}`,
        );
    }
  }
}
