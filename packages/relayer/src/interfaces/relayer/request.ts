import {
  Withdrawal,
  WithdrawalProof,
} from "@0xbow/privacy-pools-core-sdk";

/**
 * Represents the proof payload for a relayer request.
 */
export interface ProofRelayerPayload {
  pi_a: string[];
  pi_b: string[][];
  pi_c: string[];
}

/**
 * Represents the public signals for a withdrawal operation.
 */
export interface WithdrawPublicSignals {
  /** Hash of new commitment */
  newCommitmentHash: bigint;
  /** Hash of the existing commitment nullifier */
  existingNullifierHash: bigint;
  /** Withdrawn value */
  withdrawnValue: bigint;
  /** State root */
  stateRoot: bigint;
  /** Depth of the state tree */
  stateTreeDepth: bigint;
  /** ASP root */
  ASPRoot: bigint;
  /** Depth of the ASP tree */
  ASPTreeDepth: bigint;
  /** Context value */
  context: bigint;
}

/**
 * Represents the payload for a withdrawal relayer request.
 */
export interface WithdrawalRelayerPayload {
  /** Relayer address (0xAdDrEsS) */
  processooor: string;
  /** Transaction data (hex encoded) */
  data: string;
}

/**
 * Represents the request body for a relayer operation.
 */
export interface RelayRequestBody {
  /** Withdrawal details */
  withdrawal: WithdrawalRelayerPayload;
  /** Public signals as string array */
  publicSignals: string[];
  /** Proof details */
  proof: ProofRelayerPayload;
  /** Pool scope */
  scope: string;
}

/**
 * Complete withdrawal payload including proof and public signals.
 */
export interface WithdrawalPayload {
  readonly proof: WithdrawalProof;
  readonly withdrawal: Withdrawal;
  readonly scope: bigint;
}

/**
 * Represents the response from a relayer operation.
 */
export interface RelayerResponse {
  /** Indicates if the request was successful */
  success: boolean;
  /** Timestamp of the response */
  timestamp: number;
  /** Unique request identifier (UUID) */
  requestId: string;
  /** Optional transaction hash */
  txHash?: string;
  /** Optional error message */
  error?: string;
}

/**
 * Enum representing the possible statuses of a relayer request.
 */
export const enum RequestStatus {
  /** Request has been received */
  RECEIVED = "RECEIVED",
  /** Request has been broadcasted */
  BROADCASTED = "BROADCASTED",
  /** Request has failed */
  FAILED = "FAILED",
}
