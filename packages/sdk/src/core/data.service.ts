import {
  type PublicClient,
  createPublicClient,
  http,
  parseAbiItem,
  type Address,
} from "viem";
import {
  ChainConfig,
  DepositEvent,
  EventFilterOptions,
  WithdrawalEvent,
  RagequitEvent,
} from "../types/events.js";
import { Hash } from "../types/commitment.js";
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

  /**
   * Initialize the data service with chain configurations
   * 
   * @param chainConfigs - Array of chain configurations containing chainId, RPC URL, and API key
   * @throws {DataError} If client initialization fails for any chain
   */
  constructor(private readonly chainConfigs: ChainConfig[]) {
    this.logger = new Logger({ prefix: "Data" });

    try {
      for (const config of chainConfigs) {
        if (!config.rpcUrl || !config.apiKey) {
          throw new Error(`Missing RPC URL or API key for chain ${config.chainId}`);
        }

        const client = createPublicClient({
          transport: http(config.rpcUrl),
          key: config.apiKey,
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
   * @param chainId - Chain ID to fetch events from
   * @param options - Event filter options including fromBlock, toBlock, and other filters
   * @returns Array of deposit events with properly typed fields (bigint for numbers, Hash for commitments)
   * @throws {DataError} If client is not configured, network error occurs, or event data is invalid
   */
  async getDeposits(
    chainId: number,
    options: EventFilterOptions = {},
  ): Promise<DepositEvent[]> {
    try {
      const client = this.getClientForChain(chainId);
      const config = this.getConfigForChain(chainId);

      const logs = await client.getLogs({
        address: config.privacyPoolAddress,
        event: DEPOSIT_EVENT,
        fromBlock: options.fromBlock ?? config.startBlock,
        toBlock: options.toBlock,
      }).catch(error => {
        throw new DataError(
          "Failed to fetch deposit logs",
          ErrorCode.NETWORK_ERROR,
          { error: error instanceof Error ? error.message : "Unknown error" },
        );
      });

      return await Promise.all(logs.map(async (log) => {
        try {
          const block = await client.getBlock({ blockNumber: log.blockNumber });
          
          if (!log.args) {
            throw DataError.invalidLog("deposit", "missing args");
          }

          const {
            _depositor: depositor,
            _commitment: commitment,
            _label: label,
            _value: value,
            _merkleRoot: precommitment,
          } = log.args;

          if (!depositor || !commitment || !label || !value || !precommitment || !log.blockNumber || !log.transactionHash) {
            throw DataError.invalidLog("deposit", "missing required fields");
          }

          return {
            depositor: depositor.toLowerCase(),
            commitment: commitment as Hash,
            label: label as Hash,
            value,
            precommitment: precommitment as Hash,
            blockNumber: BigInt(log.blockNumber),
            timestamp: BigInt(block.timestamp),
            transactionHash: log.transactionHash,
          };
        } catch (error) {
          if (error instanceof DataError) throw error;
          throw DataError.invalidLog("deposit", error instanceof Error ? error.message : "Unknown error");
        }
      }));
    } catch (error) {
      if (error instanceof DataError) throw error;
      throw DataError.networkError(chainId, error instanceof Error ? error : new Error(String(error)));
    }
  }

  /**
   * Get withdrawal events for a specific chain
   * 
   * @param chainId - Chain ID to fetch events from
   * @param options - Event filter options including fromBlock, toBlock, and other filters
   * @returns Array of withdrawal events with properly typed fields (bigint for numbers, Hash for commitments)
   * @throws {DataError} If client is not configured, network error occurs, or event data is invalid
   */
  async getWithdrawals(
    chainId: number,
    options: EventFilterOptions = {},
  ): Promise<WithdrawalEvent[]> {
    try {
      const client = this.getClientForChain(chainId);
      const config = this.getConfigForChain(chainId);

      const logs = await client.getLogs({
        address: config.privacyPoolAddress,
        event: WITHDRAWAL_EVENT,
        fromBlock: options.fromBlock ?? config.startBlock,
        toBlock: options.toBlock,
      }).catch(error => {
        throw new DataError(
          "Failed to fetch withdrawal logs",
          ErrorCode.NETWORK_ERROR,
          { error: error instanceof Error ? error.message : "Unknown error" },
        );
      });

      return await Promise.all(logs.map(async (log) => {
        try {
          const block = await client.getBlock({ blockNumber: log.blockNumber });
          
          if (!log.args) {
            throw DataError.invalidLog("withdrawal", "missing args");
          }

          const {
            _value: value,
            _spentNullifier: spentNullifier,
            _newCommitment: newCommitment,
          } = log.args;

          if (!value || !spentNullifier || !newCommitment || !log.blockNumber || !log.transactionHash) {
            throw DataError.invalidLog("withdrawal", "missing required fields");
          }

          return {
            withdrawn: value,
            spentNullifier: spentNullifier as Hash,
            newCommitment: newCommitment as Hash,
            blockNumber: BigInt(log.blockNumber),
            timestamp: BigInt(block.timestamp),
            transactionHash: log.transactionHash,
          };
        } catch (error) {
          if (error instanceof DataError) throw error;
          throw DataError.invalidLog("withdrawal", error instanceof Error ? error.message : "Unknown error");
        }
      }));
    } catch (error) {
      if (error instanceof DataError) throw error;
      throw DataError.networkError(chainId, error instanceof Error ? error : new Error(String(error)));
    }
  }

  /**
   * Get ragequit events for a specific chain
   * 
   * @param chainId - Chain ID to fetch events from
   * @param options - Event filter options including fromBlock, toBlock, and other filters
   * @returns Array of ragequit events with properly typed fields (bigint for numbers, Hash for commitments)
   * @throws {DataError} If client is not configured, network error occurs, or event data is invalid
   */
  async getRagequits(
    chainId: number,
    options: EventFilterOptions = {},
  ): Promise<RagequitEvent[]> {
    try {
      const client = this.getClientForChain(chainId);
      const config = this.getConfigForChain(chainId);

      const logs = await client.getLogs({
        address: config.privacyPoolAddress,
        event: RAGEQUIT_EVENT,
        fromBlock: options.fromBlock ?? config.startBlock,
        toBlock: options.toBlock,
      }).catch(error => {
        throw new DataError(
          "Failed to fetch ragequit logs",
          ErrorCode.NETWORK_ERROR,
          { error: error instanceof Error ? error.message : "Unknown error" },
        );
      });

      return await Promise.all(logs.map(async (log) => {
        try {
          const block = await client.getBlock({ blockNumber: log.blockNumber });
          
          if (!log.args) {
            throw DataError.invalidLog("ragequit", "missing args");
          }

          const {
            _ragequitter: ragequitter,
            _commitment: commitment,
            _label: label,
            _value: value,
          } = log.args;

          if (!ragequitter || !commitment || !label || !value || !log.blockNumber || !log.transactionHash) {
            throw DataError.invalidLog("ragequit", "missing required fields");
          }

          return {
            ragequitter: ragequitter.toLowerCase(),
            commitment: commitment as Hash,
            label: label as Hash,
            value,
            blockNumber: BigInt(log.blockNumber),
            timestamp: BigInt(block.timestamp),
            transactionHash: log.transactionHash,
          };
        } catch (error) {
          if (error instanceof DataError) throw error;
          throw DataError.invalidLog("ragequit", error instanceof Error ? error.message : "Unknown error");
        }
      }));
    } catch (error) {
      if (error instanceof DataError) throw error;
      throw DataError.networkError(chainId, error instanceof Error ? error : new Error(String(error)));
    }
  }

  private getClientForChain(chainId: number): PublicClient {
    const client = this.clients.get(chainId);
    if (!client) {
      throw DataError.chainNotConfigured(chainId);
    }
    return client;
  }

  private getConfigForChain(chainId: number): ChainConfig {
    const config = this.chainConfigs.find(c => c.chainId === chainId);
    if (!config) {
      throw DataError.chainNotConfigured(chainId);
    }
    return config;
  }
}
