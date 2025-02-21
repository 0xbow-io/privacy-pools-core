import { HypersyncClient, presetQueryLogsOfEvent, Query } from "@envio-dev/hypersync-client";
import { ChainConfig, DepositEvent, EventFilterOptions, WithdrawalEvent } from "../types/events.js";
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
  async getDeposits(chainId: number, options: EventFilterOptions = {}): Promise<DepositEvent[]> {
    const client = this.getClientForChain(chainId);
    const config = this.getConfigForChain(chainId);

    const fromBlock = options.fromBlock ?? config.startBlock;
    const toBlock = options.toBlock ?? undefined;

    // Create query for deposit events
    const query = presetQueryLogsOfEvent(
      config.privacyPoolAddress,
      // topic0 is keccak256("Deposited(address,uint256,uint256,uint256,uint256)")
      "0x8c5261668696ce22758910d05bab8f186d6eb247ceac2af2e82c7dc17669b036",
      Number(fromBlock),
      toBlock ? Number(toBlock) : undefined
    );

    // Add depositor filter if provided
    if (options.depositor) {
      const queryWithTopics = query as Query & { topics: (string | null)[] };
      const topic0 = queryWithTopics.topics[0];
      if (!topic0) throw new Error("Invalid query: missing topic0");
      
      queryWithTopics.topics = [
        topic0,
        `0x000000000000000000000000${options.depositor.slice(2)}`
      ];
    }

    const res = await client.get(query);

    return res.data.logs.map(log => {
      if (!log.topics || log.topics.length < 5) {
        throw new Error(`Invalid deposit log: missing topics`);
      }

      const topics = log.topics.map(t => {
        if (!t) throw new Error("Invalid log: topic is null");
        return BigInt(t);
      });

      const topicsSliced = topics.slice(1);
      if (topicsSliced.length < 5) {
        throw new Error("Invalid deposit log: not enough topics");
      }

      const depositor = topicsSliced[0];
      const commitment = topicsSliced[1];
      const label = topicsSliced[2];
      const value = topicsSliced[3];
      const precommitment = topicsSliced[4];

      if (!depositor || !commitment || !label || !value || !precommitment || !log.blockNumber || !log.transactionHash) {
        throw new Error(`Invalid deposit log: missing required fields`);
      }

      return {
        depositor: `0x${depositor.toString(16).padStart(40, '0')}`,
        commitment: bigintToHash(commitment),
        label: bigintToHash(label),
        value,
        precommitment: bigintToHash(precommitment),
        blockNumber: BigInt(log.blockNumber),
        transactionHash: log.transactionHash as unknown as Hash
      };
    });
  }

  /**
   * Get withdrawals for a specific chain
   * @param chainId Chain ID to fetch withdrawals from
   * @param options Event filter options
   */
  async getWithdrawals(chainId: number, options: EventFilterOptions = {}): Promise<WithdrawalEvent[]> {
    const client = this.getClientForChain(chainId);
    const config = this.getConfigForChain(chainId);

    const fromBlock = options.fromBlock ?? config.startBlock;
    const toBlock = options.toBlock ?? undefined;

    // Create query for withdrawal events
    const query = presetQueryLogsOfEvent(
      config.privacyPoolAddress,
      // topic0 is keccak256("Withdrawn(address,uint256,uint256,uint256)")
      "0x92ccf450a286a957af52509bc1c9939d1a6a481783e142e41e2499f0bb66ebc6",
      Number(fromBlock),
      toBlock ? Number(toBlock) : undefined
    );

    const res = await client.get(query);

    return res.data.logs.map(log => {
      if (!log.topics || log.topics.length < 4) {
        throw new Error(`Invalid withdrawal log: missing topics`);
      }

      const topics = log.topics.map(t => {
        if (!t) throw new Error("Invalid log: topic is null");
        return BigInt(t);
      });

      const topicsSliced = topics.slice(1);
      if (topicsSliced.length < 4) {
        throw new Error("Invalid withdrawal log: not enough topics");
      }

      const processooor = topicsSliced[0];
      const value = topicsSliced[1];
      const spentNullifier = topicsSliced[2];
      const newCommitment = topicsSliced[3];

      if (!value || !spentNullifier || !newCommitment || !log.blockNumber || !log.transactionHash) {
        throw new Error(`Invalid withdrawal log: missing required fields`);
      }

      return {
        withdrawn: value,
        spentNullifier: bigintToHash(spentNullifier),
        newCommitment: bigintToHash(newCommitment),
        blockNumber: BigInt(log.blockNumber),
        transactionHash: log.transactionHash as unknown as Hash
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
      this.getWithdrawals(chainId, options)
    ]);

    // Combine and sort events by block number
    const allEvents = [
      ...deposits.map(d => ({ type: 'deposit' as const, ...d })),
      ...withdrawals.map(w => ({ type: 'withdrawal' as const, ...w }))
    ].sort((a, b) => {
      const blockDiff = a.blockNumber - b.blockNumber;
      if (blockDiff === 0n) {
        // If same block, deposits come before withdrawals
        return a.type === 'deposit' ? -1 : 1;
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
    const config = this.chainConfigs.find(c => c.chainId === chainId);
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
      default:
        throw new Error(`No Hypersync endpoint available for chain ID ${chainId}`);
    }
  }
}
