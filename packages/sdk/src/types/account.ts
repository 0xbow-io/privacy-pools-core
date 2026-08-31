import { Hash, Secret } from "./commitment.js";
import { Hex } from "viem";
import { RagequitEvent } from "./events.js";

export interface PoolAccount {
  label: Hash;
  deposit: AccountCommitment;
  children: AccountCommitment[];
  ragequit?: RagequitEvent;
  isMigrated?: boolean;
  /**
   * The deposit derivation index this account was reconstructed from, i.e. the
   * `index` fed to `createDepositSecrets(scope, index)`. Present only on
   * deposit-derived accounts; `undefined` on migration-derived accounts, which
   * are keyed by (label, withdrawalIndex) and occupy no deposit index.
   *
   * Array position in `poolAccounts[scope]` is NOT a derivation index — the two
   * namespaces are independent, and conflating them hides deposits.
   */
  depositIndex?: bigint;
  /**
   * True when this account was created by migration discovery (a legacy note
   * rotated to corrected keys) rather than by a deposit.
   */
  isMigrationDerived?: boolean;
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
  isMigration?: boolean;
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
