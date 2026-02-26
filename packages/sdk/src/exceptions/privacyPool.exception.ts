export enum ErrorCode {
  INVALID_COMMITMENT = "INVALID_COMMITMENT",
  INVALID_MERKLE_PROOF = "INVALID_MERKLE_PROOF",
  INVALID_NULLIFIER = "INVALID_NULLIFIER",
  INVALID_SECRET = "INVALID_SECRET",
  INVALID_VALUE = "INVALID_VALUE",
  INVALID_LABEL = "INVALID_LABEL",
  MERKLE_ERROR = "MERKLE_ERROR",
}

export class PrivacyPoolError extends Error {
  constructor(
    public code: ErrorCode,
    message: string,
  ) {
    super(message);
    this.name = "PrivacyPoolError";
  }
}
