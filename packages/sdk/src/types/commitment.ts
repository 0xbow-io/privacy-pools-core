import { Groth16Proof, PublicSignals } from "snarkjs";

/**
 * Represents a hash value in the system.
 * This is a branded type to ensure type safety.
 */
export type Hash = bigint & { readonly __brand: unique symbol };

/**
 * Represents a secret value in the system.
 * This is a branded type to ensure type safety.
 */
export type Secret = bigint & { readonly __brand: unique symbol };

/**
 * Represents a precommitment structure containing the hash, nullifier, and secret.
 * All hashes are computed using Poseidon.
 */
export interface Precommitment {
  readonly hash: Hash;
  readonly nullifier: Secret;
  readonly secret: Secret;
}

/**
 * Represents the preimage of a commitment containing the value, label, and precommitment.
 */
export interface CommitmentPreimage {
  readonly value: bigint;
  readonly label: bigint;
  readonly precommitment: Precommitment;
}

/**
 * Represents a complete commitment structure.
 * All hashes are computed using Poseidon.
 */
export interface Commitment {
  readonly hash: Hash;
  readonly nullifierHash: Hash;
  readonly preimage: CommitmentPreimage;
}

/**
 * Represents the result of a commitment proof operation.
 */
export interface CommitmentProof {
  readonly proof: Groth16Proof;
  readonly publicSignals: PublicSignals;
}
