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
} 