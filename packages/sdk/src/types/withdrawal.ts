import { Address, Hex } from "viem";
import { Groth16Proof, PublicSignals } from "snarkjs";
import { LeanIMTMerkleProof } from "@zk-kit/lean-imt";
import { Hash, Secret } from "./commitment.js";

/**
 * Represents a withdrawal request in the system.
 */
export interface Withdrawal {
  readonly processooor: Address;
  readonly data: Hex;
}

export interface WithdrawalProof {
  readonly proof: Groth16Proof;
  readonly publicSignals: PublicSignals;
}

/**
 * Input parameters required for withdrawal proof generation.
 */
export interface WithdrawalProofInput {
  readonly context: bigint;
  readonly withdrawalAmount: bigint;
  readonly stateMerkleProof: LeanIMTMerkleProof<bigint>;
  readonly aspMerkleProof: LeanIMTMerkleProof<bigint>;
  readonly stateRoot: Hash;
  readonly stateTreeDepth: bigint;
  readonly aspRoot: Hash;
  readonly aspTreeDepth: bigint;
  readonly newSecret: Secret;
  readonly newNullifier: Secret;
}
