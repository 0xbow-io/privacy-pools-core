import { ErrorCode } from "./base.error.js";
import { DataError } from "./data.error.js";
import { Hash } from "../types/commitment.js";

export class EventError extends DataError {
  constructor(
    message: string,
    code: ErrorCode = ErrorCode.NETWORK_ERROR,
    details?: Record<string, unknown>,
  ) {
    super(message, code, details);
    this.name = "EventError";
  }

  public static depositEventError(chainId: number, scope: Hash, error: Error): EventError {
    return new EventError(
      `Error fetching deposit events for chain ${chainId}: ${error.message}`,
      ErrorCode.NETWORK_ERROR,
      { originalError: error, scope },
    );
  }

  public static withdrawalEventError(chainId: number, scope: Hash, error: Error): EventError {
    return new EventError(
      `Error fetching withdrawal events for chain ${chainId}: ${error.message}`,
      ErrorCode.NETWORK_ERROR,
      { originalError: error, scope },
    );
  }

  public static ragequitEventError(chainId: number, scope: Hash, error: Error): EventError {
    return new EventError(
      `Error fetching ragequit events for chain ${chainId}: ${error.message}`,
      ErrorCode.NETWORK_ERROR,
      { originalError: error, scope },
    );
  }
} 