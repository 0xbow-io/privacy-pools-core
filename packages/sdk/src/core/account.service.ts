import { poseidon } from "maci-crypto/build/ts/hashing.js";
import { Hash, Secret } from "../types/commitment.js";
import { Hex, bytesToNumber } from "viem";
import { english, generateMnemonic, mnemonicToAccount } from "viem/accounts";
import { DataService } from "./data.service.js";
import {
  Commitment,
  PoolAccount,
  PoolInfo,
  PrivacyPoolAccount,
} from "../types/account.js";
import { Logger } from "../utils/logger.js";
import { AccountError } from "../errors/account.error.js";

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
   * @param account - Optional existing account to initialize with
   * @param mnemonic - Optional mnemonic for deterministic key generation
   * 
   * @throws {AccountError} If account initialization fails
   */
  constructor(
    private readonly dataService: DataService,
    account?: PrivacyPoolAccount,
    mnemonic?: string,
  ) {
    this.logger = new Logger({ prefix: "Account" });
    this.account = account || this._initializeAccount(mnemonic);
  }

  private _initializeAccount(mnemonic?: string): PrivacyPoolAccount {
    try {
      mnemonic = mnemonic || generateMnemonic(english, 128);
      this.logger.debug("Initializing account with mnemonic");

      let key1 = bytesToNumber(
        mnemonicToAccount(mnemonic, { accountIndex: 0 }).getHdKey().privateKey!,
      );

      let key2 = bytesToNumber(
        mnemonicToAccount(mnemonic, { accountIndex: 1 }).getHdKey().privateKey!,
      );

      let masterKey1 = poseidon([BigInt(key1)]) as Secret;
      let masterKey2 = poseidon([BigInt(key2)]) as Secret;

      return {
        mnemonic,
        masterKeys: [masterKey1, masterKey2],
        poolAccounts: new Map(),
      };
    } catch (error) {
      throw AccountError.accountInitializationFailed(
        error instanceof Error ? error.message : "Unknown error"
      );
    }
  }

  private _genDepositNullifier(scope: Hash, index: bigint): Secret {
    return poseidon([this.account.masterKeys[0], scope, index]) as Secret;
  }

  private _genDepositSecret(scope: Hash, index: bigint): Secret {
    return poseidon([this.account.masterKeys[1], scope, index]) as Secret;
  }

  private _genWithdrawalNullifier(label: Hash, index: bigint): Secret {
    return poseidon([this.account.masterKeys[0], label, index]) as Secret;
  }

  private _genWithdrawalSecret(label: Hash, index: bigint): Secret {
    return poseidon([this.account.masterKeys[1], label, index]) as Secret;
  }

  private _hashCommitment(
    value: bigint,
    label: Hash,
    precommitment: Hash,
  ): Hash {
    return poseidon([value, label, precommitment]) as Hash;
  }

  private _hashPrecommitment(nullifier: Secret, secret: Secret): Hash {
    return poseidon([nullifier, secret]) as Hash;
  }

  /**
   * Gets all spendable commitments across all pools.
   * 
   * @returns A map of scope to array of spendable commitments
   */
  public getSpendableCommitments(): Map<bigint, Commitment[]> {
    const result = new Map<bigint, Commitment[]>();

    for (const [scope, accounts] of this.account.poolAccounts.entries()) {
      const nonZeroCommitments: Commitment[] = [];

      for (const account of accounts) {
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
   */
  public createDepositSecrets(
    scope: Hash,
    index?: bigint,
  ): {
    nullifier: Secret;
    secret: Secret;
    precommitment: Hash;
  } {
    const accounts = this.account.poolAccounts.get(scope);
    index = index || BigInt(accounts?.length || 0);

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
   * @throws {AccountError} If no account is found for the commitment
   */
  public createWithdrawalSecrets(commitment: Commitment): {
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
   */
  public addPoolAccount(
    scope: Hash,
    value: bigint,
    nullifier: Secret,
    secret: Secret,
    label: Hash,
    blockNumber: bigint,
    txHash: Hash,
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
      `Added new pool account with value ${value} and label ${label}`,
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
   * @throws {AccountError} If no account is found for the commitment
   */
  public addWithdrawalCommitment(
    parentCommitment: Commitment,
    value: bigint,
    nullifier: Secret,
    secret: Secret,
    blockNumber: bigint,
    txHash: Hash,
  ): Commitment {
    let foundAccount: PoolAccount | undefined;
    let foundScope: bigint | undefined;

    for (const [scope, accounts] of this.account.poolAccounts.entries()) {
      foundAccount = accounts.find((account) => {
        if (account.deposit.hash === parentCommitment.hash) return true;
        return account.children.some(
          (child) => child.hash === parentCommitment.hash,
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
    const newCommitment: Commitment = {
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
      `Added new commitment with value ${value} to account with label ${parentCommitment.label}`,
    );

    return newCommitment;
  }

  /**
   * Process withdrawals for a given chain and block range
   * 
   * @param chainId - The chain ID to process withdrawals for
   * @param fromBlock - The starting block number
   * @param foundAccounts - Map of accounts indexed by label
   */
  private async _processWithdrawals(
    chainId: number,
    fromBlock: bigint,
    foundAccounts: Map<Hash, PoolAccount>,
  ): Promise<void> {
    const withdrawals = await this.dataService.getWithdrawals(chainId, {
      fromBlock,
    });

    for (const withdrawal of withdrawals) {
      for (const account of foundAccounts.values()) {
        const isParentCommitment = 
          BigInt(account.deposit.nullifier) === BigInt(withdrawal.spentNullifier) ||
          account.children.some(child => BigInt(child.nullifier) === BigInt(withdrawal.spentNullifier));

        if (isParentCommitment) {
          const parentCommitment = account.children.length > 0 
            ? account.children[account.children.length - 1] 
            : account.deposit;

          if (!parentCommitment) {
            this.logger.warn(`No parent commitment found for withdrawal ${withdrawal.spentNullifier.toString()}`);
            continue;
          }

          this.addWithdrawalCommitment(
            parentCommitment,
            withdrawal.withdrawn,
            withdrawal.spentNullifier as unknown as Secret,
            parentCommitment.secret,
            withdrawal.blockNumber,
            withdrawal.transactionHash,
          );
          break;
        }
      }
    }
  }

  /**
   * Retrieves the history of deposits and withdrawals for the given pools.
   * 
   * @param pools - Array of pool configurations to sync history for
   * 
   * @remarks
   * This method performs the following steps:
   * 1. Fetches all deposit events for each pool
   * 2. Reconstructs account state from deposits
   * 3. Processes withdrawals to update account state
   * 
   * @throws {DataError} If event fetching fails
   * @throws {AccountError} If account state reconstruction fails
   */
  public async retrieveHistory(pools: PoolInfo[]): Promise<void> {
    this.logger.info(`Fetching events for ${pools.length} pools`);

    for (const pool of pools) {
      if (!this.account.poolAccounts.has(pool.scope)) {
        this.account.poolAccounts.set(pool.scope, []);
      }
    }

    await Promise.all(
      pools.map(async (pool) => {
        this.logger.info(
          `Processing pool ${pool.address} on chain ${pool.chainId} from block ${pool.deploymentBlock}`,
        );

        const deposits = await this.dataService.getDeposits(pool.chainId, {
          fromBlock: pool.deploymentBlock,
        });

        this.logger.info(
          `Found ${deposits.length} deposits for pool ${pool.address}`,
        );

        const depositMap = new Map<Hash, (typeof deposits)[0]>();
        for (const deposit of deposits) {
          depositMap.set(deposit.precommitment, deposit);
        }

        const foundDeposits: Array<{
          index: bigint;
          nullifier: Secret;
          secret: Secret;
          deposit: (typeof deposits)[0];
        }> = [];

        let index = BigInt(0);
        let firstDepositBlock: bigint | undefined;

        while (true) {
          const nullifier = this._genDepositNullifier(pool.scope, index);
          const secret = this._genDepositSecret(pool.scope, index);
          const precommitment = this._hashPrecommitment(nullifier, secret);

          const deposit = depositMap.get(precommitment);
          if (!deposit) break;

          if (!firstDepositBlock || deposit.blockNumber < firstDepositBlock) {
            firstDepositBlock = deposit.blockNumber;
          }

          foundDeposits.push({ index, nullifier, secret, deposit });
          index++;
        }

        if (foundDeposits.length === 0) {
          this.logger.info(
            `No Pool Accounts were found for scope ${pool.scope}`,
          );
          return;
        }

        this.logger.info(
          `Found ${foundDeposits.length} deposits for pool ${pool.address}`,
        );

        // Process deposits first
        const accounts = foundDeposits.map(({ nullifier, secret, deposit }) => {
          return this.addPoolAccount(
            pool.scope,
            deposit.value,
            nullifier,
            secret,
            deposit.label,
            deposit.blockNumber,
            deposit.transactionHash,
          );
        });

        // Create a map for faster account lookups
        const accountMap = new Map<Hash, PoolAccount>();
        for (const account of accounts) {
          accountMap.set(account.label, account);
        }

        // Process withdrawals
        await this._processWithdrawals(
          pool.chainId,
          firstDepositBlock!,
          accountMap,
        );
      }),
    );
  }
}
