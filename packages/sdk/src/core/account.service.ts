import { poseidon } from "maci-crypto/build/ts/hashing.js";
import { Hash, Secret } from "../types/commitment.js";
import { Hex, bytesToNumber } from "viem";
import { mnemonicToAccount } from "viem/accounts";
import { DataService } from "./data.service.js";
import {
  AccountCommitment,
  PoolAccount,
  PoolInfo,
  PrivacyPoolAccount,
} from "../types/account.js";
import {
  DepositEvent,
  RagequitEvent,
  WithdrawalEvent,
} from "../types/events.js";
import { Logger } from "../utils/logger.js";
import { AccountError } from "../errors/account.error.js";
import { ErrorCode } from "../errors/base.error.js";

type AccountServiceConfig =
  | {
      mnemonic: string;
    }
  | {
      account: PrivacyPoolAccount;
    };

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

  /**
   * Creates a new AccountService instance.
   *
   * @param dataService - Service for fetching on-chain events
   * @param config - Configuration for the account service (either mnemonic or existing account)
   * @param config.mnemonic - Optional mnemonic for deterministic key generation
   * @param config.account - Optional existing account to initialize with
   *
   * @throws {AccountError} If account initialization fails
   */
  constructor(
    private readonly dataService: DataService,
    config: AccountServiceConfig
  ) {
    this.logger = new Logger({ prefix: "Account" });
    if ("mnemonic" in config) {
      this.account = this._initializeAccount(config.mnemonic);
    } else {
      this.account = config.account;
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
   * Gets all spendable commitments across all pools.
   *
   * @returns A map of scope to array of spendable commitments
   *
   * @remarks
   * A commitment is considered spendable if:
   * 1. It has a non-zero value
   * 2. The account it belongs to has not been ragequit
   */
  public getSpendableCommitments(): Map<bigint, AccountCommitment[]> {
    const result = new Map<bigint, AccountCommitment[]>();

    for (const [scope, accounts] of this.account.poolAccounts.entries()) {
      const nonZeroCommitments: AccountCommitment[] = [];

      for (const account of accounts) {
        // Skip accounts that have been ragequit
        if (account.ragequit) {
          continue;
        }

        const lastCommitment =
          account.children.length > 0
            ? account.children[account.children.length - 1]
            : account.deposit;

        if (lastCommitment!.value !== BigInt(0)) {
          nonZeroCommitments.push(lastCommitment!);
        }
      }

      if (nonZeroCommitments.length > 0) {
        result.set(scope, nonZeroCommitments);
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
    if (index && index < 0n) {
      throw AccountError.invalidIndex(index);
    }

    const accounts = this.account.poolAccounts.get(scope);
    index = index ?? BigInt(accounts?.length || 0);

    const nullifier = this._genDepositNullifier(scope, index);
    const secret = this._genDepositSecret(scope, index);
    const precommitment = this._hashPrecommitment(nullifier, secret);

    return { nullifier, secret, precommitment };
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
    txHash: Hex
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

        // Create a map of deposits by precommitment for efficient lookup
        const depositMap = new Map<Hash, DepositEvent>();
        for (const deposit of deposits) {
          depositMap.set(deposit.precommitment, deposit);
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
            deposit.transactionHash
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
