/**
 * Unified error codes for the SDK.
 */
export enum ErrorCode {
  // Base errors
  UNKNOWN = "UNKNOWN",
  INVALID_INPUT = "INVALID_INPUT",
  OPERATION_FAILED = "OPERATION_FAILED",
  NETWORK_ERROR = "NETWORK_ERROR",

  // Proof errors
  PROOF_GENERATION_FAILED = "PROOF_GENERATION_FAILED",
  PROOF_VERIFICATION_FAILED = "PROOF_VERIFICATION_FAILED",
  INVALID_PROOF = "INVALID_PROOF",
  INVALID_PUBLIC_SIGNALS = "INVALID_PUBLIC_SIGNALS",
  CIRCUIT_ERROR = "CIRCUIT_ERROR",

  // Contract errors
  CONTRACT_ERROR = "CONTRACT_ERROR",

  // Crypto errors
  CRYPTO_ERROR = "CRYPTO_ERROR",
  MERKLE_ERROR = "MERKLE_ERROR",
}

/**
 * Base error class for the SDK.
 * All other error classes should extend this.
 */
export class SDKError extends Error {
  constructor(
    message: string,
    public readonly code: ErrorCode = ErrorCode.UNKNOWN,
    public readonly details?: Record<string, unknown>,
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
      stack: this.stack,
    };
  }
}

/**
 * Specialized error class for proof-related operations.
 */
export class ProofError extends SDKError {
  constructor(
    message: string,
    code: ErrorCode = ErrorCode.PROOF_GENERATION_FAILED,
    details?: Record<string, unknown>,
  ) {
    super(message, code, details);
  }

  /**
   * Creates an error for proof generation failures.
   */
  public static generationFailed(
    details?: Record<string, unknown>,
  ): ProofError {
    return new ProofError(
      "Failed to generate proof",
      ErrorCode.PROOF_GENERATION_FAILED,
      details,
    );
  }

  /**
   * Creates an error for proof verification failures.
   */
  public static verificationFailed(
    details?: Record<string, unknown>,
  ): ProofError {
    return new ProofError(
      "Failed to verify proof",
      ErrorCode.PROOF_VERIFICATION_FAILED,
      details,
    );
  }

  /**
   * Creates an error for invalid proof format.
   */
  public static invalidProof(details?: Record<string, unknown>): ProofError {
    return new ProofError(
      "Invalid proof format",
      ErrorCode.INVALID_PROOF,
      details,
    );
  }
}

export class ContractError extends SDKError {
  constructor(
    message: string,
    code: ErrorCode = ErrorCode.CONTRACT_ERROR,
    details?: Record<string, unknown>,
  ) {
    super(message, code);
    this.name = "ContractError";
  }

  public static scopeNotFound(scope: bigint): ContractError {
    return new ContractError(`No pool found for scope ${scope.toString()}`, ErrorCode.CONTRACT_ERROR);
  }

  public static assetNotFound(address: string): ContractError {
    return new ContractError(`Asset ${address} has no pool`, ErrorCode.CONTRACT_ERROR);
  }

}
