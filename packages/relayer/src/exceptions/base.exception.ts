/**
 * Unified error codes for the Relayer.
 */
export enum ErrorCode {
  // Base errors
  UNKNOWN = "UNKNOWN",
  INVALID_INPUT = "INVALID_INPUT",

  // Withdrawal data assertions
  INVALID_DATA = "INVALID_DATA",
  INVALID_ABI = "INVALID_ABI",
  PROCESSOOOR_MISMATCH = "PROCESSOOOR_MISMATCH",
  FEE_RECEIVER_MISMATCH = "FEE_RECEIVER_MISMATCH",
  FEE_MISMATCH = "FEE_MISMATCH",
  FEE_TOO_LOW = "FEE_TOO_LOW",
  CONTEXT_MISMATCH = "CONTEXT_MISMATCH",
  RELAYER_COMMITMENT_REJECTED = "RELAYER_COMMITMENT_REJECTED",
  INSUFFICIENT_WITHDRAWN_VALUE = "INSUFFICIENT_WITHDRAWN_VALUE",
  ASSET_NOT_SUPPORTED = "ASSET_NOT_SUPPORTED",

  // Config errors
  INVALID_CONFIG = "INVALID_CONFIG",
  FEE_BPS_OUT_OF_BOUNDS = "FEE_BPS_OUT_OF_BOUNDS",
  CHAIN_NOT_SUPPORTED = "CHAIN_NOT_SUPPORTED",
  MAX_GAS_PRICE = "MAX_GAS_PRICE",

  // Proof errors
  INVALID_PROOF = "INVALID_PROOF",

  // Contract errors
  CONTRACT_ERROR = "CONTRACT_ERROR",
  TRANSACTION_ERROR = "TRANSACTION_ERROR",

  // SDK error. Wrapper for sdk's native errors
  SDK_ERROR = "SDK_ERROR",

  // Quote errors
  QUOTE_ERROR = "QUOTE_ERROR",
}

/**
 * Base error class for the Relayer.
 * All other error classes should extend this.
 */
export class RelayerError extends Error {
  constructor(
    message: string,
    public readonly code: ErrorCode = ErrorCode.UNKNOWN,
    public readonly details?: Record<string, unknown> | string,
  ) {
    super(message);
    this.name = this.constructor.name;

    // Maintains proper stack trace
    Error.captureStackTrace(this, this.constructor);
  }

  /**
   * Creates a JSON representation of the error.
   */
  public toJSON(): Record<string, unknown> {
    return {
      name: this.name,
      message: this.message,
      code: this.code,
      details: this.details,
    };
  }

  public toPrettyString(): string {
    let details: string;
    if (typeof this.details === "object") {
      details = JSON.stringify(this.details);
    } else if (typeof this.details === "string") {
      details = this.details;
    } else {
      details = "";
    }
    return `${this.name}::${this.code}(${this.message}, ${details})`
  }

  public static unknown(message?: string): RelayerError {
    return new RelayerError(message || "", ErrorCode.UNKNOWN);
  }

  public static assetNotSupported(
    details?: Record<string, unknown> | string) {
    return new RelayerError("Asset is not supported", ErrorCode.ASSET_NOT_SUPPORTED, details);
  }

}

export class ValidationError extends RelayerError {
  constructor(
    message: string,
    code: ErrorCode = ErrorCode.INVALID_INPUT,
    details?: Record<string, unknown>,
  ) {
    super(message, code, details);
    this.name = this.constructor.name;
  }

  /**
   * Creates an error for input validation failures.
   */
  public static invalidInput(
    details?: Record<string, unknown>,
  ): ValidationError {
    return new ValidationError(
      "Failed to parse request payload",
      ErrorCode.INVALID_INPUT,
      details,
    );
  }

  public static invalidQuerystring(
    details?: Record<string, unknown>,
  ): ValidationError {
    return new ValidationError(
      "Failed to parse request parameters",
      ErrorCode.INVALID_INPUT,
      details,
    );
  }

}

export class ZkError extends RelayerError {
  constructor(
    message: string,
    code: ErrorCode = ErrorCode.INVALID_PROOF,
    details?: Record<string, unknown>,
  ) {
    super(message, code, details);
    this.name = this.constructor.name;
  }

  /**
   * Creates an error for input validation failures.
   */
  public static invalidProof(details?: Record<string, unknown>): ZkError {
    return new ZkError("Invalid proof", ErrorCode.INVALID_PROOF, details);
  }
}

export class ConfigError extends RelayerError {
  constructor(
    message: string,
    code: ErrorCode = ErrorCode.INVALID_CONFIG,
    details?: Record<string, unknown> | string,
  ) {
    super(message, code, details);
    this.name = this.constructor.name;
  }

  /**
   * Creates an error for input validation failures.
   */
  public static default(
    details?: Record<string, unknown> | string,
  ): ConfigError {
    return new ConfigError("Invalid config", ErrorCode.INVALID_CONFIG, details);
  }

  /**
   * Creates an error for gas price spikes
   */
  public static maxGasPrice(
    details?: Record<string, unknown> | string,
  ): ConfigError {
    return new ConfigError("Gas price too high", ErrorCode.MAX_GAS_PRICE, details)
  }
}

export class WithdrawalValidationError extends RelayerError {
  constructor(
    message: string,
    code: ErrorCode = ErrorCode.INVALID_DATA,
    details?: Record<string, unknown> | string,
  ) {
    super(message, code, details);
    this.name = this.constructor.name;
  }

  public static invalidWithdrawalAbi(
    details?: Record<string, unknown>,
  ): WithdrawalValidationError {
    return new WithdrawalValidationError(
      "Failed to parse withdrawal data",
      ErrorCode.INVALID_ABI,
      details,
    );
  }

  public static processooorMismatch(
    details?: string,
  ): WithdrawalValidationError {
    return new WithdrawalValidationError(
      "Processooor must be the Entrypoint when relaying",
      ErrorCode.PROCESSOOOR_MISMATCH,
      details,
    );
  }

  public static feeReceiverMismatch(
    details: string,
  ): WithdrawalValidationError {
    return new WithdrawalValidationError(
      "Fee receiver does not match relayer",
      ErrorCode.FEE_RECEIVER_MISMATCH,
      details,
    );
  }

  public static feeTooLow(details: string) {
    return new WithdrawalValidationError(
      "Fee is lower than required by relayer",
      ErrorCode.FEE_TOO_LOW,
      details,
    );
  }

  public static feeMismatch(details: string) {
    return new WithdrawalValidationError(
      "Fee does not match relayer fee",
      ErrorCode.FEE_MISMATCH,
      details,
    );
  }

  public static relayerCommitmentRejected(details: string) {
    return new WithdrawalValidationError(
      "Relayer commitment is too old or invalid",
      ErrorCode.RELAYER_COMMITMENT_REJECTED,
      details,
    );
  }

  public static contextMismatch(details: string) {
    return new WithdrawalValidationError(
      "Context does not match public signal",
      ErrorCode.CONTEXT_MISMATCH,
      details,
    );
  }

  public static withdrawnValueTooSmall(details: string) {
    return new WithdrawalValidationError(
      "Withdrawn value is too small",
      ErrorCode.INSUFFICIENT_WITHDRAWN_VALUE,
      details,
    );
  }

  public static override assetNotSupported(details: string) {
    return new WithdrawalValidationError(
      "Asset not supported on this chain",
      ErrorCode.ASSET_NOT_SUPPORTED,
      details,
    );
  }
}

export class SdkError extends RelayerError {
  constructor(message: string, details?: Record<string, unknown> | string) {
    super(message, ErrorCode.SDK_ERROR, details);
    this.name = this.constructor.name;
  }

  public static scopeDataError(error: Error) {
    return new SdkError(`SdkError: SCOPE_DATA_ERROR ${error.message}`);
  }
}

export class BlockchainError extends RelayerError {
  constructor(message: string, code: ErrorCode = ErrorCode.CONTRACT_ERROR, details?: Record<string, unknown> | string) {
    super(message, code, details);
    this.name = this.constructor.name;
  }

  public static txError(
    details?: Record<string, unknown> | string) {
    return new BlockchainError("Transaction failed", ErrorCode.TRANSACTION_ERROR, details);
  }

}

export class QuoterError extends RelayerError {
  constructor(message: string, code: ErrorCode = ErrorCode.QUOTE_ERROR, details?: Record<string, unknown> | string) {
    super(message, code, details);
    this.name = this.constructor.name;
  }

  public static override assetNotSupported(
    details?: Record<string, unknown> | string) {
    return new QuoterError("Asset is not supported", ErrorCode.ASSET_NOT_SUPPORTED, details);
  }

}
