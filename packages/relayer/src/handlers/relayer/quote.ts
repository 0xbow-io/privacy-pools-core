import { NextFunction, Request, Response } from "express";
import { getAddress } from "viem";
import { getAssetConfig, getFeeReceiverAddress, getSignerPrivateKey } from "../../config/index.js";
import { QuoterError } from "../../exceptions/base.exception.js";
import { web3Provider } from "../../providers/index.js";
import { quoteService } from "../../services/index.js";
import { QuoteMarshall } from "../../types.js";
import { encodeWithdrawalData } from "../../utils.js";
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

  const extraGas = Boolean(req.body.extraGas);

  // TODO: set native gas units amount on config
  // TODO: check if the units are ok
  const extraGasUnits = extraGas ? 500_000n : 0n;

  const config = getAssetConfig(chainId, assetAddress);
  if (config === undefined)
    return next(QuoterError.assetNotSupported(`Asset ${assetAddress} for chain ${chainId} is not supported`));

  const feeBPS = await quoteService.quoteFeeBPSNative({
    chainId, amountIn, assetAddress, baseFeeBPS: config.fee_bps, extraGas: extraGas
  });

  const recipient = req.body.recipient ? getAddress(req.body.recipient.toString()) : undefined;

  const quoteResponse = new QuoteMarshall({
    baseFeeBPS: config.fee_bps,
    feeBPS,
  });

  if (recipient) {
    let feeReceiverAddress: `0x${string}`;
    if (extraGas) {
      const finalFeeReceiverAddress = getAddress(getFeeReceiverAddress(chainId));
      const signer = privateKeyToAccount(getSignerPrivateKey(chainId) as `0x${string}`);
      if (finalFeeReceiverAddress.toLowerCase() === signer.address) {
        feeReceiverAddress = getAddress(finalFeeReceiverAddress);
      } else {
        feeReceiverAddress = signer.address;
      }
    } else {
      feeReceiverAddress = getAddress(getFeeReceiverAddress(chainId));
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
