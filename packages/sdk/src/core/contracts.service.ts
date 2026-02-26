import {
  Abi,
  Account,
  Address,
  Chain,
  Hex,
  PublicClient,
  WalletClient,
  createPublicClient,
  createWalletClient,
  getAddress,
  http,
} from "viem";
import { Withdrawal, WithdrawalProof } from "../types/withdrawal.js";
import {
  AssetConfig,
  ContractInteractions,
  TransactionResponse,
} from "../interfaces/contracts.interface.js";
import { IEntrypointABI } from "../abi/IEntrypoint.js";
import { IPrivacyPoolABI } from "../abi/IPrivacyPool.js";
import { ERC20ABI } from "../abi/ERC20.js";
import { privateKeyToAccount } from "viem/accounts";
import { CommitmentProof, Hash } from "../types/commitment.js";
import { bigintToHex } from "../crypto.js";
import { ContractError } from "../errors/base.error.js";

export class ContractInteractionsService implements ContractInteractions {
  private publicClient: PublicClient;
  private walletClient: WalletClient;
  private entrypointAddress: Address;
  private account: Account;

  /**
   * Initializes the contract interactions service.
   *
   * @param rpcUrl - The RPC endpoint URL for the blockchain network.
   * @param chain - The blockchain network configuration.
   * @param entrypointAddress - The address of the entrypoint contract.
   * @param accountPrivateKey - The private key used for signing transactions.
   */
  constructor(
    rpcUrl: string,
    chain: Chain,
    entrypointAddress: Address,
    accountPrivateKey: Hex,
  ) {
    if (!entrypointAddress) {
      throw new Error(
        "Invalid entrypoint addresses provided to ContractInteractionsService",
      );
    }

    this.account = privateKeyToAccount(accountPrivateKey);

    this.walletClient = createWalletClient({
      chain: chain,
      transport: http(rpcUrl),
      account: this.account,
    });

    this.publicClient = createPublicClient({
      chain: chain,
      transport: http(rpcUrl),
    });

    this.entrypointAddress = entrypointAddress;
  }

  /**
   * Deposits ERC20 tokens into the privacy pool.
   *
   * @param asset - The address of the ERC20 token.
   * @param amount - The amount of tokens to deposit.
   * @param precommitment - The precommitment value.
   * @returns Transaction response containing the transaction hash.
   */
  async depositERC20(
    asset: Address,
    amount: bigint,
    precommitment: bigint,
  ): Promise<TransactionResponse> {
    try {
      const { request } = await this.publicClient.simulateContract({
        address: this.entrypointAddress,
        abi: IEntrypointABI as Abi,
        functionName: "deposit",
        args: [asset, amount, precommitment],
        value: 0n,
        account: this.account,
      });
      return await this.executeTransaction(request);
    } catch (error) {
      console.error("Deposit ERC20 Error:", { error, asset, amount });
      throw new Error(
        `Failed to deposit ERC20: ${error instanceof Error ? error.message : "Unknown error"}`,
      );
    }
  }

  /**
   * Deposits ETH into the privacy pool.
   *
   * @param amount - The amount of ETH to deposit.
   * @param precommitment - The precommitment value.
   * @returns Transaction response containing the transaction hash.
   */
  async depositETH(
    amount: bigint,
    precommitment: bigint,
  ): Promise<TransactionResponse> {
    try {
      const { request } = await this.publicClient.simulateContract({
        address: this.entrypointAddress,
        abi: IEntrypointABI as Abi,
        functionName: "deposit",
        args: [precommitment],
        value: amount,
        account: this.account,
      });

      return await this.executeTransaction(request);
    } catch (error) {
      console.error("Deposit ETH Error:", { error, amount });
      throw new Error(
        `Failed to deposit ETH: ${error instanceof Error ? error.message : "Unknown error"}`,
      );
    }
  }

  /**
   * Withdraws funds from the privacy pool.
   *
   * @param withdrawal - The withdrawal object containing recipient details and amount.
   * @param withdrawalProof - The cryptographic proof verifying the withdrawal.
   * @returns Transaction response containing the transaction hash.
   */
  async withdraw(
    withdrawal: Withdrawal,
    withdrawalProof: WithdrawalProof,
    scope: Hash,
  ): Promise<TransactionResponse> {
    try {
      const formattedProof = this.formatProof(withdrawalProof);

      // get pool address from scope
      const scopeData = await this.getScopeData(scope);

      const { request } = await this.publicClient.simulateContract({
        address: scopeData.poolAddress,
        abi: IPrivacyPoolABI as Abi,
        functionName: "withdraw",
        account: this.account.address as Address,
        args: [withdrawal, formattedProof],
      });

      return await this.executeTransaction(request);
    } catch (error) {
      console.error("Withdraw Error Details:", {
        error,
        accountAddress: this.account.address,
      });
      throw new Error(
        `Failed to Withdraw: ${error instanceof Error ? error.message : "Unknown error"}`,
      );
    }
  }

  /**
   * Relays a withdrawal transaction to the entrypoint contract.
   * This function is used to facilitate relayer transactions.
   *
   * @param withdrawal - The withdrawal data structure.
   * @param withdrawalProof - The cryptographic proof required for withdrawal.
   * @returns Transaction response containing hash and wait function.
   */
  async relay(
    withdrawal: Withdrawal,
    withdrawalProof: WithdrawalProof,
    scope: Hash,
  ): Promise<TransactionResponse> {
    try {
      const formattedProof = this.formatProof(withdrawalProof);

      const { request } = await this.publicClient.simulateContract({
        address: this.entrypointAddress,
        abi: [...(IEntrypointABI as Abi), ...(IPrivacyPoolABI as Abi)],
        functionName: "relay",
        account: this.account,
        args: [withdrawal, formattedProof, scope],
      });

      return await this.executeTransaction(request);
    } catch (error) {
      console.error("Withdraw Error Details:", {
        error,
        accountAddress: this.account.address,
      });
      throw error;
    }
  }

  /**
   * Executes a ragequit operation, allowing a user to exit the pool
   * by nullifying their commitment and proving their withdrawal.
   *
   * @param commitmentProof - The cryptographic proof of the commitment.
   * @param privacyPoolAddress - The address of the privacy pool contract.
   * @returns Transaction response containing hash and wait function.
   */
  async ragequit(
    commitmentProof: CommitmentProof,
    privacyPoolAddress: Address,
  ): Promise<TransactionResponse> {
    try {
      const formattedProof = this.formatProof(commitmentProof);

      const { request } = await this.publicClient.simulateContract({
        address: privacyPoolAddress,
        abi: IPrivacyPoolABI as Abi,
        functionName: "ragequit",
        args: [formattedProof],
        account: this.account,
      });

      return await this.executeTransaction(request);
    } catch (error) {
      console.error("Ragequit Error:", { error });
      throw new Error(
        `Failed to Ragequit: ${error instanceof Error ? error.message : "Unknown error"}`,
      );
    }
  }

  /**
   * Retrieves the scope identifier of a given privacy pool.
   *
   * @param privacyPoolAddress - The address of the privacy pool contract.
   * @returns The scope identifier as a bigint.
   */
  async getScope(privacyPoolAddress: Address): Promise<bigint> {
    const scope = await this.publicClient.readContract({
      address: privacyPoolAddress,
      abi: IPrivacyPoolABI as Abi,
      functionName: "SCOPE",
      account: this.account,
    });

    return BigInt(scope as string);
  }

  /**
   * Retrieves the latest state root of the privacy pool from the entrypoint contract.
   *
   * @param privacyPoolAddress - The address of the privacy pool contract.
   * @returns The latest state root as a bigint.
   */
  async getStateRoot(privacyPoolAddress: Address): Promise<bigint> {
    const stateRoot = await this.publicClient.readContract({
      address: privacyPoolAddress,
      abi: IEntrypointABI as Abi,
      account: this.account,
      functionName: "latestRoot",
    });

    return BigInt(stateRoot as string);
  }

  /**
   * Retrieves the current state size of the privacy pool.
   *
   * @param privacyPoolAddress - The address of the privacy pool contract.
   * @returns The size of the state tree as a bigint.
   */
  async getStateSize(privacyPoolAddress: Address): Promise<bigint> {
    const stateSize = await this.publicClient.readContract({
      address: privacyPoolAddress,
      abi: IPrivacyPoolABI as Abi,
      account: this.account,
      // this should be added in the next update of PrivacyPoolSimple.sol
      functionName: "currentTreeSize",
    });

    return BigInt(stateSize as string);
  }


  /**
   * Retrieves data from the corresponding asset
   *
   * @param assetAddress - The asset contract address.
   * @returns AssetConfig - An object containing the privacy pool address, minimum deposit amount, vetting fee and maximum relaying fee.
   * @throws ContractError if the asset does not exist in the pool.
   */
  async getAssetConfig(assetAddress: Address): Promise<AssetConfig> {
    const assetConfig = await this.publicClient.readContract({
      address: this.entrypointAddress,
      abi: IEntrypointABI as Abi,
      account: this.account,
      args: [assetAddress],
      functionName: "assetConfig",
    });
    const [pool, minimumDepositAmount, vettingFeeBPS, maxRelayFeeBPS] = assetConfig as [string, bigint, bigint, bigint];

    // if no pool throw error
    if (
      !pool ||
      pool === "0x0000000000000000000000000000000000000000"
    ) {
      throw ContractError.assetNotFound(assetAddress);
    }

    return {
      pool: getAddress(pool),
      minimumDepositAmount,
      vettingFeeBPS,
      maxRelayFeeBPS
    }
  }

  /**
   * Retrieves data about a specific scope, including the associated privacy pool
   * and the asset used in that pool.
   *
   * @param scope - The scope identifier to look up.
   * @returns An object containing the privacy pool address and asset address.
   * @throws ContractError if the scope does not exist.
   */
  async getScopeData(
    scope: bigint,
  ): Promise<{ poolAddress: Address; assetAddress: Address }> {
    try {
      // get pool address fro entrypoint
      const poolAddress = await this.publicClient.readContract({
        address: this.entrypointAddress,
        abi: IEntrypointABI as Abi,
        account: this.account,
        args: [scope],
        functionName: "scopeToPool",
      });

      // if no pool throw error
      if (
        !poolAddress ||
        poolAddress === "0x0000000000000000000000000000000000000000"
      ) {
        throw ContractError.scopeNotFound(scope);
      }

      // get asset adress from pool
      const assetAddress = await this.publicClient.readContract({
        address: getAddress(poolAddress as string),
        abi: IPrivacyPoolABI as Abi,
        account: this.account,
        functionName: "ASSET",
      });

      return {
        poolAddress: getAddress(poolAddress as string),
        assetAddress: getAddress(assetAddress as string),
      };
    } catch (error) {
      if (error instanceof ContractError) throw error;
      console.error(`Error resolving scope ${scope.toString()}:`, error);
      throw new Error(
        `Failed to resolve scope ${scope.toString()}: ${error instanceof Error ? error.message : "Unknown error"}`,
      );
    }
  }

  /**
   * Approves the entrypoint contract to spend a specified amount of ERC20 tokens.
   *
   * @param spenderAddress - The address of the entity that will be approved to spend tokens.
   * @param tokenAddress - The address of the ERC20 token contract.
   * @param amount - The amount of tokens to approve.
   * @returns Transaction response containing hash and wait function.
   */
  async approveERC20(
    spenderAddress: Address,
    tokenAddress: Address,
    amount: bigint,
  ): Promise<TransactionResponse> {
    try {
      const { request } = await this.publicClient.simulateContract({
        address: tokenAddress,
        abi: ERC20ABI as Abi,
        functionName: "approve",
        args: [spenderAddress, amount],
        account: this.account,
      });

      return await this.executeTransaction(request);
    } catch (error) {
      console.error("ERC20 Approval Error:", { error, tokenAddress, amount });
      throw new Error(
        `Failed to approve ERC20: ${error instanceof Error ? error.message : "Unknown error"}`,
      );
    }
  }

  private formatProof(proof: CommitmentProof | WithdrawalProof) {
    return {
      pA: [
        bigintToHex(proof.proof.pi_a?.[0]),
        bigintToHex(proof.proof.pi_a?.[1]),
      ],
      pB: [
        [
          bigintToHex(proof.proof.pi_b?.[0]?.[1]),
          bigintToHex(proof.proof.pi_b?.[0]?.[0]),
        ],
        [
          bigintToHex(proof.proof.pi_b?.[1]?.[1]),
          bigintToHex(proof.proof.pi_b?.[1]?.[0]),
        ],
      ],
      pC: [
        bigintToHex(proof.proof.pi_c?.[0]),
        bigintToHex(proof.proof.pi_c?.[1]),
      ],
      pubSignals: proof.publicSignals.map(bigintToHex),
    };
  }

  private async executeTransaction(request: any): Promise<TransactionResponse> {
    try {
      const hash = await this.walletClient.writeContract(request);
      return {
        hash,
        wait: async () => {
          await this.publicClient.waitForTransactionReceipt({ hash });
        },
      };
    } catch (error) {
      console.error("Transaction Execution Error:", { error, request });
      throw new Error(
        `Transaction failed: ${error instanceof Error ? error.message : "Unknown error"}`,
      );
    }
  }
}
