/**
 * Handles withdrawal requests within the Privacy Pool relayer.
 */
import { getAddress } from "viem";
import { RelayerConfig } from "../config/index.js";
import {
  BlockchainError,
  ConfigError,
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
import { decodeWithdrawalData, isNative, isViemError, parseSignals } from "../utils.js";
import { quoteService } from "./index.js";
import { Web3Provider } from "../providers/web3.provider.js";
import { FeeCommitment } from "../interfaces/relayer/common.js";
import { uniswapProvider } from "../providers/index.js";
import { WRAPPED_NATIVE_TOKEN_ADDRESS } from "../providers/uniswap/constants.js";
import { Withdrawal, WithdrawalProof } from "@0xbow/privacy-pools-core-sdk";
import { privateKeyToAccount } from "viem/accounts";
import { ChainId } from "../types.js";
import { createModuleLogger } from "../logger/index.js";

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
  async handleRequest(req: WithdrawalPayload, chainId: ChainId): Promise<RelayerResponse> {
    const requestId = crypto.randomUUID();
    const timestamp = Date.now();

    try {
      await this.db.createNewRequest(requestId, timestamp, req);
      await this.validateWithdrawal(req, chainId);

      const extraGas = req.feeCommitment?.extraGas ?? false;

      const isValidWithdrawalProof = await this.verifyProof(req.proof);
      if (!isValidWithdrawalProof) {
        logger.error("Relay HandleRequest error: Invalid Proof")
        throw ZkError.invalidProof();
      }

      // We do early check, before relaying
      if (extraGas) {
        if (!WRAPPED_NATIVE_TOKEN_ADDRESS[chainId]) {
          const errorMsg = `Missing wrapped native token for chain ${chainId}`;
          logger.error(errorMsg)
          throw RelayerError.unknown(errorMsg);
        }
      }

      const response = await this.broadcastWithdrawal(req, chainId);

      let txSwap;
      if (extraGas) {
        // TODO HERE MAN
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

  async fundExtraGas(scope: bigint, withdrawal: Withdrawal, proof: WithdrawalProof, chainId: ChainId, relayTx: string) {

    const { assetAddress } = await this.sdkProvider.scopeData(scope, chainId);
    if (isNative(assetAddress)) {
      // this should NEVER EVER happen 
      logger.error("Tried to send extraGas with native asset?????")
      return;
    }

    const client = await web3Provider.client(chainId);
    const relayReceipt = await client.waitForTransactionReceipt({ hash: relayTx as `0x${string}` });
    const { gasUsed: relayGasUsed, effectiveGasPrice: relayGasPrice } = relayReceipt;

    const chainConfig = new RelayerConfig().chain(chainId);
    const [ assetConfig, error ] = await chainConfig.assetConfig(assetAddress);
    if (error) {
      logger.error(error)
      throw ConfigError.default(error);
    } 

    const { recipient, relayFeeBPS } = decodeWithdrawalData(withdrawal.data);
    const withdrawnValue = parseSignals(proof.publicSignals).withdrawnValue;
    const gasPrice = await web3Provider.getGasPrice(chainId);

    // don't need any of these three since we are keeping the diff?
    const feeReceiver = await chainConfig.feeReceiverAddress(); 
    const feeGross = withdrawnValue * relayFeeBPS / 10_000n;
    const feeBase = withdrawnValue * assetConfig!.fee_bps / 10_000n;

    const relayerGasRefundValue = gasPrice * quoteService.extraGasTxCost + relayGasPrice * relayGasUsed;
    const amountToSwap = feeGross - feeBase;

    const relayer = await web3Provider.signer(chainId);

    if (!relayer.account) {
      const error = "Send error: Signer account not found";
      logger.error(error);
      throw Error(error);
    }
    
    // send the user their extraGas funds
    const sendParams = {
      to: recipient as `0x${string}`,
      value: feeGross, // TODO not sure??
      account: relayer.account,
      chain: relayer.chain
    };

    const txHash = await relayer.sendTransaction(sendParams);
    
    return txHash;
  }

  async swapForNativeAndFund(scope: bigint, withdrawal: Withdrawal, proof: WithdrawalProof, chainId: ChainId, relayTx: string) {

    const { assetAddress } = await this.sdkProvider.scopeData(scope, chainId);
    if (isNative(assetAddress)) {
      // we shouldn't be here
      return;
    }

    const client = await web3Provider.client(chainId);
    const relayReceipt = await client.waitForTransactionReceipt({ hash: relayTx as `0x${string}` });
    const { gasUsed: relayGasUsed, effectiveGasPrice: relayGasPrice } = relayReceipt;


    const chain = new RelayerConfig().chain(chainId);
    const [ assetConfig, error ] = await chain.assetConfig(assetAddress);
    if (error) {
      logger.error(error);
      throw ConfigError.default(error);
    } 
    const feeReceiver = await chain.feeReceiverAddress();
    const { recipient, relayFeeBPS } = decodeWithdrawalData(withdrawal.data);
    const withdrawnValue = parseSignals(proof.publicSignals).withdrawnValue;
    const gasPrice = await web3Provider.getGasPrice(chainId);

    const feeGross = withdrawnValue * relayFeeBPS / 10_000n;
    const feeBase = withdrawnValue * assetConfig!.fee_bps / 10_000n;

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
      logger.error(error);
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
  protected async validateWithdrawal(wp: WithdrawalPayload, chainId: ChainId) {
    const chain = new RelayerConfig().chain(chainId);
    const [
      entrypointAddress, 
      feeReceiverAddress, 
      signerPrivateKey, 
    ] = await Promise.all([

      chain.entrypointAddress(),
      chain.feeReceiverAddress(),
      chain.signerPrivateKey(),
    ]);

    const signerAddress = privateKeyToAccount(signerPrivateKey).address;
    
    const extraGas = wp.feeCommitment?.extraGas ?? false;

    // If there's a fee commitment, then we use it's withdrawalData as source of truth to check against the proof.
    const withdrawalData = wp.feeCommitment ? wp.feeCommitment.withdrawalData : wp.withdrawal.data;
    if ((wp.feeCommitment !== undefined) && (wp.feeCommitment.withdrawalData !== wp.withdrawal.data)) {
      const error = 
        `Signed commitment does not match withdrawal data, exiting early: commitment data ${wp.feeCommitment.withdrawalData}, request data ${wp.withdrawal.data}`;
      logger.error(error);
      throw WithdrawalValidationError.relayerCommitmentRejected(error);
    }

    const { feeRecipient, relayFeeBPS } = decodeWithdrawalData(withdrawalData);
    const proofSignals = parseSignals(wp.proof.publicSignals);

    if ((wp.feeCommitment !== undefined) && (wp.feeCommitment.amount > proofSignals.withdrawnValue)) {
      const error = 
        `WithdrawnValue too small: expected "${wp.feeCommitment.amount}", got "${proofSignals.withdrawnValue}".`;
      logger.error(error);
      throw WithdrawalValidationError.withdrawnValueTooSmall(error);
    }

    if (wp.withdrawal.processooor !== entrypointAddress) {
      const error = 
        `Processooor mismatch: expected "${entrypointAddress}", got "${wp.withdrawal.processooor}".`;
      logger.error(error);
      throw WithdrawalValidationError.processooorMismatch(error);
    }

    if (extraGas && !await chain.isFeeReceiverSameAsSigner()) {
      if (getAddress(feeRecipient) !== getAddress(signerAddress)) {
        const error = 
          `Fee recipient with extraGas mismatch: expected "${signerAddress}", got "${feeRecipient}".`;
        logger.error(error);
        throw WithdrawalValidationError.feeReceiverMismatch(error);
      }
    } else {
      if (getAddress(feeRecipient) !== feeReceiverAddress) {
        const error = 
          `Fee recipient mismatch: expected "${feeReceiverAddress}", got "${feeRecipient}".`;
        logger.error(error);
        throw WithdrawalValidationError.feeReceiverMismatch(error);
      }
    }

    const withdrawalContext = BigInt(
      this.sdkProvider.calculateContext({ processooor: wp.withdrawal.processooor, data: withdrawalData }, wp.scope),
    );
    if (proofSignals.context !== withdrawalContext) {
      const error = 
        `Context mismatch: expected "${withdrawalContext.toString(16)}", got "${proofSignals.context.toString(16)}".`;
      logger.error(error);
      throw WithdrawalValidationError.contextMismatch(error);
    }

    const { assetAddress } = await this.sdkProvider.scopeData(wp.scope, chainId);

    // Get asset configuration for this chain and asset
    const [assetConfig, error]  = await chain.assetConfig(assetAddress);

    if (error) {
      logger.error(error);
      throw WithdrawalValidationError.assetNotSupported(error);
    }

    if (wp.feeCommitment) {

      if (wp.feeCommitment.asset != assetAddress) {
        const error = 
          `Asset in commitment does not match withdrawal scope asset: expected ${wp.feeCommitment.asset}, received ${assetAddress}`;
        logger.error(error);
        throw WithdrawalValidationError.relayerCommitmentRejected(error);
      }

      // TODO: remove this check beacuse we should already have errored out at the begining
      const { relayFeeBPS: commitmentRelayFeeBPS } = decodeWithdrawalData(wp.feeCommitment.withdrawalData);
      if (relayFeeBPS !== commitmentRelayFeeBPS) {
        const error = 
          `Proof relay fee does not match signed commitment: pi:=${relayFeeBPS}, commitment:=${commitmentRelayFeeBPS}`;
        logger.error(error);
        throw WithdrawalValidationError.relayerCommitmentRejected(error);
      }

      if (commitmentExpired(wp.feeCommitment)) {
        const error = 
          `Relay fee commitment expired, please quote again`;
        logger.error(error);
        throw WithdrawalValidationError.relayerCommitmentRejected(error);
      }

      if (!await validFeeCommitment(chainId, wp.feeCommitment)) {
        const error = `Invalid relayer commitment`;
        logger.error(error);
        throw WithdrawalValidationError.relayerCommitmentRejected(error);
      }

    } else {

      const currentFeeBPS = await quoteService.quoteFeeBPSNative({
        chainId,
        amountIn: proofSignals.withdrawnValue,
        assetAddress,
        baseFeeBPS: assetConfig!.fee_bps,
        extraGas
      });

      if (relayFeeBPS < currentFeeBPS.feeBPS) {
        const error = 
          `Relay fee too low: expected at least "${currentFeeBPS}", got "${relayFeeBPS}".`;
        logger.error(error);
        throw WithdrawalValidationError.feeTooLow(error);
      }

    }

    if (proofSignals.withdrawnValue < assetConfig!.min_withdraw_amount) {
        const error = 
          `Withdrawn value too small: expected minimum "${assetConfig!.min_withdraw_amount}", got "${proofSignals.withdrawnValue}".`;
        logger.error(error);
      throw WithdrawalValidationError.withdrawnValueTooSmall(error);
    }

  }

}

const logger = createModuleLogger(PrivacyPoolRelayer);

function commitmentExpired(feeCommitment: FeeCommitment): boolean {
  return feeCommitment.expiration < Number(new Date());
}

async function validFeeCommitment(chainId: ChainId, feeCommitment: FeeCommitment): Promise<boolean> {
  return web3Provider.verifyRelayerCommitment(chainId, feeCommitment);
}
