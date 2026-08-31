import { poseidon } from "maci-crypto/build/ts/hashing.js";
import { Hash, Secret } from "../types/commitment.js";
import { Hex, bytesToNumber } from "viem";
import { mnemonicToAccount } from "viem/accounts";
import { generateMasterKeys } from "../crypto.js";
import { mapLimit } from "async";
import { DataService } from "./data.service.js";
import {
  AccountCommitment,
  PoolAccount,
  PoolInfo,
  PrivacyPoolAccount,
  ScopeLoadStatus,
} from "../types/account.js";
import {
  DepositEvent,
  PoolEventsError,
  PoolEventsResult,
  RagequitEvent,
  WithdrawalEvent,
} from "../types/events.js";

import { Logger } from "../utils/logger.js";
import { AccountError } from "../errors/account.error.js";
import { ErrorCode } from "../errors/base.error.js";
import { EventError } from "../errors/events.error.js";

/**
 * Optional behavioral configuration shared across the AccountService
 * construction paths (direct constructor and `initializeWithEvents`).
 */
type AccountServiceOptions = {
  /** Maximum number of pools to fetch events for concurrently (default: 2). */
  poolConcurrency?: number;
  /**
   * Whether reconstructed empty nodes are included in the user's decrypted
   * nodes returned by {@link AccountService.getSpendableCommitments}.
   *
   * When `true` (the default), every account's latest commitment is returned,
   * including empty (zero-value), migrated, and ragequit commitments. Set to
   * `false` to restore the spendable-only behavior, where those nodes are
   * filtered out.
   */
  includeEmptyNodes?: boolean;
};

type AccountServiceConfig =
  | ({ mnemonic: string } & AccountServiceOptions)
  | ({ account: PrivacyPoolAccount } & AccountServiceOptions);

/**
 * Service responsible for managing privacy pool accounts and their associated commitments.
 * Handles account initialization, deposit/withdrawal tracking, and history synchronization.
 *
 * @remarks
 * This service maintains the state of all pool accounts and their commitments across different
 * chains and scopes. It uses deterministic key generation to recover account state from a mnemonic.
 */
export class AccountService {
  account: PrivacyPoolAccount;
  private readonly logger: Logger;
  private readonly poolConcurrency: number;
  private readonly includeEmptyNodes: boolean;

  /**
   * Creates a new AccountService instance.
   *
   * @param dataService - Service for fetching on-chain events
   * @param config - Configuration for the account service (either mnemonic or existing account)
   * @param config.mnemonic - Optional mnemonic for deterministic key generation
   * @param config.account - Optional existing account to initialize with
   * @param config.poolConcurrency - Optional maximum number of pools to fetch events for concurrently (default: 2)
   * @param config.includeEmptyNodes - Optional flag controlling whether empty (zero-value), migrated, and ragequit nodes are included in `getSpendableCommitments` (default: true)
   *
   * @throws {AccountError} If account initialization fails
   */
  constructor(
    private readonly dataService: DataService,
    config: AccountServiceConfig
  ) {
    this.logger = new Logger({ prefix: "Account" });
    this.poolConcurrency = config.poolConcurrency ?? 2;
    this.includeEmptyNodes = config.includeEmptyNodes ?? true;
    if ("mnemonic" in config) {
      this.account = this._initializeAccount(config.mnemonic);
    } else {
      this.account = config.account;
    }
  }

  /**
   * Initializes a new account from a mnemonic phrase for the legacy account.
   *
   * @param mnemonic - The mnemonic phrase to derive keys from
   * @returns A new PrivacyPoolAccount with derived master keys
   *
   * @remarks
   * This method derives two master keys from the mnemonic:
   * 1. A master nullifier key from account index 0
   * 2. A master secret key from account index 1
   * These keys are used to deterministically generate nullifiers and secrets for deposits and withdrawals.
   *
   * @throws {AccountError} If account initialization fails
   * @private
   */
  protected static _initializeLegacyAccount(mnemonic: string): PrivacyPoolAccount {
    try {

      const masterNullifierSeed = bytesToNumber(
        mnemonicToAccount(mnemonic, { accountIndex: 0 }).getHdKey().privateKey!
      );

      const masterSecretSeed = bytesToNumber(
        mnemonicToAccount(mnemonic, { accountIndex: 1 }).getHdKey().privateKey!
      );

      const masterNullifier = poseidon([BigInt(masterNullifierSeed)]) as Secret;
      const masterSecret = poseidon([BigInt(masterSecretSeed)]) as Secret;

      return {
        masterKeys: [masterNullifier, masterSecret],
        poolAccounts: new Map(),
        scopeStatus: new Map(),
        creationTimestamp: 0n,
        lastUpdateTimestamp: 0n,
      };
    } catch (error) {
      throw AccountError.accountInitializationFailed(
        error instanceof Error ? error.message : "Unknown error"
      );
    }
  }

  /**
   * Initializes a new account from a mnemonic phrase.
   *
   * @param mnemonic - The mnemonic phrase to derive keys from
   * @returns A new PrivacyPoolAccount with derived master keys
   *
   * @remarks
   * This method derives two master keys from the mnemonic:
   * 1. A master nullifier key from account index 0
   * 2. A master secret key from account index 1
   * These keys are used to deterministically generate nullifiers and secrets for deposits and withdrawals.
   *
   * @throws {AccountError} If account initialization fails
   * @private
   */
  private _initializeAccount(mnemonic: string): PrivacyPoolAccount {
    try {
      this.logger.debug("Initializing account with mnemonic");

      const { masterNullifier, masterSecret } = generateMasterKeys(mnemonic);

      return {
        masterKeys: [masterNullifier, masterSecret],
        poolAccounts: new Map(),
        scopeStatus: new Map(),
        creationTimestamp: 0n,
        lastUpdateTimestamp: 0n,
      };
    } catch (error) {
      throw AccountError.accountInitializationFailed(
        error instanceof Error ? error.message : "Unknown error"
      );
    }
  }

  /**
   * Generates a deterministic nullifier for a deposit.
   *
   * @param scope - The scope of the pool
   * @param index - The index of the deposit
   * @returns A deterministic nullifier for the deposit
   * @private
   */
  private _genDepositNullifier(scope: Hash, index: bigint): Secret {
    const [masterNullifier] = this.account.masterKeys;
    return poseidon([masterNullifier, scope, index]) as Secret;
  }

  /**
   * Generates a deterministic secret for a deposit.
   *
   * @param scope - The scope of the pool
   * @param index - The index of the deposit
   * @returns A deterministic secret for the deposit
   * @private
   */
  private _genDepositSecret(scope: Hash, index: bigint): Secret {
    const [, masterSecret] = this.account.masterKeys;
    return poseidon([masterSecret, scope, index]) as Secret;
  }

  /**
   * Generates a deterministic nullifier for a withdrawal.
   *
   * @param label - The label of the commitment
   * @param index - The index of the withdrawal
   * @returns A deterministic nullifier for the withdrawal
   * @private
   */
  private _genWithdrawalNullifier(label: Hash, index: bigint): Secret {
    const [masterNullifier] = this.account.masterKeys;
    return poseidon([masterNullifier, label, index]) as Secret;
  }

  /**
   * Generates a deterministic secret for a withdrawal.
   *
   * @param label - The label of the commitment
   * @param index - The index of the withdrawal
   * @returns A deterministic secret for the withdrawal
   * @private
   */
  private _genWithdrawalSecret(label: Hash, index: bigint): Secret {
    const [, masterSecret] = this.account.masterKeys;
    return poseidon([masterSecret, label, index]) as Secret;
  }

  /**
   * Hashes a commitment using the Poseidon hash function.
   *
   * @param value - The value of the commitment
   * @param label - The label of the commitment
   * @param precommitment - The precommitment hash
   * @returns The commitment hash
   * @private
   */
  private _hashCommitment(
    value: bigint,
    label: Hash,
    precommitment: Hash
  ): Hash {
    return poseidon([value, label, precommitment]) as Hash;
  }

  /**
   * Hashes a precommitment using the Poseidon hash function.
   *
   * @param nullifier - The nullifier for the commitment
   * @param secret - The secret for the commitment
   * @returns The precommitment hash
   * @private
   */
  private _hashPrecommitment(nullifier: Secret, secret: Secret): Hash {
    return poseidon([nullifier, secret]) as Hash;
  }

  /**
   * Gets the latest decrypted commitment of each account across all pools.
   *
   * @returns A map of scope to array of commitments
   *
   * @remarks
   * The result depends on the `includeEmptyNodes` option (default `true`):
   *
   * - When `includeEmptyNodes` is `true`, every account's latest commitment is
   *   returned, including empty (zero-value), migrated, and ragequit nodes.
   * - When `includeEmptyNodes` is `false`, only spendable commitments are
   *   returned. A commitment is spendable if it has a non-zero value and its
   *   account has not been ragequit or migrated.
   */
  public getSpendableCommitments(): Map<bigint, AccountCommitment[]> {
    const result = new Map<bigint, AccountCommitment[]>();

    for (const [scope, accounts] of this.account.poolAccounts.entries()) {
      const commitments: AccountCommitment[] = [];

      for (const account of accounts) {
        // When empty-node decryption is disabled, skip accounts that have been
        // ragequit or migrated — their value is no longer spendable from here.
        if (!this.includeEmptyNodes && (account.ragequit || account.isMigrated)) {
          continue;
        }

        const lastCommitment =
          account.children.length > 0
            ? account.children[account.children.length - 1]
            : account.deposit;

        // When empty-node decryption is disabled, drop zero-value commitments.
        if (this.includeEmptyNodes || lastCommitment!.value !== BigInt(0)) {
          commitments.push(lastCommitment!);
        }
      }

      if (commitments.length > 0) {
        result.set(scope, commitments);
      }
    }
    return result;
  }

  /**
   * Creates nullifier and secret for a new deposit
   *
   * @param scope - The scope of the pool to deposit into
   * @param index - Optional index for deterministic generation
   * @returns The nullifier, secret, and precommitment for the deposit
   *
   * @remarks
   * If no index is provided, it uses the current number of accounts for the scope.
   * The precommitment is a hash of the nullifier and secret, used in the deposit process.
   */
  public createDepositSecrets(
    scope: Hash,
    index?: bigint
  ): {
    nullifier: Secret;
    secret: Secret;
    precommitment: Hash;
  } {
    if (index !== undefined && index < 0n) {
      throw AccountError.invalidIndex(index);
    }

    if (index === undefined) {
      // Refuse to guess an index for a scope whose history is known to be
      // incomplete: the count would be understated and would collide with a
      // deposit index that is already in use on-chain. Callers that genuinely
      // want a specific index must pass it explicitly.
      if (!this._canInferDepositIndex(scope)) {
        throw AccountError.incompleteScopeHistory(scope, this.getScopeStatus(scope));
      }
      index = this._nextDepositIndex(scope);
    }

    const nullifier = this._genDepositNullifier(scope, index);
    const secret = this._genDepositSecret(scope, index);
    const precommitment = this._hashPrecommitment(nullifier, secret);

    return { nullifier, secret, precommitment };
  }

  /**
   * Total order over deposits sharing a precommitment: earliest block, then
   * earliest log within the block, then transaction hash as a final tie-break.
   *
   * `logIndex` is what makes this total — two deposits emitted by one
   * transaction share both `blockNumber` and `transactionHash`, so without it
   * the order would depend on log-fetch chunking and concurrency, and two
   * reconstructions of the same chain state could keep different deposits.
   * Plain string comparison is used rather than `localeCompare`, which is
   * locale- and ICU-version-dependent.
   */
  private static _compareDepositOrder(a: DepositEvent, b: DepositEvent): number {
    if (a.blockNumber !== b.blockNumber) return a.blockNumber < b.blockNumber ? -1 : 1;

    const aLog = a.logIndex ?? Number.MAX_SAFE_INTEGER;
    const bLog = b.logIndex ?? Number.MAX_SAFE_INTEGER;
    if (aLog !== bLog) return aLog < bLog ? -1 : 1;

    if (a.transactionHash === b.transactionHash) return 0;
    return a.transactionHash < b.transactionHash ? -1 : 1;
  }

  /**
   * Number of deposit indices already consumed for a scope.
   *
   * Counts only deposit-derived accounts and uses the recorded
   * `depositIndex` rather than array position, so migration-derived accounts
   * (which occupy no deposit index) cannot shift the result. Falls back to the
   * deposit-derived account count for accounts reconstructed before
   * `depositIndex` was recorded (e.g. restored history files).
   */
  private _nextDepositIndex(scope: Hash): bigint {
    const { maxDepositIndex, recordedIndices, depositDerivedCount } =
      this._tallyScopeAccounts(scope);

    // Prefer the recorded indices: monotonic, so an index already used is never
    // handed back even when earlier ones are unused (failed transactions leave
    // gaps).
    if (recordedIndices > 0) return maxDepositIndex + 1n;

    // Fallback for accounts reconstructed before `depositIndex` was recorded
    // (e.g. a restored history file): the deposit-derived count is the best
    // available estimate.
    return BigInt(depositDerivedCount);
  }

  /**
   * Single pass over a scope's accounts, tallying everything the deposit-index
   * and migration bookkeeping needs.
   *
   * `recordedIndices` counts DISTINCT recorded `depositIndex` values, not
   * accounts: several accounts can share one index, and counting accounts would
   * overstate the next index and open a gap wider than the scan's miss
   * tolerance — hiding the very deposits this bookkeeping exists to find.
   */
  private _tallyScopeAccounts(scope: Hash): {
    migrationDerivedCount: number;
    depositDerivedCount: number;
    recordedIndices: number;
    maxDepositIndex: bigint;
  } {
    const accounts = this.account.poolAccounts.get(scope) ?? [];
    const seenIndices = new Set<bigint>();
    let migrationDerivedCount = 0;
    let depositDerivedCount = 0;
    let maxDepositIndex = -1n;

    for (const account of accounts) {
      if (account.isMigrationDerived) {
        migrationDerivedCount++;
        continue;
      }

      depositDerivedCount++;
      if (account.depositIndex === undefined) continue;

      seenIndices.add(account.depositIndex);
      if (account.depositIndex > maxDepositIndex) {
        maxDepositIndex = account.depositIndex;
      }
    }

    return {
      migrationDerivedCount,
      depositDerivedCount,
      recordedIndices: seenIndices.size,
      maxDepositIndex,
    };
  }

  /** Number of migration-derived accounts reconstructed for a scope. */
  private _migrationDerivedCount(scope: Hash): number {
    return this._tallyScopeAccounts(scope).migrationDerivedCount;
  }

  /**
   * Load outcome for `scope`: `complete`, `incomplete`, or `not-loaded`.
   *
   * `not-loaded` is distinct from `complete` on purpose — a scope that was
   * never fetched tells us nothing, and treating it as complete is what lets a
   * deposit index be reused.
   */
  public getScopeStatus(scope: Hash): ScopeLoadStatus {
    return this.account.scopeStatus?.get(scope) ?? "not-loaded";
  }

  /**
   * Whether the reconstructed state for `scope` is complete.
   *
   * `false` for a scope that failed to load AND for one that was never
   * attempted; in both cases absent accounts must not be read as "no
   * accounts". Callers should block deposits and withdrawals for such scopes.
   */
  public isScopeComplete(scope: Hash): boolean {
    return this.getScopeStatus(scope) === "complete";
  }

  /** Scopes whose history failed to load during the last processing run. */
  public getIncompleteScopes(): Hash[] {
    if (!this.account.scopeStatus) return [];
    return [...this.account.scopeStatus.entries()]
      .filter(([, status]) => status === "incomplete")
      .map(([scope]) => scope);
  }

  /**
   * Records the load outcome for a scope on the underlying account.
   *
   * Written to `this.account`, which retry paths share with the service they
   * were derived from — so a scope reconstructed on retry stops reading as
   * incomplete on the caller's original service handle too.
   */
  private _setScopeStatus(scope: Hash, status: ScopeLoadStatus): void {
    if (!this.account.scopeStatus) this.account.scopeStatus = new Map();
    this.account.scopeStatus.set(scope, status);
  }

  /**
   * Whether an unspecified deposit index may be inferred for `scope`.
   *
   * Permitted when the scope loaded completely, and for an account that has
   * loaded nothing at all — a brand-new account genuinely has no history, so
   * index 0 is correct and refusing would block the first deposit. Refused once
   * anything has been loaded but this scope has not, since notes may exist here
   * that we have not seen.
   */
  private _canInferDepositIndex(scope: Hash): boolean {
    const status = this.getScopeStatus(scope);
    if (status === "complete") return true;
    if (status === "incomplete") return false;

    // Legacy account object with no status map: preserve prior behaviour.
    if (!this.account.scopeStatus) return true;

    // Nothing loaded yet — a fresh account.
    return this.account.scopeStatus.size === 0;
  }

  /**
   * Creates nullifier and secret for spending a commitment
   *
   * @param commitment - The commitment to spend
   * @returns The nullifier and secret for the new commitment
   *
   * @remarks
   * The index used for generating the withdrawal nullifier and secret is based on
   * the number of children the account already has, ensuring each withdrawal has
   * a unique nullifier.
   *
   * @throws {AccountError} If no account is found for the commitment
   */
  public createWithdrawalSecrets(commitment: AccountCommitment): {
    nullifier: Secret;
    secret: Secret;
  } {
    let index: bigint | undefined;

    for (const accounts of this.account.poolAccounts.values()) {
      const account = accounts.find((acc) => acc.label === commitment.label);
      if (account) {
        index = BigInt(account.children.length);
        break;
      }
    }

    if (index === undefined) {
      throw AccountError.commitmentNotFound(commitment.label);
    }

    const nullifier = this._genWithdrawalNullifier(commitment.label, index);
    const secret = this._genWithdrawalSecret(commitment.label, index);

    return { nullifier, secret };
  }

  /**
   * Adds a new pool account after depositing
   *
   * @param scope - The scope of the pool
   * @param value - The deposit value
   * @param nullifier - The nullifier used for the deposit
   * @param secret - The secret used for the deposit
   * @param label - The label for the commitment
   * @param blockNumber - The block number of the deposit
   * @param txHash - The transaction hash of the deposit
   * @returns The new pool account
   *
   * @remarks
   * This method creates a new account with the deposit commitment and adds it to the
   * pool accounts map under the specified scope. The commitment hash is calculated
   * from the value, label, and precommitment.
   */
  public addPoolAccount(
    scope: Hash,
    value: bigint,
    nullifier: Secret,
    secret: Secret,
    label: Hash,
    blockNumber: bigint,
    txHash: Hex,
    meta?: { depositIndex?: bigint; isMigrationDerived?: boolean }
  ): PoolAccount {
    const precommitment = this._hashPrecommitment(nullifier, secret);
    const commitment = this._hashCommitment(value, label, precommitment);

    const newAccount: PoolAccount = {
      label,
      deposit: {
        hash: commitment,
        value,
        label,
        nullifier,
        secret,
        blockNumber,
        txHash,
      },
      children: [],
      ...(meta?.depositIndex !== undefined ? { depositIndex: meta.depositIndex } : {}),
      ...(meta?.isMigrationDerived !== undefined
        ? { isMigrationDerived: meta.isMigrationDerived }
        : {}),
    };

    if (!this.account.poolAccounts.has(scope)) {
      this.account.poolAccounts.set(scope, []);
    }

    this.account.poolAccounts.get(scope)!.push(newAccount);

    this.logger.info(
      `Added new pool account with value ${value} and label ${label}`
    );

    return newAccount;
  }

  /**
   * Adds a new commitment to the account after spending
   *
   * @param parentCommitment - The commitment that was spent
   * @param value - The remaining value after spending
   * @param nullifier - The nullifier used for spending
   * @param secret - The secret used for spending
   * @param blockNumber - The block number of the withdrawal
   * @param txHash - The transaction hash of the withdrawal
   * @returns The new commitment
   *
   * @remarks
   * This method finds the account containing the parent commitment, creates a new
   * commitment with the provided parameters, and adds it to the account's children.
   * The new commitment inherits the label from the parent commitment.
   *
   * @throws {AccountError} If no account is found for the commitment
   */
  public addWithdrawalCommitment(
    parentCommitment: AccountCommitment,
    value: bigint,
    nullifier: Secret,
    secret: Secret,
    blockNumber: bigint,
    txHash: Hex
  ): AccountCommitment {
    let foundAccount: PoolAccount | undefined;
    let foundScope: bigint | undefined;

    for (const [scope, accounts] of this.account.poolAccounts.entries()) {
      foundAccount = accounts.find((account) => {
        if (account.deposit.hash === parentCommitment.hash) return true;
        return account.children.some(
          (child) => child.hash === parentCommitment.hash
        );
      });

      if (foundAccount) {
        foundScope = scope;
        break;
      }
    }

    if (!foundAccount || !foundScope) {
      throw AccountError.commitmentNotFound(parentCommitment.hash);
    }

    const precommitment = this._hashPrecommitment(nullifier, secret);
    const newCommitment: AccountCommitment = {
      hash: this._hashCommitment(value, parentCommitment.label, precommitment),
      value,
      label: parentCommitment.label,
      nullifier,
      secret,
      blockNumber,
      txHash,
    };

    foundAccount.children.push(newCommitment);

    this.logger.info(
      `Added new commitment with value ${value} to account with label ${parentCommitment.label}`
    );

    return newCommitment;
  }

  /**
   * Adds a new commitment to the account after migrate
   *
   * @param parentCommitment - The commitment that was spent
   * @param value - The remaining value after spending
   * @param nullifier - The nullifier used for migrate
   * @param secret - The secret used for migrate
   * @param blockNumber - The block number of the withdrawal
   * @param txHash - The transaction hash of the withdrawal
   * @returns The new commitment
   *
   * @remarks
   * This method finds the account containing the parent commitment, creates a new
   * commitment with the provided parameters, and adds it to the account's children.
   * The new commitment inherits the label from the parent commitment.
   *
   * @throws {AccountError} If no account is found for the commitment
   */
  public addMigrationCommitment(
    parentCommitment: AccountCommitment,
    value: bigint,
    nullifier: Secret,
    secret: Secret,
    blockNumber: bigint,
    txHash: Hex
  ): AccountCommitment {
    let foundAccount: PoolAccount | undefined;
    let foundScope: bigint | undefined;

    for (const [scope, accounts] of this.account.poolAccounts.entries()) {
      foundAccount = accounts.find((account) => {
        if (account.deposit.hash === parentCommitment.hash) return true;
        return account.children.some(
          (child) => child.hash === parentCommitment.hash
        );
      });

      if (foundAccount) {
        foundScope = scope;
        break;
      }
    }

    if (!foundAccount || !foundScope) {
      throw AccountError.commitmentNotFound(parentCommitment.hash);
    }

    const precommitment = this._hashPrecommitment(nullifier, secret);
    const newCommitment: AccountCommitment = {
      hash: this._hashCommitment(value, parentCommitment.label, precommitment),
      value,
      label: parentCommitment.label,
      nullifier,
      secret,
      blockNumber,
      txHash,
      isMigration: true
    };

    foundAccount.children.push(newCommitment);
    foundAccount.isMigrated = true;

    this.logger.info(
      `Added new commitment with value ${value} to account with label ${parentCommitment.label}`
    );

    return newCommitment;
  }

  /**
   * Adds a ragequit event to an existing pool account
   *
   * @param label - The label of the account to add the ragequit to
   * @param ragequit - The ragequit event to add
   * @returns The updated pool account
   *
   * @remarks
   * When an account has a ragequit event, it can no longer be spent.
   * This method finds the account with the matching label and attaches
   * the ragequit event to it.
   *
   * @throws {AccountError} If no account is found with the given label
   */
  public addRagequitToAccount(
    label: Hash,
    ragequit: RagequitEvent
  ): PoolAccount {
    let foundAccount: PoolAccount | undefined;
    let foundScope: Hash | undefined;

    // Find the account with the matching label
    for (const [scope, accounts] of this.account.poolAccounts.entries()) {
      foundAccount = accounts.find((account) => account.label === label);
      if (foundAccount) {
        foundScope = scope;
        break;
      }
    }

    if (!foundAccount || !foundScope) {
      throw new AccountError(
        `No account found with label ${label}`,
        ErrorCode.INVALID_INPUT
      );
    }

    // Add the ragequit event to the account
    foundAccount.ragequit = ragequit;

    this.logger.info(
      `Added ragequit event to account with label ${label}, value ${ragequit.value}`
    );

    return foundAccount;
  }

  /**
   * Fetches deposit events for a given pool, keyed by precommitment for
   * efficient lookup during reconstruction.
   *
   * @param pool - The pool to fetch deposit events for
   *
   * @returns A map of precommitment to the earliest deposit carrying it
   *
   * @remarks
   * Exactly one event per precommitment. A precommitment is derived from
   * (masterKeys, scope, depositIndex), so two deposits collide only when the
   * same index was used twice — and since the deposit nullifier shares that
   * derivation, the colliding deposits also share a nullifier hash. The pool
   * marks a nullifier hash spent on first withdrawal (`State.sol` reverts
   * `NullifierAlreadySpent` afterwards), so at most one of them is ever
   * withdrawable. Reconstructing both as spendable accounts would overstate the
   * balance and, because a single withdrawal event then matches every one of
   * them, produce negative-value commitments. The earliest deposit is kept and
   * the collision is logged with its transaction hashes so affected accounts
   * can be found and handled deliberately.
   */
  public async getDepositEvents(
    pool: PoolInfo
  ): Promise<Map<Hash, DepositEvent>> {
    try {
      const depositEvents = await this.dataService.getDeposits(pool);

      this.logger.info(`Found deposits for pool`, {
        poolAddress: pool.address,
        poolChainId: pool.chainId,
        depositCount: depositEvents.length,
      });

      const depositMap = new Map<Hash, DepositEvent>();
      const collisions = new Map<Hash, DepositEvent[]>();

      for (const event of depositEvents) {
        const existing = depositMap.get(event.precommitment);

        if (!existing) {
          depositMap.set(event.precommitment, event);
          continue;
        }

        // Track every colliding deposit, including the one already kept, so the
        // warning below reports the full set.
        const group = collisions.get(event.precommitment);
        if (group) {
          group.push(event);
        } else {
          collisions.set(event.precommitment, [existing, event]);
        }

        if (AccountService._compareDepositOrder(event, existing) < 0) {
          depositMap.set(event.precommitment, event);
        }
      }

      for (const [precommitment, group] of collisions.entries()) {
        group.sort(AccountService._compareDepositOrder);
        this.logger.warn(
          `Multiple deposits share one precommitment — the same deposit index was used more than once. ` +
          `They also share a nullifier hash, so only the first to be withdrawn can ever be spent; ` +
          `reconstruction keeps the earliest and ignores the rest.`,
          {
            precommitment,
            scope: pool.scope,
            count: group.length,
            keptTxHash: group[0]!.transactionHash,
            ignoredTxHashes: group.slice(1).map((e) => e.transactionHash),
          }
        );
      }

      return depositMap;
    } catch (error) {
      throw EventError.depositEventError(
        pool.chainId,
        pool.scope,
        error as Error
      );
    }
  }

  /**
   * Fetches withdrawal events for a given pool and returns a map of spent nullifiers to their events for efficient lookup
   *
   * @param pool - The pool to fetch withdrawal events for
   *
   * @returns A map of spent nullifiers to their events
   */
  public async getWithdrawalEvents(
    pool: PoolInfo
  ): Promise<Map<Hash, WithdrawalEvent>> {
    try {
      const withdrawalEvents = await this.dataService.getWithdrawals(pool);
      const withdrawalMap = new Map<Hash, WithdrawalEvent>();
      for (const event of withdrawalEvents) {
        withdrawalMap.set(event.spentNullifier, event);
      }

      return withdrawalMap;
    } catch (error) {
      throw EventError.withdrawalEventError(
        pool.chainId,
        pool.scope,
        error as Error
      );
    }
  }

  /**
   * Fetches ragequit events for a given pool and returns a map of ragequit labels to their events for efficient lookup
   *
   * @param pool - The pool to fetch ragequit events for
   *
   * @returns A map of ragequit labels to their events
   */
  public async getRagequitEvents(
    pool: PoolInfo
  ): Promise<Map<Hash, RagequitEvent>> {
    try {
      const ragequitEvents = await this.dataService.getRagequits(pool);
      const ragequitMap = new Map<Hash, RagequitEvent>();
      for (const event of ragequitEvents) {
        ragequitMap.set(event.label, event);
      }

      return ragequitMap;
    } catch (error) {
      throw EventError.ragequitEventError(
        pool.chainId,
        pool.scope,
        error as Error
      );
    }
  }

  /**
   * Fetches events for a given set of pools
   *
   * @param pools - The pools to fetch events for
   *
   * @returns A map of pool scopes to their events
   */
  public async getEvents(pools: PoolInfo[]): Promise<PoolEventsResult> {
    const events: PoolEventsResult = new Map();

    // Use mapLimit to control concurrency at pool level
    const poolEventResults = await mapLimit(
      pools,
      this.poolConcurrency,
      async (pool: PoolInfo) => {
        try {
          this.logger.info(`Fetching events for pool`, {
            poolAddress: pool.address,
            poolChainId: pool.chainId,
            poolDeploymentBlock: pool.deploymentBlock,
          });

          const [depositEvents, withdrawalEvents, ragequitEvents] =
            await Promise.all([
              this.getDepositEvents(pool),
              this.getWithdrawalEvents(pool),
              this.getRagequitEvents(pool),
            ]);

          return {
            status: "fulfilled" as const,
            value: {
              scope: pool.scope,
              depositEvents,
              withdrawalEvents,
              ragequitEvents,
            },
          };
        } catch (error) {
          return {
            status: "rejected" as const,
            reason: error as Error,
          };
        }
      }
    );

    for (const result of poolEventResults) {
      if (result.status === "fulfilled") {
        const { scope, depositEvents, withdrawalEvents, ragequitEvents } =
          result.value;
        events.set(scope, {
          depositEvents,
          withdrawalEvents,
          ragequitEvents,
        });
      } else {
        const errorWithDetails = result.reason as Error & { details?: { scope?: Hash } };
        const scope = errorWithDetails.details?.scope as Hash;

        events.set(scope, {
          reason: result.reason.message,
          scope: scope,
        });
      }
    }

    return events;
  }

  /**
   * Processes deposit events for a given scope and adds them to the account
   * Deterministically generate deposit secrets and check if they match on-chain deposits
   *
   * @param scope - The scope of the pool
   * @param depositEvents - Deposit events keyed by precommitment
   *
   */
  private _processDepositEvents(
    scope: Hash,
    depositEvents: Map<Hash, DepositEvent>,
    startIndex: bigint = 0n,
    extraMissTolerance: number = 0,
  ): void {
    // Large enough to avoid tx failures, plus headroom for indices skipped by
    // historical off-by-migration-count deposits (see `_processEvents`).
    const MAX_CONSECUTIVE_MISSES = 10 + extraMissTolerance;

    let consecutiveMisses = 0;

    for (let index = startIndex; ; index++) {
      // Generate nullifier, secret, and precommitment for this index
      const { nullifier, secret, precommitment } = this.createDepositSecrets(
        scope,
        index
      );

      // Look for a deposit with this precommitment
      const event = depositEvents.get(precommitment);

      if (!event) {
        consecutiveMisses++;
        if (consecutiveMisses >= MAX_CONSECUTIVE_MISSES) {
          break;
        }
        continue;
      }

      // Can reset counter in case if user had any tx failures for
      // newer deposits
      consecutiveMisses = 0;

      // Create a new pool account for this deposit, recording the derivation
      // index so the next index never has to be inferred from array position.
      this.addPoolAccount(
        scope,
        event.value,
        nullifier,
        secret,
        event.label,
        event.blockNumber,
        event.transactionHash,
        { depositIndex: index }
      );

      this.logger.debug(`Found deposit at index ${index} for scope ${scope}`);
    }
  }

  /**
   * Processes withdrawal events for a given scope and adds them to the account
   *
   * @param scope - The scope of the pool
   * @param withdrawalEvents - The map of withdrawal events
   *
   * @remarks
   * This method performs the following steps for each pool:
   * 1. Identifies the earliest deposit block for each scope
   * 2. For each account, reconstructs the withdrawal history by:
   *    - Generating nullifiers sequentially
   *    - Matching them against on-chain events
   *    - Adding matched withdrawals to the account state
   *
   * @throws {DataError} If event fetching fails
   * @private
   *
   */
  private _processWithdrawalEvents(
    scope: Hash,
    withdrawalEvents: Map<Hash, WithdrawalEvent>
  ): void {
    const accounts = this.account.poolAccounts.get(scope);

    // Skip if no accounts for this scope
    if (!accounts || accounts.length === 0) {
      this.logger.info(`No accounts found for pool with this scope`, {
        scope,
      });

      return;
    }

    // Process each account in parallel for better performance
    for (const account of accounts) {
      let currentCommitment = account.deposit;
      let index = BigInt(account.children.length);

      // Continue processing withdrawals until no more are found sequentially
      while (true) {
        // Generate nullifier for this withdrawal
        const nullifierHash = poseidon([currentCommitment.nullifier]) as Hash;

        // Look for a withdrawal event with this nullifier
        const withdrawal = withdrawalEvents.get(nullifierHash);
        if (!withdrawal) {
          break;
        }

        const remainingValue = currentCommitment.value - withdrawal.withdrawn;

        // Generate secret for this withdrawal
        const nullifier = this._genWithdrawalNullifier(account.label, index);
        const secret = this._genWithdrawalSecret(account.label, index);
        const precommitment = this._hashPrecommitment(nullifier, secret);
        const accountCommitment = this._hashCommitment(remainingValue, currentCommitment.label, precommitment)
        
        
        // If the locally-computed hash doesn't match the on-chain commitment,
        // the withdrawal was performed with different keys (e.g. migration from
        // legacy to safe keys). Mark the child as unspendable from this account.
        if (accountCommitment !== withdrawal.newCommitment) {
          this.logger.info(
            `Withdrawal commitment hash mismatch — marking as unspendable (migrated with different keys)`,
            { label: currentCommitment.label, expected: withdrawal.newCommitment, computed: accountCommitment }
          );
          
          // Add the withdrawal commitment to the account
          const migrationCommitment = this.addMigrationCommitment(
            currentCommitment,
            remainingValue,
            nullifier,
            secret,
            withdrawal.blockNumber,
            withdrawal.transactionHash
          );    

          currentCommitment = migrationCommitment;
        } else {
          // Add the withdrawal commitment to the account
          const withdrawalCommitment = this.addWithdrawalCommitment(
            currentCommitment,
            remainingValue,
            nullifier,
            secret,
            withdrawal.blockNumber,
            withdrawal.transactionHash
          );

          currentCommitment = withdrawalCommitment;
        }

        // Increment index for next potential withdrawal
        index++;
      }
    }
  }

  /**
   * Processes ragequit events for a given scope and adds them to the account
   *
   * @param scope - The scope of the pool
   * @param ragequitEvents - The map of ragequit events
   *
   * @remarks
   * This method performs the following steps for each pool:
   * 1. Adds ragequit events to accounts if found
   *
   * @throws {DataError} If event fetching fails
   * @private
   *
   */
  private _processRagequitEvents(
    scope: Hash,
    ragequitEvents: Map<Hash, RagequitEvent>
  ): void {
    const accounts = this.account.poolAccounts.get(scope);

    if (!accounts || accounts.length === 0) {
      this.logger.info(`No accounts found for pool with this scope`, {
        scope,
      });

      return;
    }

    for (const account of accounts) {
      const ragequit = ragequitEvents.get(account.label);
      if (ragequit) {
        this.addRagequitToAccount(account.label, ragequit);
      }
    }
  }

  /**
   * Discovers commitments that were migrated from legacy accounts via 0-value withdrawal.
   *
   * @param scope - The scope of the pool
   * @param legacyAccounts - The legacy pool accounts for this scope
   * @param withdrawalEvents - The map of withdrawal events (keyed by spentNullifier)
   *
   * @remarks
   * When a legacy account performs a 0-value withdrawal to rotate keys (migration),
   * the resulting on-chain commitment is created with safe keys. This method finds
   * those commitments by:
   * 1. Identifying legacy accounts with the `isMigrated` flag (set by `addMigrationCommitment`)
   * 2. Computing the expected commitment hash using safe keys at withdrawal index 0
   * 3. Verifying the hash exists in on-chain withdrawal events
   * 4. Adding verified commitments as new safe pool accounts
   *
   * @private
   */
  private _discoverMigratedCommitments(
    scope: Hash,
    legacyAccounts: PoolAccount[],
    withdrawalEvents: Map<Hash, WithdrawalEvent>
  ): void {
    // Build reverse lookup: newCommitment hash → WithdrawalEvent
    const newCommitmentMap = new Map<Hash, WithdrawalEvent>();
    for (const event of withdrawalEvents.values()) {
      newCommitmentMap.set(event.newCommitment, event);
    }

    for (const legacyAccount of legacyAccounts) {
      // Skip if not flagged as migrated (set by addMigrationCommitment)
      if (!legacyAccount.isMigrated) continue;

      const migrationChild = legacyAccount.children.find(c => c.isMigration);
      if (!migrationChild) continue;

      const label = legacyAccount.label;

      // The migration child's value is the remaining value carried forward.
      // Zero-value migrations (full withdrawal + key rotation) are valid and
      // must still be registered so that poolAccounts.length reflects the
      // correct slot count for deposit index alignment in step C.
      const remainingValue = migrationChild.value;

      // Generate safe nullifier/secret at withdrawal index 0
      const nullifier = this._genWithdrawalNullifier(label, 0n);
      const secret = this._genWithdrawalSecret(label, 0n);

      // Compute expected commitment hash
      const precommitment = this._hashPrecommitment(nullifier, secret);
      const expectedHash = this._hashCommitment(remainingValue, label, precommitment);

      // Verify hash exists in withdrawal events' newCommitment
      const withdrawalEvent = newCommitmentMap.get(expectedHash);
      if (!withdrawalEvent) continue;

      // Verified — add as a new safe pool account
      const newAccount = this.addPoolAccount(
        scope,
        remainingValue,
        nullifier,
        secret,
        label,
        withdrawalEvent.blockNumber,
        withdrawalEvent.transactionHash,
        { isMigrationDerived: true },
      );

      this.addWithdrawalCommitment(
        newAccount.deposit,
        remainingValue,
        nullifier,
        secret,
        withdrawalEvent.blockNumber,
        withdrawalEvent.transactionHash,
      )

      this.logger.info(
        `Discovered migrated commitment for label ${label} with value ${remainingValue}`,
      );
    }
  }

  /**
   * Initializes an AccountService instance with events for a given set of pools
   *
   * @param dataService - The data service to use for fetching events
   * @param source - The source to use for initializing the account. Either a mnemonic or an existing account service instance
   * @param pools - The pools to fetch events for
   * @param options - Optional behavioral configuration applied to the constructed account(s), e.g. `includeEmptyNodes` and `poolConcurrency`
   *
   * @remarks
   * This method performs the following steps for each pool:
   * 1. Fetches deposit, withdrawal, and ragequit events for each pool
   * 2. Processes deposit events and creates pool accounts
   * 3. Processes withdrawal events and adds commitments to pool accounts
   * 4. Processes ragequit events and adds ragequit to pool accounts
   *
   * @returns The initialized AccountService instance and array of errors if any pool events fetching fails
   *
   * If any pool's event fetching fails, the account is initialized without the
   * events for that pool and the scope is recorded as incomplete (see
   * {@link AccountService.isScopeComplete}). Reconstructed state for such a
   * scope is absent, NOT empty — callers must not read it as "no accounts".
   *
   * To retry, call this method again with `{ service, legacyService }` — both
   * values returned by the original `{ mnemonic }` call. Passing
   * `legacyService` keeps the retry migration-aware; omitting it reconstructs
   * the retried scopes without migration discovery.
   *
   * @throws {AccountError} If account state reconstruction fails or if duplicate pools are found
   */
  static async initializeWithEvents(
    dataService: DataService,
    source:
      | {
        mnemonic: string;
      }
      | {
        service: AccountService;
        /**
         * The legacy-key service returned alongside `service` by the original
         * `{ mnemonic }` call. Pass it so a retry stays migration-aware:
         * without it the retried scopes are reconstructed with no migration
         * discovery, which silently omits migration-derived accounts and
         * produces a different — also incomplete — view of the same account.
         */
        legacyService?: AccountService;
      },
    pools: PoolInfo[],
    options?: AccountServiceOptions
  ): Promise<{ account: AccountService; legacyAccount?: AccountService; errors: PoolEventsError[] }> {
    // Log the start of the history retrieval process
    const logger = new Logger({ prefix: "Account" });
    logger.info(`Fetching events for pools`, { poolLength: pools.length });

    // verify that pools don't contain duplicates based on scope
    const uniqueScopes = new Set<bigint>();
    for (const pool of pools) {
      if (uniqueScopes.has(pool.scope)) {
        throw AccountError.duplicatePools(pool.scope);
      }
      uniqueScopes.add(pool.scope);
    }

    // Retry path: reuse the existing service's account and only reprocess
    // scopes that actually still need it, to avoid duplicate deposits and
    // withdrawal misclassification.
    //
    // When the caller passes `legacyService`, the retry runs the same
    // migration-aware pipeline as the mnemonic path. Without it the retry can
    // only do simple deposit/withdrawal/ragequit processing, which omits
    // migration-derived accounts for the retried scopes.
    if (!('mnemonic' in source)) {
      const account = new AccountService(
        dataService,
        { account: source.service.account, ...options }
      );

      // Decide per scope whether it still needs processing:
      //
      //  - `incomplete`  — it failed; retry it.
      //  - `complete`    — skip, even if it matched no commitments. The old
      //                    `!poolAccounts.has(scope)` proxy could not tell this
      //                    case from "never attempted", so it re-ran the legacy
      //                    scan and duplicated that scope's accounts on every
      //                    retry.
      //  - `not-loaded`  — process it if it has no reconstructed accounts. A
      //                    pool newly added to `pools` lands here and must not
      //                    be silently dropped. Accounts present without a
      //                    recorded status mean state restored by an older
      //                    version, so fall back to the proxy and skip rather
      //                    than risk duplicating them.
      //
      // Status lives on the shared `PrivacyPoolAccount`, so marking a scope
      // complete here is visible on the caller's original service too.
      const existingScopes = source.service.account.poolAccounts;
      const newPools = pools.filter((p) => {
        const status = account.getScopeStatus(p.scope);
        if (status === "complete") return false;
        if (status === "incomplete") return true;
        return !existingScopes.has(p.scope);
      });

      const legacyAccount = source.legacyService;
      const errors = await account._processEvents(newPools, legacyAccount);
      return { account, legacyAccount, errors };
    }

    // Mnemonic path: phased processing with migration discovery
    const account = new AccountService(dataService, { mnemonic: source.mnemonic, ...options });
    const legacyPrivacyPoolAccount = AccountService._initializeLegacyAccount(source.mnemonic);
    const legacyAccount = new AccountService(dataService, { account: legacyPrivacyPoolAccount, ...options });

    const errors = await account._processEvents(pools, legacyAccount);
    return { account, legacyAccount, errors };
  }

  /**
   * Fetches and processes events for a set of pools.
   *
   * When a legacyAccount is provided, the full migration-aware pipeline runs
   * for each scope:
   *   1. Legacy account: process deposits and withdrawals (to detect migrations)
   *   2. Safe account: discover migrated commitments from the legacy accounts
   *   3. Safe account (this): process deposits, always scanning from index 0
   *   4. Safe account: process withdrawals (now includes migrated accounts)
   *   5. Both accounts: process ragequits
   *
   * Step 3 always scans from index 0. Deposit indices and migration-derived
   * accounts live in separate namespaces — deposit indices are never offset by
   * the number of migrations — so starting the scan at the migrated-account
   * count silently skips any deposit made while fewer migrations were visible
   * (a scope whose history failed to load, or a deposit placed between two
   * staged migrations). The miss tolerance is widened by the migration count
   * instead, which bridges gaps left by older versions that did offset the
   * index without ever skipping a real deposit.
   *
   * Without a legacyAccount, only steps 3, 4, and 5 run (simple processing).
   *
   * Per-scope errors are caught and returned rather than thrown, and any
   * partial state left by a mid-scope failure is cleaned from both accounts
   * so that a subsequent retry starts fresh for that scope.
   */
  private async _processEvents(
    pools: PoolInfo[],
    legacyAccount?: AccountService,
  ): Promise<PoolEventsError[]> {
    const errors: PoolEventsError[] = [];

    const events = await this.getEvents(pools);

    for (const [scope, result] of events.entries()) {
      if ("reason" in result) {
        this._setScopeStatus(scope, "incomplete");
        errors.push(result);
      } else {
        try {
          // a. Legacy: process deposits + withdrawals
          if (legacyAccount) {
            legacyAccount._processDepositEvents(scope, result.depositEvents);
            legacyAccount._processWithdrawalEvents(scope, result.withdrawalEvents);
          }

          // b. Safe: discover migrated commitments from legacy accounts.
          //    Must run before safe deposit scanning so that the migrated
          //    account count can serve as the starting index for step (c),
          //    avoiding a gap of consecutive misses over legacy-key indices.
          if (legacyAccount) {
            const legacyAccounts = legacyAccount.account.poolAccounts.get(scope) ?? [];
            this._discoverMigratedCommitments(scope, legacyAccounts, result.withdrawalEvents);
          }

          // c. Safe: process deposits. ALWAYS scan from index 0 — deposit
          //    indices live in their own namespace and are never offset by the
          //    number of migration-derived accounts. Starting the scan at the
          //    migrated-account count silently skips any deposit made while
          //    fewer migrations were visible (failed history load, or a
          //    deposit placed between two staged migrations).
          //
          //    Historical deposits may still sit at an offset index because
          //    older versions derived the index from poolAccounts.length, so
          //    widen the miss tolerance by the migration count to bridge the
          //    resulting gap.
          this._processDepositEvents(
            scope,
            result.depositEvents,
            0n,
            this._migrationDerivedCount(scope),
          );

          // d. Safe: process withdrawals (now includes migrated accounts)
          this._processWithdrawalEvents(scope, result.withdrawalEvents);

          // e. Both: process ragequits
          if (legacyAccount) {
            legacyAccount._processRagequitEvents(scope, result.ragequitEvents);
          }
          this._processRagequitEvents(scope, result.ragequitEvents);

          this._setScopeStatus(scope, "complete");
        } catch (e) {
          this.account.poolAccounts.delete(scope);
          legacyAccount?.account.poolAccounts.delete(scope);
          this._setScopeStatus(scope, "incomplete");
          errors.push({
            reason: e instanceof Error ? e.message : String(e),
            scope,
          });
        }
      }
    }

    return errors;
  }

  /**
   * @deprecated Use `initializeWithEvents` for instantiating an account with history reconstruction
   * Retrieves the history of deposits and withdrawals for the given pools.
   *
   * @param pools - Array of pool configurations to sync history for
   *
   * @remarks
   * This method performs the following steps:
   * 1. Initializes pool accounts for each pool if they don't exist
   * 2. For each pool, fetches deposit events and reconstructs accounts
   * 3. Processes withdrawals and ragequits to update account state
   *
   * The account reconstruction is deterministic based on the master keys,
   * allowing the full state to be recovered from on-chain events.
   *
   * @throws {DataError} If event fetching fails
   * @throws {AccountError} If account state reconstruction fails
   */
  public async retrieveHistory(pools: PoolInfo[]): Promise<void> {
    // Log the start of the history retrieval process
    this.logger.info(`Fetching events for ${pools.length} pools`);

    // Initialize pool accounts map for each pool if it doesn't exist
    for (const pool of pools) {
      if (!this.account.poolAccounts.has(pool.scope)) {
        this.account.poolAccounts.set(pool.scope, []);
      }
    }

    // Process all pools in parallel for better performance
    await Promise.all(
      pools.map(async (pool) => {
        // Log which pool is being processed
        this.logger.info(
          `Processing pool ${pool.address} on chain ${pool.chainId} from block ${pool.deploymentBlock}`
        );

        // Fetch all deposit events for this pool
        const deposits = await this.dataService.getDeposits(pool);

        this.logger.info(
          `Found ${deposits.length} deposits for pool ${pool.address}`
        );

        // Create a map of deposits by precommitment for efficient lookup.
        // Keep the earliest on collision, matching `getDepositEvents`, so both
        // reconstruction paths agree on which deposit is the spendable one.
        const depositMap = new Map<Hash, DepositEvent>();
        for (const deposit of deposits) {
          const existing = depositMap.get(deposit.precommitment);
          if (!existing || AccountService._compareDepositOrder(deposit, existing) < 0) {
            depositMap.set(deposit.precommitment, deposit);
          }
        }

        // Track found deposits for logging and debugging
        const foundDeposits: Array<{
          index: bigint;
          nullifier: Secret;
          secret: Secret;
          pool: PoolInfo;
          deposit: (typeof deposits)[0];
        }> = [];

        // Start with index 0 and try to find deposits deterministically
        let index = BigInt(0);
        let firstDepositBlock: bigint | undefined;

        // Deterministically generate deposit secrets and check if they match on-chain deposits
        while (true) {
          // Generate nullifier, secret, and precommitment for this index
          const nullifier = this._genDepositNullifier(pool.scope, index);
          const secret = this._genDepositSecret(pool.scope, index);
          const precommitment = this._hashPrecommitment(nullifier, secret);

          // Look for a deposit with this precommitment
          const deposit = depositMap.get(precommitment);
          if (!deposit) break; // No more deposits found, exit the loop

          // Track the earliest deposit block for later withdrawal processing
          if (!firstDepositBlock || deposit.blockNumber < firstDepositBlock) {
            firstDepositBlock = deposit.blockNumber;
          }

          // Create a new pool account for this deposit
          this.addPoolAccount(
            pool.scope,
            deposit.value,
            nullifier,
            secret,
            deposit.label,
            deposit.blockNumber,
            deposit.transactionHash,
            { depositIndex: index }
          );

          // Track the found deposit
          foundDeposits.push({ index, nullifier, secret, pool, deposit });

          // Move to the next index
          index++;
        }

        // If no accounts were found for this scope, log and skip further processing
        if (this.account.poolAccounts.get(pool.scope)!.length === 0) {
          this.logger.info(
            `No Pool Accounts were found for scope ${pool.scope}`
          );
          return;
        }

        this.logger.info(
          `Found ${foundDeposits.length} deposits for pool ${pool.address}`
        );
      })
    );

    // Process withdrawals and ragequits for all pools
    // This is done after all deposits are processed to ensure we have the complete account state
    await this._processWithdrawalsAndRagequits(pools);
  }

  /**
   * Processes withdrawal events for all pools and updates account state.
   *
   * @param pools - Array of pool configurations to process withdrawals for
   *
   * @remarks
   * This method performs the following steps for each pool:
   * 1. Identifies the earliest deposit block for each scope
   * 2. Fetches withdrawal and ragequit events from that block
   * 3. Maps withdrawals by nullifier hash and ragequits by label for efficient lookup
   * 4. For each account, reconstructs the withdrawal history by:
   *    - Generating nullifiers sequentially
   *    - Matching them against on-chain events
   *    - Adding matched withdrawals to the account state
   * 5. Adds ragequit events to accounts if found
   *
   * @throws {DataError} If event fetching fails
   * @private
   */
  private async _processWithdrawalsAndRagequits(
    pools: PoolInfo[]
  ): Promise<void> {
    await Promise.all(
      pools.map(async (pool) => {
        const accounts = this.account.poolAccounts.get(pool.scope);

        // Skip if no accounts for this scope
        if (!accounts || accounts.length === 0) {
          this.logger.info(
            `No accounts found for pool ${pool.address} with scope ${pool.scope}`
          );
          return;
        }

        // Find the earliest deposit block for this scope
        let firstDepositBlock = BigInt(Number.MAX_SAFE_INTEGER);
        for (const account of accounts) {
          if (account.deposit.blockNumber < firstDepositBlock) {
            firstDepositBlock = account.deposit.blockNumber;
          }
        }

        // Fetch withdrawal and ragequit events from the first deposit block
        const withdrawals = await this.dataService.getWithdrawals(
          pool,
          firstDepositBlock
        );
        const ragequits = await this.dataService.getRagequits(
          pool,
          firstDepositBlock
        );

        this.logger.info(
          `Found ${withdrawals.length} withdrawals for pool ${pool.address}`
        );

        if (withdrawals.length === 0 && ragequits.length === 0) {
          return;
        }

        // Map withdrawals by spent nullifier for quick lookup
        const withdrawalMap = new Map<Hash, WithdrawalEvent>();
        for (const withdrawal of withdrawals) {
          withdrawalMap.set(withdrawal.spentNullifier, withdrawal);
        }

        // Map ragequits by label for quick lookup
        const ragequitMap = new Map<Hash, RagequitEvent>();
        for (const ragequit of ragequits) {
          ragequitMap.set(ragequit.label, ragequit);
        }

        // Process each account
        for (const account of accounts) {
          let currentCommitment = account.deposit;
          let index = BigInt(0);

          // Continue processing withdrawals until no more are found
          while (true) {
            // Generate nullifier for this withdrawal
            const nullifierHash = poseidon([
              currentCommitment.nullifier,
            ]) as Hash;

            // Look for a withdrawal event with this nullifier
            const withdrawal = withdrawalMap.get(nullifierHash);
            if (!withdrawal) {
              break;
            }

            // Generate secret for this withdrawal
            const nullifier = this._genWithdrawalNullifier(
              account.label,
              index
            );
            const secret = this._genWithdrawalSecret(account.label, index);

            // Add the withdrawal commitment to the account
            const newCommitment = this.addWithdrawalCommitment(
              currentCommitment,
              currentCommitment.value - withdrawal.withdrawn,
              nullifier,
              secret,
              withdrawal.blockNumber,
              withdrawal.transactionHash
            );

            // Update current commitment to the newly created one
            currentCommitment = newCommitment;

            // Increment index for next potential withdrawal
            index++;
          }

          const ragequit = ragequitMap.get(account.label);
          if (ragequit) {
            this.addRagequitToAccount(account.label, ragequit);
          }
        }
      })
    );
  }
}
