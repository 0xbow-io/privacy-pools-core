import * as snarkjs from "snarkjs";
import {
  CircuitName,
  CircuitsInterface,
  CircuitSignals,
} from "../interfaces/circuits.interface.js";
import { CommitmentProof } from "../types/commitment.js";
import { ProofError } from "../errors/base.error.js";

/**
 * Service responsible for handling commitment-related operations.
 * All hash operations use Poseidon for ZK-friendly hashing.
 */
export class CommitmentService {
  constructor(private readonly circuits: CircuitsInterface) {}

  /**
   * Generates a zero-knowledge proof for a commitment using Poseidon hash.
   *
   * @param value - The value being committed to
   * @param label - Label associated with the commitment
   * @param nullifier - Unique nullifier for the commitment
   * @param secret - Secret key for the commitment
   * @returns Promise resolving to proof and public signals
   * @throws {ProofError} If proof generation fails
   */
  public async proveCommitment(
    value: bigint,
    label: bigint,
    nullifier: bigint,
    secret: bigint,
  ): Promise<CommitmentProof> {
    try {
      const inputSignals: CircuitSignals = {
        value,
        label,
        nullifier,
        secret,
      };

      const wasm = await this.circuits.getWasm(CircuitName.Commitment);
      const zkey = await this.circuits.getProvingKey(CircuitName.Commitment);

      const { proof, publicSignals } = await snarkjs.groth16.fullProve(
        inputSignals,
        wasm,
        zkey,
      );

      return { proof, publicSignals };
    } catch (error) {
      throw ProofError.generationFailed({
        error: error instanceof Error ? error.message : "Unknown error",
        inputSignals: { value, label, nullifier },
      });
    }
  }

  /**
   * Verifies a commitment proof.
   *
   * @param proof - The commitment proof to verify
   * @param publicSignals - Public signals associated with the proof
   * @returns Promise resolving to boolean indicating proof validity
   * @throws {ProofError} If verification fails
   */
  public async verifyCommitment({
    proof,
    publicSignals,
  }: CommitmentProof): Promise<boolean> {
    try {
      const vkeyBuff = await this.circuits.getVerificationKey(
        CircuitName.Commitment,
      );
      const vkey = JSON.parse(new TextDecoder("utf-8").decode(vkeyBuff));

      return await snarkjs.groth16.verify(vkey, publicSignals, proof);
    } catch (error) {
      throw ProofError.verificationFailed({
        error: error instanceof Error ? error.message : "Unknown error",
      });
    }
  }
}
