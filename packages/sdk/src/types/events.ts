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
  timestamp: bigint;
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
  timestamp: bigint;
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
  timestamp: bigint;
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
  apiKey: string;  // API key for RPC provider authentication
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
