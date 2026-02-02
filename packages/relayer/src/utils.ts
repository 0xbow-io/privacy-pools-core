import {
  Address,
  Chain,
  ContractFunctionExecutionError,
  ContractFunctionRevertedError,
  decodeAbiParameters, DecodeAbiParametersErrorType,
  encodeAbiParameters,
  EncodeAbiParametersErrorType,
  BaseError as ViemError
} from "viem";
import {
  ValidationError,
  WithdrawalValidationError,
} from "./exceptions/base.exception.js";
import {
  RelayRequestBody,
  WithdrawPublicSignals,
} from "./interfaces/relayer/request.js";
import { FeeDataAbi } from "./types/abi.types.js";
import { ChainId } from "./types.js";
import { RelayerConfig } from "./config/config.js";


export const JSONStringifyBigInt = (json_string: object) => {
  return JSON.stringify(json_string, (_: string, v: unknown) => typeof v === 'bigint' ? v.toString() : v, 2);
};

interface WithdrawalData {
  recipient: Address,
  feeRecipient: Address,
  relayFeeBPS: bigint;
}

export function decodeWithdrawalData(data: `0x${string}`): WithdrawalData {
  try {
    const [{ recipient, feeRecipient, relayFeeBPS }] = decodeAbiParameters(
      FeeDataAbi,
      data,
    );
    return { recipient, feeRecipient, relayFeeBPS };
  } catch (e) {
    const error = e as DecodeAbiParametersErrorType;
    throw WithdrawalValidationError.invalidWithdrawalAbi({
      name: error.name,
      message: error.message,
    });
  }
}

export function encodeWithdrawalData(withdrawalData: WithdrawalData): `0x${string}` {
  try {
    return encodeAbiParameters(FeeDataAbi, [withdrawalData]);
  } catch (e) {
    const error = e as EncodeAbiParametersErrorType;
    throw WithdrawalValidationError.invalidWithdrawalAbi({
      name: error.name,
      message: error.message,
    });
  }
}

export function parseSignals(
  signals: RelayRequestBody["publicSignals"],
): WithdrawPublicSignals {
  const badSignals = signals
    .map((x, i) => (x === undefined ? i : null))
    .filter((i) => i !== null);
  if (badSignals.length > 0) {
    throw ValidationError.invalidInput({
      details: `Signals ${badSignals.join(", ")} are undefined`,
    });
  }
  /// XXX: beware this signal distribution is based on how the circuits were compiled with circomkit, first 2 are the public outputs, next are the public inputs
  return {
    newCommitmentHash: BigInt(signals[0]!), // Hash of new commitment
    existingNullifierHash: BigInt(signals[1]!), // Hash of the existing commitment nullifier
    withdrawnValue: BigInt(signals[2]!),
    stateRoot: BigInt(signals[3]!),
    stateTreeDepth: BigInt(signals[4]!),
    ASPRoot: BigInt(signals[5]!),
    ASPTreeDepth: BigInt(signals[6]!),
    context: BigInt(signals[7]!),
  };
}

export async function createChainObjectFromBrandedChainId(chainId: ChainId): Promise<Chain> {
  const config = new RelayerConfig().chain(chainId);
  const [chain_name, rpc_url] = await Promise.all([
    config.chain_name(),
    config.rpc_url()
  ]);
  return createChainObject({
    chain_id: config.chainId as ChainId, chain_name, rpc_url
  });
}

/**
 * Creates a Chain object for the given chain configuration
 * 
 * @param {object} chainConfig - The chain configuration
 * @returns {Chain} - The Chain object
 */
export function createChainObject(chainConfig: {
  chain_id: ChainId;
  chain_name: string;
  rpc_url: string;
  native_currency?: { name: string; symbol: string; decimals: number; };
}): Chain {
  return {
    id: chainConfig.chain_id,
    name: chainConfig.chain_name,
    nativeCurrency: chainConfig.native_currency || {
      name: "Ether",
      symbol: "ETH",
      decimals: 18
    },
    rpcUrls: {
      default: { http: [chainConfig.rpc_url] },
      public: { http: [chainConfig.rpc_url] },
    },
  };
}

export function isViemError(error: unknown): error is ViemError {
  const viemErrorNames = [
    ContractFunctionExecutionError.prototype.constructor.name,
    ContractFunctionRevertedError.prototype.constructor.name,
  ];
  return viemErrorNames.includes(error?.constructor?.name || "");
}

export function isNative(asset: `0x${string}`) {
  return asset.toLowerCase() === "0xeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeee";
}

export function min(a: bigint, b: bigint): bigint {
  return a < b ? a : b;
}

export function max(a: bigint, b: bigint): bigint {
  return a > b ? a : b;
}
