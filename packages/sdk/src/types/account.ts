import { Hash, Secret } from "./commitment.js";
import { Hex } from "viem";
import { RagequitEvent } from "./events.js";

export interface PoolAccount {
  label: Hash;
  deposit: AccountCommitment;
  children: AccountCommitment[];
  ragequit?: RagequitEvent
}

export interface AccountCommitment {
  hash: Hash;
  value: bigint;
  label: Hash;
  nullifier: Secret;
  secret: Secret;
  blockNumber: bigint;
  timestamp?: bigint;
  txHash: Hex;
}

export interface PrivacyPoolAccount {
  masterKeys: [masterNullifier: Secret, masterSecret: Secret];
  poolAccounts: Map<Hash, PoolAccount[]>;
  creationTimestamp?: bigint;
  lastUpdateTimestamp?: bigint;
}

export interface PoolInfo {
  chainId: number;
  address: Hex;
  scope: Hash;
  deploymentBlock: bigint;
}
