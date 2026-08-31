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

/**
 * Outcome of the last attempt to load a scope's event history.
 *
 * - `complete`   — processed successfully; reconstructed state is trustworthy.
 * - `incomplete` — attempted and failed; state is ABSENT, not empty.
 * - `not-loaded` — never attempted; nothing is known about this scope.
 *
 * `incomplete` and `not-loaded` are both unsafe to infer a deposit index from:
 * the account may already hold notes on-chain that are not visible here, and
 * reusing their index produces a deposit that shares a nullifier hash with an
 * existing one — of which the pool will only ever let one be withdrawn.
 */
export type ScopeLoadStatus = "complete" | "incomplete" | "not-loaded";

export interface PrivacyPoolAccount {
  masterKeys: [masterNullifier: Secret, masterSecret: Secret];
  poolAccounts: Map<Hash, PoolAccount[]>;
  /**
   * Per-scope load outcome, carried with the account so the completeness guard
   * survives persist/restore. A scope absent from the map was never attempted.
   *
   * Optional for backward compatibility: an account object produced before this
   * field existed has no map at all, and is treated as "status unknown" rather
   * than "nothing loaded" so restoring an old history file does not lock the
   * user out of depositing.
   */
  scopeStatus?: Map<Hash, ScopeLoadStatus>;
  creationTimestamp?: bigint;
  lastUpdateTimestamp?: bigint;
}

export interface PoolInfo {
  chainId: number;
  address: Hex;
  scope: Hash;
  deploymentBlock: bigint;
}
