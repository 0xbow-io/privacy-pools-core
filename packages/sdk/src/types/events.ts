import { Address, Hex } from "viem";
import { Hash } from "./commitment.js";

/**
 * Represents a deposit event from a privacy pool
 */
export interface DepositEvent {
  depositor: string;
  commitment: Hash;
  label: Hash;
  value: bigint;
  precommitment: Hash;
  blockNumber: bigint;
  transactionHash: Hex;
}

/**
 * Represents a withdrawal event from a privacy pool
 */
export interface WithdrawalEvent {
  withdrawn: bigint;
  spentNullifier: Hash;
  newCommitment: Hash;
  blockNumber: bigint;
  transactionHash: Hex;
}

/**
 * Represents a ragequit event from a privacy pool
 */
export interface RagequitEvent {
  ragequitter: string;
  commitment: Hash;
  label: Hash;
  value: bigint;
  blockNumber: bigint;
  transactionHash: Hex;
}

/**
 * Configuration for a chain's data provider
 */
export interface ChainConfig {
  chainId: number;
  privacyPoolAddress: Address;
  startBlock: bigint;
  rpcUrl: string;

  /**
   * Timeout in milliseconds for a single RPC request to `rpcUrl`.
   *
   * Chunked log fetching issues one `eth_getLogs` per block range, so this is
   * the ceiling on how long a single chunk may take. Raise it when reading
   * wide ranges through an indexer that needs longer than viem's default —
   * otherwise the caller aborts while the request is still in flight, and the
   * effective chunk size is capped by this value rather than by the provider.
   *
   * Default: 10_000 (viem's `http` transport default)
   */
  timeout?: number;

  /**
   * How many times viem's transport retries a failed RPC request before the
   * error surfaces. Note this is transport-level and multiplies with the
   * chunk-level `maxRetries` in `LogFetchConfig`: a chunk can be attempted
   * `(retryCount + 1) * (maxRetries + 1)` times in the worst case. viem
   * retries timeouts and 429s, so lower this when a provider is rate-limiting.
   *
   * Default: 3 (viem's `http` transport default)
   */
  retryCount?: number;
}

/**
 * Event filter options
 */
export interface EventFilterOptions {
  fromBlock?: bigint;
  toBlock?: bigint;
  depositor?: string;
  limit?: number;
  skip?: number;
}

/**
 * Collection of pool events
 */
export interface PoolEvents {
  deposits: DepositEvent[];
  withdrawals: WithdrawalEvent[];
}

export interface PoolEventsSuccess {
  /**
   * Deposit events grouped by precommitment, oldest block first.
   *
   * Grouped rather than keyed one-to-one because two deposits can legitimately
   * share a precommitment when the same deposit index was handed out twice
   * (possible on SDK versions that inferred the index from incomplete state).
   * Collapsing the group would silently drop every deposit but one.
   */
  depositEvents: Map<Hash, DepositEvent[]>;
  withdrawalEvents: Map<Hash, WithdrawalEvent>;
  ragequitEvents: Map<Hash, RagequitEvent>;
}

export interface PoolEventsError {
  reason: string;
  scope: Hash;
}

export type PoolEventsResult = Map<Hash, PoolEventsSuccess | PoolEventsError>;

export type ProcessedDepositEventsResult = Map<Hash, DepositEvent[]>;