/**
 * Provides an interface to interact with the Privacy Pool SDK.
 */

import {
  calculateContext,
  Circuits,
  ContractInteractionsService,
  PrivacyPoolSDK,
  Withdrawal,
  WithdrawalProof,
  SDKError,
  type Hash,
} from "@0xbow/privacy-pools-core-sdk";
import { Address } from "viem";
import {
  CHAIN,
  ENTRYPOINT_ADDRESS,
  PROVIDER_URL,
  SIGNER_PRIVATE_KEY,
} from "../config.js";
import { WithdrawalPayload } from "../interfaces/relayer/request.js";
import { RelayerError, SdkError } from "../exceptions/base.exception.js";
import { SdkProviderInterface } from "../types/sdk.types.js";

/**
 * Class representing the SDK provider for interacting with Privacy Pool SDK.
 */
export class SdkProvider implements SdkProviderInterface {
  /** Instance of the PrivacyPoolSDK. */
  private sdk: PrivacyPoolSDK;
  private contracts: ContractInteractionsService;

  /**
   * Initializes a new instance of the SDK provider.
   */
  constructor() {
    this.sdk = new PrivacyPoolSDK(new Circuits());
    this.contracts = this.sdk.createContractInstance(
      PROVIDER_URL,
      CHAIN,
      ENTRYPOINT_ADDRESS,
      SIGNER_PRIVATE_KEY,
    );
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
   * @returns {Promise<{ hash: string }>} - A promise resolving to an object containing the transaction hash.
   */
  async broadcastWithdrawal(
    withdrawalPayload: WithdrawalPayload,
  ): Promise<{ hash: string }> {
    return this.contracts.relay(
      withdrawalPayload.withdrawal,
      withdrawalPayload.proof,
      withdrawalPayload.scope as Hash,
    );
  }

  /**
   * Calculates the context for a withdrawal.
   *
   * @param {Withdrawal} withdrawal - The withdrawal object.
   * @returns {string} - The calculated context.
   */
  calculateContext(withdrawal: Withdrawal, scope: bigint): string {
    return calculateContext(withdrawal, scope as Hash);
  }

  /**
   * Converts a scope value to an asset address.
   *
   * @param {bigint} scope - The scope value.
   * @returns {Promise<{ poolAddress: Address; assetAddress: Address; }>} - A promise resolving to the asset address.
   */
  async scopeData(
    scope: bigint,
  ): Promise<{ poolAddress: Address; assetAddress: Address }> {
    try {
      const data = await this.contracts.getScopeData(scope);
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
