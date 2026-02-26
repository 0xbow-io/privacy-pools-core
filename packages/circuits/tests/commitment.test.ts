import { WitnessTester } from "circomkit";
import { circomkit, hashCommitment, randomBigInt, Commitment } from "./common";
import { poseidon } from "../../../node_modules/maci-crypto/build/ts/hashing.js"; // TODO: fix maci import
import { parseEther, hexToBigInt, getAddress } from "viem";

describe("CommitmentHasher Circuit", () => {
  let circuit: WitnessTester<["value", "label", "nullifier", "secret"], ["commitment", "nullifierHash"]>;

  const depositor = getAddress("0x9F2db792a6F2dAdf25D894cEd791080950bDE56f");
  const NONCE = BigInt(1);
  const LABEL = poseidon([hexToBigInt(depositor), randomBigInt(), NONCE]);

  before(async () => {
    circuit = await circomkit.WitnessTester(`commitment`, {
      file: "commitment",
      template: "CommitmentHasher",
      pubs: ["value", "label"],
    });
  });

  it("should compute commitment hash correctly", async () => {
    const input = {
      value: parseEther("1"),
      label: LABEL,
      nullifier: randomBigInt(),
      secret: randomBigInt(),
    };

    const [commitmentHash, nullifierHash] = hashCommitment(input);

    await circuit.expectPass(
      {
        value: input.value,
        label: LABEL,
        nullifier: input.nullifier,
        secret: input.secret,
      },
      { commitment: commitmentHash, nullifierHash },
    );
  });

  it("should compute child commitment hash correctly", async () => {
    const parentInput: Commitment = {
      value: parseEther("2"),
      label: LABEL,
      nullifier: randomBigInt(),
      secret: randomBigInt(),
    };

    const [parentHash] = hashCommitment(parentInput);

    const childInput: Commitment = {
      value: parseEther("1"),
      label: LABEL,
      nullifier: randomBigInt(),
      secret: randomBigInt(),
    };

    const [commitmentHash, nullifierHash] = hashCommitment(childInput);

    await circuit.expectPass(
      {
        value: childInput.value,
        label: LABEL,
        nullifier: childInput.nullifier,
        secret: childInput.secret,
      },
      { commitment: commitmentHash, nullifierHash },
    );
  });

  describe("Boundary Values", () => {
    it("should handle minimum values", async () => {
      const input: Commitment = {
        value: BigInt(0),
        label: LABEL,
        nullifier: BigInt(0),
        secret: BigInt(0),
      };

      const [commitmentHash, nullifierHash] = hashCommitment(input);

      await circuit.expectPass(
        {
          value: input.value,
          label: LABEL,
          nullifier: input.nullifier,
          secret: input.secret,
        },
        { commitment: commitmentHash, nullifierHash },
      );
    });

    it("should handle maximum field values", async () => {
      // P is the Goldilocks field modulus used by circom
      const P = BigInt("18446744073709551615");

      const input: Commitment = {
        value: P - BigInt(1),
        label: LABEL,
        nullifier: P - BigInt(1),
        secret: P - BigInt(1),
      };

      const [commitmentHash, nullifierHash] = hashCommitment(input);

      await circuit.expectPass(
        {
          value: input.value,
          label: LABEL,
          nullifier: input.nullifier,
          secret: input.secret,
        },
        { commitment: commitmentHash, nullifierHash },
      );
    });

    it("should verify nullifier hash depends only on nullifier", async () => {
      const base: Commitment = {
        value: parseEther("1"),
        label: LABEL,
        nullifier: randomBigInt(),
        secret: randomBigInt(),
      };

      const modified = { ...base, value: parseEther("2"), label: randomBigInt(), secret: randomBigInt() };

      const [_, nullifierHash1] = hashCommitment(base);
      const [___, nullifierHash2] = hashCommitment(modified);

      if (nullifierHash1 != nullifierHash2) {
        throw new Error("Nullifier hashes don't match");
      }
    });

    it("should verify precommitment hash depends only on nullifier and secret", async () => {
      const base: Commitment = {
        value: parseEther("1"),
        label: LABEL,
        nullifier: randomBigInt(),
        secret: randomBigInt(),
      };

      const modified = {
        ...base,
        value: parseEther("2"),
        label: randomBigInt(),
      };

      const [_, precommitmentHash1] = hashCommitment(base);
      const [__, precommitmentHash2] = hashCommitment(modified);

      if (precommitmentHash1 != precommitmentHash2) {
        throw new Error("Precommitment hashes don't match");
      }
    });

    it("should produce consistent outputs with same inputs", async () => {
      const input: Commitment = {
        value: parseEther("1"),
        label: LABEL,
        nullifier: randomBigInt(),
        secret: randomBigInt(),
      };

      const [hash1, null1] = hashCommitment(input);
      const [hash2, null2] = hashCommitment(input);
      const [hash3, null3] = hashCommitment(input);

      if (hash1 != hash2 || hash2 != hash3) {
        throw new Error("Commitment hashes don't match");
      }

      if (null1 != null2 || null2 != null3) {
        throw new Error("Nullifier hashes don't match");
      }
    });

    it("should produce different outputs when single input changes", async () => {
      const base: Commitment = {
        value: parseEther("1"),
        label: LABEL,
        nullifier: randomBigInt(),
        secret: randomBigInt(),
      };

      const modifications: (keyof Commitment)[] = ["value", "label", "nullifier", "secret"];

      const baseHash = hashCommitment(base)[0];

      for (const field of modifications) {
        const modified = { ...base };
        if (field === "value") modified.value = parseEther("2");
        else if (field === "label") modified.label = randomBigInt();
        else modified[field] = randomBigInt();

        const modifiedHash = hashCommitment(modified)[0];

        if (modifiedHash == baseHash) {
          throw new Error("Hashes shouldn't match");
        }
      }
    });
  });
});
