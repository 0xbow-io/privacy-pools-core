/**
 * Handles withdrawal requests within the Privacy Pool relayer.
 */
import { Address, getAddress } from "viem";
import {
  getAssetConfig,
  getEntrypointAddress,
  getFeeReceiverAddress,
  getSignerPrivateKey
} from "../config/index.js";
import {
  BlockchainError,
  RelayerError,
  WithdrawalValidationError,
  ZkError,
} from "../exceptions/base.exception.js";
import {
  RelayerResponse,
  WithdrawalPayload,
} from "../interfaces/relayer/request.js";
import { db, SdkProvider, UniswapProvider, web3Provider } from "../providers/index.js";
import { RelayerDatabase } from "../types/db.types.js";
import { SdkProviderInterface } from "../types/sdk.types.js";
import { decodeWithdrawalData, isFeeReceiverSameAsSigner, isNative, isViemError, parseSignals } from "../utils.js";
import { quoteService } from "./index.js";
import { Web3Provider } from "../providers/web3.provider.js";
import { FeeCommitment } from "../interfaces/relayer/common.js";
import { uniswapProvider } from "../providers/index.js";
import { WRAPPED_NATIVE_TOKEN_ADDRESS } from "../providers/uniswap/constants.js";
import { Withdrawal, WithdrawalProof } from "@0xbow/privacy-pools-core-sdk";
import { privateKeyToAccount } from "viem/accounts";

/**
 * Class representing the Privacy Pool Relayer, responsible for processing withdrawal requests.
 */
export class PrivacyPoolRelayer {
  /** Database instance for storing and updating request states. */
  protected db: RelayerDatabase;
  /** SDK provider for handling contract interactions. */
  protected sdkProvider: SdkProviderInterface;
  /** Web3 provider for handling blockchain interactions. */
  protected web3Provider: Web3Provider;
  protected uniswapProvider: UniswapProvider;

  /**
   * Initializes a new instance of the Privacy Pool Relayer.
   */
  constructor() {
    this.db = db;
    this.sdkProvider = new SdkProvider();
    this.web3Provider = web3Provider;
    this.uniswapProvider = uniswapProvider;
  }

  /**
   * Handles a withdrawal request.
   *
   * @param {WithdrawalPayload} req - The withdrawal request payload.
   * @param {number} chainId - The chain ID to process the request on.
   * @returns {Promise<RelayerResponse>} - A promise resolving to the relayer response.
   */
  async handleRequest(req: WithdrawalPayload, chainId: number): Promise<RelayerResponse> {
    const requestId = crypto.randomUUID();
    const timestamp = Date.now();

    try {
      await this.db.createNewRequest(requestId, timestamp, req);
      await this.validateWithdrawal(req, chainId);

      const extraGas = req.feeCommitment?.extraGas ?? false;

      const isValidWithdrawalProof = await this.verifyProof(req.proof);
      if (!isValidWithdrawalProof) {
        throw ZkError.invalidProof();
      }

      // We do early check, before relaying
      if (extraGas) {
        if (!WRAPPED_NATIVE_TOKEN_ADDRESS[chainId])
          throw RelayerError.unknown(`Missing wrapped native token for chain ${chainId}`);
      }

      const response = await this.broadcastWithdrawal(req, chainId);
      // const response = { hash: "0x" }

      let txSwap;
      if (extraGas) {
        txSwap = await this.swapForNativeAndFund(req.scope, req.withdrawal, req.proof, chainId, response.hash);
      }

      await this.db.updateBroadcastedRequest(requestId, response.hash);

      return {
        success: true,
        txHash: response.hash,
        txSwap,
        timestamp,
        requestId,
      };
    } catch (error) {
      let errorMessage: string;
      if (error instanceof RelayerError) {
        errorMessage = error.toPrettyString();
      } else {
        // TODO: we might want to remove all this section or refactor it for a cleaner web3 error parser into RelayerError types
        try {
          // Convert to string to handle both Error objects and other types
          const errorStr = typeof error === 'object' ? JSON.stringify(error, (key, value) =>
            typeof value === 'bigint' ? value.toString() : value) : String(error);

          // Try to parse the error if it's JSON
          const errorObj = JSON.parse(errorStr);

          // Extract contract error message if available
          if (errorObj.cause?.metaMessages && errorObj.cause.metaMessages.length > 0) {
            // First message is usually the contract error
            const contractError = errorObj.cause.metaMessages[0].trim();
            errorMessage = contractError.startsWith('Error:')
              ? contractError.substring(6).trim()
              : contractError;
          } else if (errorObj.shortMessage) {
            errorMessage = errorObj.shortMessage;
          } else {
            errorMessage = "Unknown contract error";
          }
        } catch {
          // If we can't parse the error, just use the string representation
          errorMessage = String(error);
        }
      }

      await this.db.updateFailedRequest(requestId, errorMessage);
      return {
        success: false,
        error: errorMessage,
        timestamp,
        requestId,
      };
    }
  }

  async swapForNativeAndFund(scope: bigint, withdrawal: Withdrawal, proof: WithdrawalProof, chainId: number, relayTx: string) {

    const { assetAddress } = await this.sdkProvider.scopeData(scope, chainId);
    if (isNative(assetAddress)) {
      // we shouldn't be here
      return;
    }

    const relayReceipt = await web3Provider.client(chainId).waitForTransactionReceipt({ hash: relayTx as `0x${string}` });
    const { gasUsed: relayGasUsed, effectiveGasPrice: relayGasPrice } = relayReceipt;

    const assetConfig = getAssetConfig(chainId, assetAddress);
    const feeReceiver = getFeeReceiverAddress(chainId) as Address;
    const { recipient, relayFeeBPS } = decodeWithdrawalData(withdrawal.data);
    const withdrawnValue = parseSignals(proof.publicSignals).withdrawnValue;
    const gasPrice = await web3Provider.getGasPrice(chainId);

    const feeGross = withdrawnValue * relayFeeBPS / 10_000n;
    const feeBase = withdrawnValue * assetConfig.fee_bps / 10_000n;

    const relayerGasRefundValue = gasPrice * quoteService.extraGasTxCost + relayGasPrice * relayGasUsed;

    const txHash = await this.uniswapProvider.swapExactInputForWeth({
      chainId,
      feeGross,
      feeBase,
      refundAmount: relayerGasRefundValue,
      tokenIn: assetAddress,
      nativeRecipient: recipient,
      feeReceiver
    });

    return txHash;

  }

  /**
   * Verifies a withdrawal proof.
   *
   * @param {WithdrawalPayload["proof"]} proof - The proof to be verified.
   * @returns {Promise<boolean>} - A promise resolving to a boolean indicating verification success.
   */
  protected async verifyProof(
    proof: WithdrawalPayload["proof"],
  ): Promise<boolean> {
    return this.sdkProvider.verifyWithdrawal(proof);
  }

  /**
   * Broadcasts a withdrawal transaction.
   *
   * @param {WithdrawalPayload} withdrawal - The withdrawal payload.
   * @param {number} chainId - The chain ID to broadcast on.
   * @returns {Promise<{ hash: string }>} - A promise resolving to the transaction hash.
   */
  protected async broadcastWithdrawal(
    withdrawal: WithdrawalPayload,
    chainId: number,
  ): Promise<{ hash: string; }> {
    try {
      return await this.sdkProvider.broadcastWithdrawal(withdrawal, chainId);
    } catch (error) {
      if (isViemError(error)) {
        const { metaMessages, shortMessage } = error;
        throw BlockchainError.txError((metaMessages ? metaMessages[0] : undefined) || shortMessage);
      } else {
        throw RelayerError.unknown("Something went wrong while broadcasting Tx");
      }
    }
  }

  /**
   * Validates a withdrawal request against relayer rules.
   *
   * @param {WithdrawalPayload} wp - The withdrawal payload.
   * @param {number} chainId - The chain ID to validate against.
   * @throws {WithdrawalValidationError} - If validation fails.
   * @throws {ValidationError} - If public signals are malformed.
   */
  protected async validateWithdrawal(wp: WithdrawalPayload, chainId: number) {
    const entrypointAddress = getEntrypointAddress(chainId);
    const feeReceiverAddress = getFeeReceiverAddress(chainId);
    const signerAddress = privateKeyToAccount(getSignerPrivateKey(chainId) as `0x${string}`).address;

    const extraGas = wp.feeCommitment?.extraGas ?? false;

    // If there's a fee commitment, then we use it's withdrawalData as source of truth to check against the proof.
    const withdrawalData = wp.feeCommitment ? wp.feeCommitment.withdrawalData : wp.withdrawal.data;
    if ((wp.feeCommitment !== undefined) && (wp.feeCommitment.withdrawalData !== wp.withdrawal.data)) {
      throw WithdrawalValidationError.relayerCommitmentRejected(
        `Signed commitment does not match withdrawal data, exiting early: commitment data ${wp.feeCommitment.withdrawalData}, request data ${wp.withdrawal.data}`,
      );
    }

    const { feeRecipient, relayFeeBPS } = decodeWithdrawalData(withdrawalData);
    const proofSignals = parseSignals(wp.proof.publicSignals);

    if ((wp.feeCommitment !== undefined) && (wp.feeCommitment.amount > proofSignals.withdrawnValue)) {
      throw WithdrawalValidationError.withdrawnValueTooSmall(
        `WithdrawnValue too small: expected "${wp.feeCommitment.amount}", got "${proofSignals.withdrawnValue}".`,
      );
    }

    if (wp.withdrawal.processooor !== entrypointAddress) {
      throw WithdrawalValidationError.processooorMismatch(
        `Processooor mismatch: expected "${entrypointAddress}", got "${wp.withdrawal.processooor}".`,
      );
    }

    if (extraGas && !isFeeReceiverSameAsSigner(chainId)) {
      if (getAddress(feeRecipient) !== getAddress(signerAddress)) {
        throw WithdrawalValidationError.feeReceiverMismatch(
          `Fee recipient with extraGas mismatch: expected "${signerAddress}", got "${feeRecipient}".`,
        );
      }
    } else {
      if (getAddress(feeRecipient) !== feeReceiverAddress) {
        throw WithdrawalValidationError.feeReceiverMismatch(
          `Fee recipient mismatch: expected "${feeReceiverAddress}", got "${feeRecipient}".`,
        );
      }
    }

    const withdrawalContext = BigInt(
      this.sdkProvider.calculateContext({ processooor: wp.withdrawal.processooor, data: withdrawalData }, wp.scope),
    );
    if (proofSignals.context !== withdrawalContext) {
      throw WithdrawalValidationError.contextMismatch(
        `Context mismatch: expected "${withdrawalContext.toString(16)}", got "${proofSignals.context.toString(16)}".`,
      );
    }

    const { assetAddress } = await this.sdkProvider.scopeData(wp.scope, chainId);

    // Get asset configuration for this chain and asset
    const assetConfig = getAssetConfig(chainId, assetAddress);

    if (!assetConfig) {
      throw WithdrawalValidationError.assetNotSupported(
        `Asset ${assetAddress} is not supported on chain ${chainId}.`
      );
    }

    if (wp.feeCommitment) {

      if (wp.feeCommitment.asset != assetAddress) {
        throw WithdrawalValidationError.relayerCommitmentRejected(
          `Asset in commitment does not match withdrawal scope asset: expected ${wp.feeCommitment.asset}, received ${assetAddress}`,
        );
      }

      // TODO: remove this check beacuse we should already have errored out at the begining
      const { relayFeeBPS: commitmentRelayFeeBPS } = decodeWithdrawalData(wp.feeCommitment.withdrawalData);
      if (relayFeeBPS !== commitmentRelayFeeBPS) {
        throw WithdrawalValidationError.relayerCommitmentRejected(
          `Proof relay fee does not match signed commitment: pi:=${relayFeeBPS}, commitment:=${commitmentRelayFeeBPS}`,
        );
      }

      if (commitmentExpired(wp.feeCommitment)) {
        throw WithdrawalValidationError.relayerCommitmentRejected(
          `Relay fee commitment expired, please quote again`,
        );
      }

      if (!await validFeeCommitment(chainId, wp.feeCommitment)) {
        throw WithdrawalValidationError.relayerCommitmentRejected(
          `Invalid relayer commitment`,
        );
      }

    } else {

      const currentFeeBPS = await quoteService.quoteFeeBPSNative({
        chainId,
        amountIn: proofSignals.withdrawnValue,
        assetAddress,
        baseFeeBPS: assetConfig.fee_bps,
        extraGas
      });

      if (relayFeeBPS < currentFeeBPS.feeBPS) {
        throw WithdrawalValidationError.feeTooLow(
          `Relay fee too low: expected at least "${currentFeeBPS}", got "${relayFeeBPS}".`,
        );
      }

    }

    if (proofSignals.withdrawnValue < assetConfig.min_withdraw_amount) {
      throw WithdrawalValidationError.withdrawnValueTooSmall(
        `Withdrawn value too small: expected minimum "${assetConfig.min_withdraw_amount}", got "${proofSignals.withdrawnValue}".`,
      );
    }

  }

}

function commitmentExpired(feeCommitment: FeeCommitment): boolean {
  return feeCommitment.expiration < Number(new Date());
}

async function validFeeCommitment(chainId: number, feeCommitment: FeeCommitment): Promise<boolean> {
  return web3Provider.verifyRelayerCommitment(chainId, feeCommitment);
}
