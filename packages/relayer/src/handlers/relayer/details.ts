import { NextFunction, Request, Response } from "express";
import { DetailsMarshall } from "../../types.js";
import { getAddress } from "viem/utils";
import { Address } from "viem/accounts";
import { CONFIG, getAssetConfig, getChainConfig } from "../../config/index.js";
import { ValidationError } from "../../exceptions/base.exception.js";

/**
 * Handler for the relayer details endpoint.
 * Supports querying by chain ID and asset address.
 * Returns details about the fee structure for a specific asset on a specific chain.
 * 
 * @param {Request} req - The HTTP request.
 * @param {Response} res - The HTTP response.
 * @param {NextFunction} next - The next middleware function.
 */
export function relayerDetailsHandler(
  req: Request,
  res: Response,
  next: NextFunction,
) {
  // Get query parameters
  const chainIdParam = req.query.chainId as string;
  const assetAddressParam = req.query.assetAddress as string;

  // Parse chain ID
  const parsedChainId = parseInt(chainIdParam, 10);
  if (isNaN(parsedChainId)) {
    throw ValidationError.invalidInput({ message: "Invalid chain ID format" });
  }
  const chainId = parsedChainId;

  // Validate asset address format
  let normalizedAssetAddress: string;
  try {
    normalizedAssetAddress = getAddress(assetAddressParam);
  } catch {
    throw ValidationError.invalidInput({ message: "Invalid asset address format" });
  }

  // Get chain configuration
  const chainConfig = getChainConfig(chainId);

  // Get fee receiver address for this chain
  const feeReceiverAddress = chainConfig.fee_receiver_address || CONFIG.defaults.fee_receiver_address;

  // Get asset configuration  
  const assetConfig = getAssetConfig(chainId, normalizedAssetAddress);

  if (!assetConfig) {
    throw ValidationError.invalidInput({
      message: `Asset ${normalizedAssetAddress} not supported on chain ${chainId}`
    });
  }

  // Return details for the specific asset
  res.status(200).json(
    res.locals.marshalResponse(
      new DetailsMarshall({
        feeBPS: assetConfig.fee_bps,
        feeReceiverAddress: getAddress(feeReceiverAddress),
        chainId,
        maxGasPrice: chainConfig.max_gas_price,
        assetAddress: normalizedAssetAddress as Address,
        minWithdrawAmount: assetConfig.min_withdraw_amount
      })
    )
  );

  next();
}
