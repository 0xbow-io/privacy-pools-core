import { NextFunction, Response } from "express";
import { RelayerConfig } from "../../config/index.js";
import { RelayerError } from "../../exceptions/base.exception.js";
import { DetailsRequest } from "../../middlewares/index.js";
import { DetailsMarshall } from "../../types.js";

/**
 * Handler for the relayer details endpoint.
 * Supports querying by chain ID and asset address.
 * Returns details about the fee structure for a specific asset on a specific chain.
 * 
 * @param {Request} req - The HTTP request.
 * @param {Response} res - The HTTP response.
 * @param {NextFunction} next - The next middleware function.
 */
export async function relayerDetailsHandler(
  req: DetailsRequest,
  res: Response,
  next: NextFunction,
) {
  try {
    const chainId = req.parsedQuery.chainId;
    const assetAddress = req.parsedQuery.assetAddress;

    const chain = new RelayerConfig().chain(chainId);

    const feeReceiverAddress = await chain.feeReceiverAddress();

    const [assetConfig, error] = await chain.assetConfig(assetAddress);

    if (error) {
      return next(RelayerError.assetNotSupported({
        message: `Asset ${assetAddress} for chain ${chainId} is not supported`
      }));
    }

    res.status(200).json(
      res.locals.marshalResponse(
        new DetailsMarshall({
          feeBPS: assetConfig!.fee_bps,
          feeReceiverAddress,
          chainId,
          maxGasPrice: await chain.max_gas_price(),
          assetAddress: assetAddress,
          minWithdrawAmount: assetConfig!.min_withdraw_amount
        })
      )
    );

    next();
  } catch (error) {
    console.error(error);
    next(error);
  }
}
