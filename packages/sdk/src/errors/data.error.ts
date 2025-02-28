import { ErrorCode, SDKError } from "./base.error.js";

export class DataError extends SDKError {
  constructor(
    message: string,
    code: ErrorCode = ErrorCode.NETWORK_ERROR,
    details?: Record<string, unknown>,
  ) {
    super(message, code, details);
    this.name = "DataError";
  }

  public static invalidLog(type: string, reason: string): DataError {
    return new DataError(
      `Invalid ${type} log: ${reason}`,
      ErrorCode.INVALID_INPUT,
    );
  }

  public static chainNotConfigured(chainId: number): DataError {
    return new DataError(
      `No configuration found for chain ID ${chainId}`,
      ErrorCode.INVALID_INPUT,
    );
  }

  public static networkError(chainId: number, error: Error): DataError {
    return new DataError(
      `Network error on chain ${chainId}: ${error.message}`,
      ErrorCode.NETWORK_ERROR,
      { originalError: error },
    );
  }
} 