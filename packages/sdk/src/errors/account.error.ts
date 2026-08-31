import { ErrorCode, SDKError } from "./base.error.js";
import { Hash } from "../types/commitment.js";

export class AccountError extends SDKError {
  constructor(
    message: string,
    code: ErrorCode = ErrorCode.OPERATION_FAILED,
    details?: Record<string, unknown>,
  ) {
    super(message, code, details);
    this.name = "AccountError";
  }

  public static commitmentNotFound(hash: Hash | string): AccountError {
    const hashStr = typeof hash === 'string' ? hash : hash.toString();
    return new AccountError(
      `No account found for commitment ${hashStr}`,
      ErrorCode.INVALID_INPUT,
    );
  }

  public static invalidPoolAccount(): AccountError {
    return new AccountError(
      "Invalid pool account state",
      ErrorCode.INVALID_INPUT,
    );
  }

  public static accountInitializationFailed(reason: string): AccountError {
    return new AccountError(
      `Failed to initialize account: ${reason}`,
      ErrorCode.OPERATION_FAILED,
    );
  }

  public static duplicatePools(scope: bigint): AccountError {
    return new AccountError(
      `Duplicate pools found for scope: ${scope.toString()}`,
      ErrorCode.INVALID_INPUT,
    );
  }

  public static invalidIndex(index: bigint): AccountError {
    return new AccountError(
      `Invalid index: ${index.toString()}`,
      ErrorCode.INVALID_INPUT,
    );
  }

  public static incompleteScopeHistory(scope: Hash): AccountError {
    return new AccountError(
      `Cannot derive the next deposit index for scope ${scope.toString()}: ` +
      `its event history failed to load, so reconstructed state is incomplete. ` +
      `Reload the account for this scope, or pass an explicit index.`,
      ErrorCode.OPERATION_FAILED,
      { scope },
    );
  }
} 