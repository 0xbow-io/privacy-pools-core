/**
 * Provides an interface to interact with the Privacy Pool SDK.
 */

import {
  calculateContext,
  Circuits,
  ContractInteractionsService,
  PrivacyPoolSDK,
  SDKError,
  Withdrawal,
  WithdrawalProof,
  type Hash,
} from "@0xbow/privacy-pools-core-sdk";
import { Address } from "viem";
import { RelayerConfig } from "../config/index.js";
import { ConfigError, RelayerError, SdkError } from "../exceptions/base.exception.js";
import { WithdrawalPayload } from "../interfaces/relayer/request.js";
import { ChainId } from "../types.js";
import { SdkProviderInterface } from "../types/sdk.types.js";
import { createChainObjectFromBrandedChainId } from "../utils.js";

/**
 * Class representing the SDK provider for interacting with Privacy Pool SDK.
 */
export class SdkProvider implements SdkProviderInterface {
  /** Instance of the PrivacyPoolSDK. */
  private sdk: PrivacyPoolSDK;

  /**
   * Initializes a new instance of the SDK provider.
   */
  constructor() {
    this.sdk = new PrivacyPoolSDK(new Circuits({ browser: false }));
  }

  /**
   * Gets the contract interactions service for a specific chain.
   * 
   * @param {number} chainId - The chain ID.
   * @returns {ContractInteractionsService} - The contract interactions service for the specified chain.
   * @throws {RelayerError} - If the chain is not supported.
   */
  private async getContractsForChain(chainId: ChainId): Promise<ContractInteractionsService> {
    const config = new RelayerConfig().chain(chainId);
    const chainObject = await createChainObjectFromBrandedChainId(chainId);
    const rpcUrl = await config.rpc_url();
    const entrypointAddress = await config.entrypointAddress();
    const signerPrivateKey = await config.signerPrivateKey();

    // Create contract instance
    const contracts = this.sdk.createContractInstance(
      rpcUrl,
      chainObject,
      entrypointAddress,
      signerPrivateKey,
    );

    if (!contracts) {
      throw ConfigError.default(`Chain with ID ${chainId} not supported.`);
    }
    return contracts;
  }

  /**
   * Verifies a withdrawal proof.
   *
   * @param {WithdrawalProof} withdrawalPayload - The withdrawal proof payload.
   * @returns {Promise<boolean>} - A promise resolving to a boolean indicating verification success.
   */
  async verifyWithdrawal(withdrawalPayload: WithdrawalProof): Promise<boolean> {
    return await this.sdk.verifyWithdrawal(withdrawalPayload);
  }

  /**
   * Broadcasts a withdrawal transaction.
   *
   * @param {WithdrawalPayload} withdrawalPayload - The withdrawal payload.
   * @param {number} chainId - The chain ID to broadcast on.
   * @returns {Promise<{ hash: string }>} - A promise resolving to an object containing the transaction hash.
   */
  async broadcastWithdrawal(
    withdrawalPayload: WithdrawalPayload,
    chainId: ChainId,
  ): Promise<{ hash: string; }> {
    const contracts = await this.getContractsForChain(chainId);
    return contracts.relay(
      withdrawalPayload.withdrawal,
      withdrawalPayload.proof,
      withdrawalPayload.scope as Hash,
    );
  }

  /**
   * Calculates the context for a withdrawal.
   *
   * @param {Withdrawal} withdrawal - The withdrawal object.
   * @param {bigint} scope - The scope value.
   * @returns {string} - The calculated context.
   */
  calculateContext(withdrawal: Withdrawal, scope: bigint): string {
    return calculateContext(withdrawal, scope as Hash);
  }

  /**
   * Converts a scope value to an asset address.
   *
   * @param {bigint} scope - The scope value.
   * @param {ChainId} chainId - The chain ID.
   * @returns {Promise<{ poolAddress: Address; assetAddress: Address; }>} - A promise resolving to the asset address.
   */
  async scopeData(
    scope: bigint,
    chainId: ChainId,
  ): Promise<{ poolAddress: Address; assetAddress: Address; }> {
    try {
      const contracts = await this.getContractsForChain(chainId);
      const data = await contracts.getScopeData(scope);
      return data;
    } catch (error) {
      if (error instanceof SDKError) {
        throw SdkError.scopeDataError(error);
      } else {
        throw RelayerError.unknown(JSON.stringify(error));
      }
    }
  }
}
