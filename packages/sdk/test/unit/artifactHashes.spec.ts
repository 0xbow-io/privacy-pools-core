import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import {
  sha256Hex,
  verifyArtifactIntegrity,
  ARTIFACT_HASHES,
} from "../../src/circuits/artifactHashes.js";
import { CircuitName } from "../../src/circuits/circuits.interface.js";
import { CircuitsMock } from "../mocks/index.js";

function hexToArrayBuffer(hex: string): ArrayBuffer {
  const bytes = [];

  for (let i = 0; i < hex.length; i += 2) {
    bytes.push(Number.parseInt(hex.slice(i, i + 2), 16));
  }

  return Uint8Array.from(bytes).buffer;
}

describe("Artifact Integrity", () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe("sha256Hex", () => {
    it("returns correct hex digest for known input", async () => {
      const data = new TextEncoder().encode("hello");
      const hash = await sha256Hex(data);
      expect(hash).toBe(
        "2cf24dba5fb0a30e26e83b2ac5b9e29e1b161e5c1fa7425e73043362938b9824",
      );
    });

    it("returns correct hex digest for empty input", async () => {
      const data = new Uint8Array(0);
      const hash = await sha256Hex(data);
      expect(hash).toBe(
        "e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855",
      );
    });

    it("produces different hashes for different inputs", async () => {
      const hash1 = await sha256Hex(new Uint8Array([1, 2, 3]));
      const hash2 = await sha256Hex(new Uint8Array([4, 5, 6]));
      expect(hash1).not.toBe(hash2);
    });
  });

  describe("verifyArtifactIntegrity", () => {
    it("throws when a circuit has no registered hash for an artifact", async () => {
      await expect(
        verifyArtifactIntegrity(
          CircuitName.MerkleTree,
          "wasm",
          new Uint8Array([1]),
        ),
      ).rejects.toThrow("No integrity hash registered for merkleTree.wasm");
    });

    it("throws when a registered circuit is missing the requested artifact entry", async () => {
      const missingArtifactType = "proof" as unknown as Parameters<
        typeof verifyArtifactIntegrity
      >[1];

      await expect(
        verifyArtifactIntegrity(
          CircuitName.Commitment,
          missingArtifactType,
          new Uint8Array([1]),
        ),
      ).rejects.toThrow("No integrity hash registered for commitment.proof");
    });

    it("passes when data matches the expected hash", async () => {
      const data = new TextEncoder().encode("test-artifact");
      const expectedHash = ARTIFACT_HASHES[CircuitName.Commitment].vkey!;

      vi.spyOn(globalThis.crypto.subtle, "digest").mockResolvedValueOnce(
        hexToArrayBuffer(expectedHash),
      );

      await expect(
        verifyArtifactIntegrity(CircuitName.Commitment, "vkey", data),
      ).resolves.toBeUndefined();
    });

    it("throws when data does not match the expected hash", async () => {
      const tampered = new TextEncoder().encode("tampered-artifact");

      await expect(
        verifyArtifactIntegrity(CircuitName.Commitment, "vkey", tampered),
      ).rejects.toThrow("Integrity check failed for commitment.vkey");
    });

    it("includes expected and actual hash in the error message", async () => {
      const tampered = new TextEncoder().encode("tampered");
      const actualHash = await sha256Hex(tampered);
      const expectedHash = ARTIFACT_HASHES[CircuitName.Commitment].vkey!;

      await expect(
        verifyArtifactIntegrity(CircuitName.Commitment, "vkey", tampered),
      ).rejects.toThrow(`expected ${expectedHash}, got ${actualHash}`);
    });
  });

  describe("_downloadCircuitArtifacts integrity check", () => {
    let circuits: CircuitsMock;

    beforeEach(() => {
      circuits = new CircuitsMock();
    });

    it("rejects when fetched artifact does not match the expected hash", async () => {
      const tampered = new Uint8Array([0xde, 0xad]);
      vi.spyOn(circuits, "_fetchVersionedArtifact").mockResolvedValue(tampered);

      await expect(
        circuits._downloadCircuitArtifacts(CircuitName.Commitment),
      ).rejects.toThrow("Integrity check failed for commitment");
    });

    it("succeeds when fetched artifacts match their expected hashes", async () => {
      const mockData = new Uint8Array([42, 43, 44]);
      vi.spyOn(globalThis.crypto.subtle, "digest")
        .mockResolvedValueOnce(
          hexToArrayBuffer(ARTIFACT_HASHES[CircuitName.Commitment].wasm!),
        )
        .mockResolvedValueOnce(
          hexToArrayBuffer(ARTIFACT_HASHES[CircuitName.Commitment].vkey!),
        )
        .mockResolvedValueOnce(
          hexToArrayBuffer(ARTIFACT_HASHES[CircuitName.Commitment].zkey!),
        );

      vi.spyOn(circuits, "_fetchVersionedArtifact").mockResolvedValue(mockData);

      const result = await circuits._downloadCircuitArtifacts(
        CircuitName.Commitment,
      );

      expect(result.wasm).toBe(mockData);
      expect(result.vkey).toBe(mockData);
      expect(result.zkey).toBe(mockData);
    });

    it("rejects for circuits with no registered hashes", async () => {
      const mockData = new Uint8Array([1, 2, 3]);
      vi.spyOn(circuits, "_fetchVersionedArtifact").mockResolvedValue(mockData);

      await expect(
        circuits._downloadCircuitArtifacts(CircuitName.MerkleTree),
      ).rejects.toThrow("No integrity hash registered for merkleTree");
    });
  });

  describe("ARTIFACT_HASHES manifest", () => {
    it("is frozen to prevent runtime mutation", () => {
      expect(Object.isFrozen(ARTIFACT_HASHES)).toBe(true);
      expect(Object.isFrozen(ARTIFACT_HASHES[CircuitName.Commitment])).toBe(
        true,
      );
      expect(Object.isFrozen(ARTIFACT_HASHES[CircuitName.Withdraw])).toBe(true);
      expect(Object.isFrozen(ARTIFACT_HASHES[CircuitName.MerkleTree])).toBe(
        true,
      );
    });

    it("contains hashes for all commitment artifacts", () => {
      expect(ARTIFACT_HASHES[CircuitName.Commitment].wasm).toMatch(
        /^[a-f0-9]{64}$/,
      );
      expect(ARTIFACT_HASHES[CircuitName.Commitment].vkey).toMatch(
        /^[a-f0-9]{64}$/,
      );
      expect(ARTIFACT_HASHES[CircuitName.Commitment].zkey).toMatch(
        /^[a-f0-9]{64}$/,
      );
    });

    it("contains hashes for all withdraw artifacts", () => {
      expect(ARTIFACT_HASHES[CircuitName.Withdraw].wasm).toMatch(
        /^[a-f0-9]{64}$/,
      );
      expect(ARTIFACT_HASHES[CircuitName.Withdraw].vkey).toMatch(
        /^[a-f0-9]{64}$/,
      );
      expect(ARTIFACT_HASHES[CircuitName.Withdraw].zkey).toMatch(
        /^[a-f0-9]{64}$/,
      );
    });
  });
});
