import { NextFunction, Response } from "express";
import { Address, getAddress } from "viem";
import { privateKeyToAccount } from "viem/accounts";
import {
  isExceptionToken,
  RelayerConfig
} from "../../config/index.js";
import { QuoterError } from "../../exceptions/base.exception.js";
import { createModuleLogger } from "../../logger/index.js";
import { QuoteRequest } from "../../middlewares/index.js";
import { web3Provider } from "../../providers/index.js";
import { quoteService } from "../../services/index.js";
import { QuoteFee } from "../../services/quote.service.js";
import { QuoteMarshall } from "../../types.js";
import {
  encodeWithdrawalData,
  isNative
} from "../../utils.js";

// const TIME_20_SECS = 20 * 1000;
const TIME_60_SECS = 60 * 1000;

const logger = createModuleLogger(relayQuoteHandler);
const EXPIRATION_TIME = TIME_60_SECS;

export async function relayQuoteHandler(
  req: QuoteRequest,
  res: Response,
  next: NextFunction,
) {

  const chainId = req.body.chainId;
  const amountIn = req.body.amount;
  const asset = req.body.asset;
  let extraGas = Boolean(req.body.extraGas);

  const chain = new RelayerConfig().chain(chainId);
  const [assetConfig, _] = await chain.assetConfig(asset);
  if (assetConfig === undefined)
    return next(QuoterError.assetNotSupported(`Asset ${asset} for chain ${chainId} is not supported`));

  if (isNative(asset)) {
    extraGas = false;
  }

  // XXX: Block extraGas for EXCEPTION_TOKENS
  if (extraGas && isExceptionToken(asset)) {
    return next(
      QuoterError.assetNotSupported(
        `Extra gas feature not supported for ${asset}`,
      ),
    );
  }

  let quote: QuoteFee;
  try {
    quote = await quoteService.quoteFeeBPSNative({
      chainId,
      amountIn,
      assetAddress: asset,
      baseFeeBPS: assetConfig.fee_bps,
      extraGas,
    });
  } catch (e) {
    return next(e);
  }

  const {
    feeBPS,
    gasPrice,
    extraGasFundAmount,
    relayTxCost,
    extraGasTxCost
  } = quote;


  const recipient = req.body.recipient
    ? getAddress(req.body.recipient.toString())
    : undefined;
  const detail = {
    relayTxCost: { gas: relayTxCost, eth: relayTxCost * gasPrice },
    extraGasFundAmount: extraGasFundAmount
      ? { gas: extraGasFundAmount, eth: extraGasFundAmount * gasPrice }
      : undefined,
    extraGasTxCost: extraGasTxCost
      ? { gas: extraGasTxCost, eth: extraGasTxCost * gasPrice }
      : undefined,
  };

  const quoteResponse = new QuoteMarshall({
    baseFeeBPS: assetConfig.fee_bps,
    feeBPS,
    gasPrice,
    detail,
  });

  if (recipient) {
    let feeReceiverAddress: Address;
    const finalFeeReceiverAddress = await chain.feeReceiverAddress();
    if (extraGas) {
      const signer = privateKeyToAccount(await chain.signerPrivateKey());
      if (await chain.isFeeReceiverSameAsSigner()) {
        feeReceiverAddress = finalFeeReceiverAddress;
      } else {
        feeReceiverAddress = signer.address;
      }
    } else {
      feeReceiverAddress = finalFeeReceiverAddress;
    }
    const withdrawalData = encodeWithdrawalData({
      feeRecipient: getAddress(feeReceiverAddress),
      recipient,
      relayFeeBPS: feeBPS,
    });
    const expiration = Number(new Date()) + EXPIRATION_TIME;
    const relayerCommitment = {
      withdrawalData,
      expiration,
      asset,
      amount: amountIn,
      extraGas,
    };
    const signedRelayerCommitment = await web3Provider.signRelayerCommitment(
      chainId,
      relayerCommitment,
    );

    quoteResponse.addFeeCommitment({
      expiration,
      asset,
      withdrawalData,
      signedRelayerCommitment,
      extraGas,
      amount: amountIn,
    });
  }

  const logPayload = {
    quote_request: {
      chain_id: chainId,
      asset,
      gas_price: gasPrice,
      value_in: amountIn,
      value_out: quote.out!,
      detail,
      fee_bps: feeBPS,
      base_fee_bps: assetConfig.fee_bps
    },
  };

  logger.info("Quote generated", logPayload);

  if (feeBPS >= assetConfig.fee_bps * 2n) {
    logger.warn(
      "Generated quote might be too high for requested amount",
      logPayload
    );
  }

  res.status(200).json(res.locals.marshalResponse(quoteResponse));
}
