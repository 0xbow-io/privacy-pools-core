import { NextFunction, Request, Response } from "express";
import { getAddress } from "viem";
import { getAssetConfig, getFeeReceiverAddress, getSignerPrivateKey } from "../../config/index.js";
import { QuoterError } from "../../exceptions/base.exception.js";
import { web3Provider } from "../../providers/index.js";
import { quoteService } from "../../services/index.js";
import { QuoteMarshall } from "../../types.js";
import { encodeWithdrawalData, isFeeReceiverSameAsSigner, isNative } from "../../utils.js";
import { privateKeyToAccount } from "viem/accounts";

const TIME_20_SECS = 20 * 1000;

export async function relayQuoteHandler(
  req: Request,
  res: Response,
  next: NextFunction,
) {

  const chainId = Number(req.body.chainId!);
  const amountIn = BigInt(req.body.amount!.toString());
  const assetAddress = getAddress(req.body.asset!.toString());
  let extraGas = Boolean(req.body.extraGas);

  const config = getAssetConfig(chainId, assetAddress);
  if (config === undefined)
    return next(QuoterError.assetNotSupported(`Asset ${assetAddress} for chain ${chainId} is not supported`));

  if (isNative(assetAddress)) {
    extraGas = false;
  }

  let feeBPS;
  try {
    feeBPS = await quoteService.quoteFeeBPSNative({
      chainId, amountIn, assetAddress, baseFeeBPS: config.fee_bps, extraGas: extraGas
    });
  } catch (e) {
    return next(e);
  }

  const recipient = req.body.recipient ? getAddress(req.body.recipient.toString()) : undefined;

  const quoteResponse = new QuoteMarshall({
    baseFeeBPS: config.fee_bps,
    feeBPS,
  });

  if (recipient) {
    let feeReceiverAddress: `0x${string}`;
    const finalFeeReceiverAddress = getAddress(getFeeReceiverAddress(chainId));
    if (extraGas) {
      const signer = privateKeyToAccount(getSignerPrivateKey(chainId) as `0x${string}`);
      if (isFeeReceiverSameAsSigner(chainId)) {
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
      relayFeeBPS: feeBPS
    });
    const expiration = Number(new Date()) + TIME_20_SECS;
    const relayerCommitment = { withdrawalData, expiration, amount: amountIn, extraGas };
    const signedRelayerCommitment = await web3Provider.signRelayerCommitment(chainId, relayerCommitment);
    quoteResponse.addFeeCommitment({ expiration, withdrawalData, signedRelayerCommitment, extraGas, amount: amountIn });
  }

  res
    .status(200)
    .json(res.locals.marshalResponse(quoteResponse));

}
