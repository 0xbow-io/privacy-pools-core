import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { CircuitsMock, binariesMock } from "../mocks/index.js";
import { PrivacyPoolSDK } from "../../src/core/sdk.js";
import * as snarkjs from "snarkjs";
import { Commitment, Hash, Secret } from "../../src/types/commitment.js";
import { LeanIMTMerkleProof } from "@zk-kit/lean-imt";
import { getAddress } from "viem";
import { ProofError } from "../../src/errors/base.error.js";

vi.mock("snarkjs");
vi.mock("viem", () => ({
  keccak256: vi.fn().mockReturnValue("0x1234"),
  getAddress: vi.fn().mockImplementation((addr) => addr),
  encodeAbiParameters: vi.fn().mockImplementation((types, values) => ({
    types,
    values,
  })),
}));

describe("PrivacyPoolSDK", () => {
  let circuits: CircuitsMock;
  let sdk: PrivacyPoolSDK;

  beforeEach(() => {
    circuits = new CircuitsMock();
    sdk = new PrivacyPoolSDK(circuits);
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  describe("commitment operations", () => {
    it("should use Circuits binaries and delegate to snarkjs prover", async () => {
      snarkjs.groth16.fullProve = vi.fn().mockResolvedValue({
        proof: "PROOF",
        publicSignals: "SIGNALS"
      });

      const inputSignals = {
        value: BigInt(1),
        label: BigInt(2),
        nullifier: BigInt(3),
        secret: BigInt(4),
      };

      const downloadArtifactsSpy = vi
        .spyOn(circuits, "downloadArtifacts")
        .mockResolvedValue(binariesMock);

      const result = await sdk.proveCommitment(
        BigInt(1),
        BigInt(2),
        BigInt(3) as Secret,
        BigInt(4) as Secret,
      );

      expect(result).toStrictEqual({
        proof: "PROOF",
        publicSignals: "SIGNALS"
      });
      expect(downloadArtifactsSpy).toHaveBeenCalledOnce();
      expect(snarkjs.groth16.fullProve).toHaveBeenCalledWith(
        inputSignals,
        binariesMock.commitment.wasm,
        binariesMock.commitment.zkey,
      );
    });

    it("should throw an error if commitment proof verification fails", async () => {
      circuits.getVerificationKey = vi
        .fn()
        .mockResolvedValue(new TextEncoder().encode("{}"));
      snarkjs.groth16.verify = vi
        .fn()
        .mockRejectedValue(new Error("Verification error"));

      await expect(
        sdk.verifyCommitment({
          proof: {} as snarkjs.Groth16Proof,
          publicSignals: []
        }),
      ).rejects.toThrow(ProofError);
    });

    it("should return true for a valid commitment proof", async () => {
      circuits.getVerificationKey = vi
        .fn()
        .mockResolvedValue(new TextEncoder().encode("{}"));
      snarkjs.groth16.verify = vi.fn().mockResolvedValue(true);

      const result = await sdk.verifyCommitment({
        proof: {} as snarkjs.Groth16Proof,
        publicSignals: []
      });
      expect(result).toBe(true);
    });
  });

  describe("withdrawal operations", () => {
    const mockCommitment: Commitment = {
      hash: BigInt(1) as Hash,
      nullifierHash: BigInt(2) as Hash,
      preimage: {
        value: BigInt(1000),
        label: BigInt(3),
        precommitment: {
          hash: BigInt(0) as Hash,
          nullifier: BigInt(2) as Secret,
          secret: BigInt(4) as Secret,
        },
      },
    };

    it("should use circuits binaries and delegate to snarkjs prover", async () => {
      snarkjs.groth16.fullProve = vi.fn().mockResolvedValue({
        proof: "mockProof",
        publicSignals: "mockPublicSignals",
      });

      const stateMerkleProof: LeanIMTMerkleProof<bigint> = {
        root: BigInt(5),
        leaf: mockCommitment.hash,
        index: 1,
        siblings: [BigInt(6), BigInt(7)],
      };

      const aspMerkleProof: LeanIMTMerkleProof<bigint> = {
        root: BigInt(8),
        leaf: BigInt(3),
        index: 2,
        siblings: [BigInt(9), BigInt(10)],
      };

      const withdrawal = {
        procesooor: getAddress("0x1234567890123456789012345678901234567890"),
        scope: BigInt(11) as Hash,
        data: new Uint8Array(),
      };

      const withdrawalInput = {
        withdrawalAmount: BigInt(500),
        stateMerkleProof,
        aspMerkleProof,
        stateRoot: BigInt(5) as Hash,
        aspRoot: BigInt(8) as Hash,
        newNullifier: BigInt(12) as Secret,
        newSecret: BigInt(13) as Secret,
      };

      const downloadArtifactsSpy = vi
        .spyOn(circuits, "downloadArtifacts")
        .mockResolvedValue(binariesMock);

      const result = await sdk.proveWithdrawal(
        mockCommitment,
        withdrawalInput,
        withdrawal,
      );

      expect(result).toHaveProperty("proof", "mockProof");
      expect(result).toHaveProperty("publicSignals", "mockPublicSignals");
      expect(result).toHaveProperty("withdrawal", withdrawal);
      expect(downloadArtifactsSpy).toHaveBeenCalledOnce();
    });

    it("should throw error on proof generation failure", async () => {
      snarkjs.groth16.fullProve = vi
        .fn()
        .mockRejectedValue(new Error("Proof error"));

      const mockStateMerkleProof: LeanIMTMerkleProof<bigint> = {
        root: BigInt(5),
        leaf: mockCommitment.hash,
        index: 1,
        siblings: [BigInt(6), BigInt(7)],
      };

      const mockAspMerkleProof: LeanIMTMerkleProof<bigint> = {
        root: BigInt(8),
        leaf: BigInt(3),
        index: 2,
        siblings: [BigInt(9), BigInt(10)],
      };

      const mockWithdrawal = {
        procesooor: getAddress("0x1234567890123456789012345678901234567890"),
        scope: BigInt(11) as Hash,
        data: new Uint8Array(),
      };

      const withdrawalInput = {
        withdrawalAmount: BigInt(500),
        stateMerkleProof: mockStateMerkleProof,
        aspMerkleProof: mockAspMerkleProof,
        stateRoot: BigInt(7) as Hash,
        aspRoot: BigInt(10) as Hash,
        newNullifier: BigInt(14) as Secret,
        newSecret: BigInt(15) as Secret,
      };

      await expect(
        sdk.proveWithdrawal(
          mockCommitment,
          withdrawalInput,
          mockWithdrawal,
        ),
      ).rejects.toThrow(ProofError);
    });

    const mockWithdrawal = {
      procesooor: getAddress("0x1234567890123456789012345678901234567890"),
      scope: BigInt(13) as Hash,
      data: new Uint8Array(),
    };

    it("should throw an error when verification fails", async () => {
      circuits.getVerificationKey = vi
        .fn()
        .mockResolvedValue(new TextEncoder().encode("{}"));
      snarkjs.groth16.verify = vi
        .fn()
        .mockRejectedValue(new Error("Verification error"));

      await expect(
        sdk.verifyWithdrawal({
          proof: {} as snarkjs.Groth16Proof,
          publicSignals: [],
          withdrawal: mockWithdrawal,
        }),
      ).rejects.toThrow(ProofError);
    });

    it("should return true for valid withdrawal proof", async () => {
      circuits.getVerificationKey = vi
        .fn()
        .mockResolvedValue(new TextEncoder().encode("{}"));
      snarkjs.groth16.verify = vi.fn().mockResolvedValue(true);

      const isValid = await sdk.verifyWithdrawal({
        proof: {} as snarkjs.Groth16Proof,
        publicSignals: [],
        withdrawal: mockWithdrawal,
      });
      expect(isValid).toBe(true);
    });
  });
});
