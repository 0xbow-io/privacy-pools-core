import { NextFunction, Response } from "express";
import { isExceptionToken, RelayerConfig } from "../../config/index.js";
import { ConfigError, RelayerError, ValidationError } from "../../exceptions/base.exception.js";
import {
  RelayerResponse,
  WithdrawalPayload,
} from "../../interfaces/relayer/request.js";
import { createModuleLogger } from "../../logger/index.js";
import { RelayRequest } from "../../middlewares/relayer/request.js";
import { web3Provider } from "../../providers/index.js";
import { RelayBody } from "../../schemes/relayer/request.scheme.js";
import { privacyPoolRelayer } from "../../services/index.js";
import { ChainId, RequestMarshall } from "../../types.js";
import { decodeWithdrawalData } from "../../utils.js";

const logger = createModuleLogger(relayRequestHandler);

/**
 * Converts a RelayRequestBody into a WithdrawalPayload.
 *
 * @param {RelayRequestBody} body - The relay request body containing proof and withdrawal details.
 * @returns {WithdrawalPayload} - The formatted withdrawal payload.
 */
function relayRequestBodyToWithdrawalPayload(
  body: RelayBody,
): WithdrawalPayload {
  return {
    ...body,
    proof: {
      proof: {
        ...body.proof,
        protocol: "groth16",
        curve: "bn128"
      },
      publicSignals: body.publicSignals,
    },
  };
}

/**
 * Parses and validates the withdrawal request body.
 *
 * @param {Request["body"]} body - The request body to parse.
 * @returns {{ payload: WithdrawalPayload, chainId: number }} - The validated withdrawal payload and chain ID.
 * @throws {ValidationError} - If the input data is invalid.
 * @throws {ConfigError} - If the chain is not supported.
 */
async function parseWithdrawal(body: RelayRequest["body"]): Promise<{ payload: WithdrawalPayload, chainId: ChainId; }> {
  const payload = relayRequestBodyToWithdrawalPayload(body);

  const chainId = body.chainId;
  const chain = new RelayerConfig().chain(chainId);
  const isChainSupportedThough = await chain.isChainSupported(chainId);

  // Check if the chain is supported early
  if (!isChainSupportedThough) {
    throw ValidationError.invalidInput({ message: `Chain with ID ${chainId} not supported.` });
  }
  return { payload, chainId };
}

/**
 * Express route handler for relaying requests.
 *
 * @param {Request} req - The incoming HTTP request.
 * @param {Response} res - The HTTP response object.
 * @param {NextFunction} next - The next middleware function.
 */
export async function relayRequestHandler(
  req: RelayRequest,
  res: Response,
  next: NextFunction,
) {
  try {
    const { payload: withdrawalPayload, chainId } = await parseWithdrawal(req.body);

    const chain = new RelayerConfig().chain(chainId);
    const config = await chain.config();
    const maxGasPrice = config.max_gas_price;
    const currentGasPrice = await web3Provider.getGasPrice(chainId);

    // XXX: Block extraGas for EXCEPTION_TOKENS
    if (withdrawalPayload.feeCommitment?.extraGas && isExceptionToken(withdrawalPayload.feeCommitment?.asset)) {
      return next(RelayerError.assetNotSupported(`Extra gas feature not supported for ${withdrawalPayload.feeCommitment?.asset}`));
    }

    if (maxGasPrice !== undefined && currentGasPrice > maxGasPrice) {
      return next(ConfigError.maxGasPrice(`Current gas price ${currentGasPrice} is higher than max price ${maxGasPrice}`));
    }

    const requestResponse: RelayerResponse =
      await privacyPoolRelayer.handleRequest(withdrawalPayload, chainId);

    const response = new RequestMarshall(requestResponse);

    const { recipient, relayFeeBPS } = decodeWithdrawalData(withdrawalPayload.withdrawal.data);
    const feeCommitment = withdrawalPayload.feeCommitment!;
    const [assetConfig, _] = await chain.assetConfig(feeCommitment.asset);

    const logPayload = {
      chain_id: chainId,
      fee_commitment: feeCommitment,
      gas_price: currentGasPrice,
      recieving_address: recipient,
      tx_reciept: response
    };

    logger.info("Request generated", logPayload);

    if (relayFeeBPS >= assetConfig!.fee_bps * 2n) {
      logger.warn(
        "Generated quote might be too high for requested amount",
        logPayload
      );
    }

    res
      .status(200)
      .json(res.locals.marshalResponse(response));
    next();
  } catch (error) {
    next(error);
  }
}
