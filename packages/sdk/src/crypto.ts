import { mnemonicToAccount } from "viem/accounts";
import { bytesToNumber } from "viem/utils";
import { poseidon } from "maci-crypto/build/ts/hashing.js";
import { LeanIMT, LeanIMTMerkleProof } from "@zk-kit/lean-imt";
import {
  ErrorCode,
  PrivacyPoolError,
} from "./exceptions/privacyPool.exception.js";
import {
  Commitment,
  Hash,
  Secret,
  Withdrawal,
  MasterKeys,
} from "./types/index.js";
import { encodeAbiParameters, Hex, keccak256, numberToHex } from "viem";
import { SNARK_SCALAR_FIELD } from "./constants.js";

/**
 * Validates that a bigint value is not zero
 * @param value The value to check
 * @param name The name of the value for the error message
 * @throws {PrivacyPoolError} If the value is zero
 */
function validateNonZero(value: bigint, name: string) {
  if (value === BigInt(0)) {
    throw new PrivacyPoolError(
      ErrorCode.INVALID_VALUE,
      `Invalid input: '${name}' cannot be zero.`,
    );
  }
}

/**
 * Generates two master keys based on some provided seed or a random value.
 *
 * @param {Hex} seed - The optional seed.
 * @returns {MasterKeys} The master key pair.
 */
export function generateMasterKeys(mnemonic: string): MasterKeys {
    if (!mnemonic) {
        throw new PrivacyPoolError(
            ErrorCode.INVALID_VALUE,
            "Invalid input: mnemonic phrase is required."
        );
    }
     
    const key1 = bytesToNumber(
      mnemonicToAccount(mnemonic, { accountIndex: 0 }).getHdKey().privateKey!,
    );

    const key2 = bytesToNumber(
      mnemonicToAccount(mnemonic, { accountIndex: 1 }).getHdKey().privateKey!,
    );

    const masterNullifier = poseidon([BigInt(key1)]) as Secret;
    const masterSecret = poseidon([BigInt(key2)]) as Secret;

  return { masterNullifier, masterSecret };
}

/**
 * Generates a nullifier and secret pair for a deposit commitment.
 *
 * @param {MasterKeys} keys - The master keys pair.
 * @param {Hash} scope - The pool scope.
 * @param {bigint} index - The pool account index for the scope.
 * @returns {Secret, Secret} The commitment nullifier and secret pair.
 */
export function generateDepositSecrets(
  keys: MasterKeys,
  scope: Hash,
  index: bigint,
): { nullifier: Secret; secret: Secret } {
  const nullifier = poseidon([keys.masterNullifier, scope, index]) as Secret;
  const secret = poseidon([keys.masterSecret, scope, index]) as Secret;

  return { nullifier, secret };
}

/**
 * Generates a nullifier and secret pair for a withdrawal commitment.
 *
 * @param {MasterKeys} keys - The master keys pair.
 * @param {Hash} label - The deposit commitment label.
 * @param {bigint} index - The withdrawal index for the pool account.
 * @returns {Secret, Secret} The commitment nullifier and secret pair.
 */
export function generateWithdrawalSecrets(
  keys: MasterKeys,
  label: Hash,
  index: bigint,
): { nullifier: Secret; secret: Secret } {
  const nullifier = poseidon([keys.masterNullifier, label, index]) as Secret;
  const secret = poseidon([keys.masterSecret, label, index]) as Secret;

  return { nullifier, secret };
}

/**
 * Computes a Poseidon hash for the given nullifier and secret.
 *
 * @param {Secret} nullifier - The nullifier to hash.
 * @param {Secret} secret - The secret to hash.
 * @returns {Hash} The Poseidon hash.
 */
export function hashPrecommitment(nullifier: Secret, secret: Secret): Hash {
  return poseidon([nullifier, secret]) as Hash;
}

/**
 * Generates a commitment using the given parameters.
 *
 * @param {bigint} value - The value associated with the commitment.
 * @param {bigint} label - The label used for the commitment.
 * @param {Secret} nullifier - The nullifier used in the precommitment.
 * @param {Secret} secret - The secret used in the precommitment.
 * @returns {Commitment} The generated commitment object.
 */
export function getCommitment(
  value: bigint,
  label: bigint,
  nullifier: Secret,
  secret: Secret,
): Commitment {
  validateNonZero(nullifier as bigint, "nullifier");
  validateNonZero(label, "label");
  validateNonZero(secret as bigint, "secret");

  const precommitment = {
    hash: hashPrecommitment(nullifier, secret),
    nullifier,
    secret,
  };

  const hash = poseidon([value, label, precommitment.hash]) as Hash;

  return {
    hash,
    nullifierHash: precommitment.hash,
    preimage: {
      value,
      label,
      precommitment,
    },
  };
}

/**
 * Generates a Merkle inclusion proof for a given leaf in a set of leaves.
 *
 * @param {bigint[]} leaves - Array of leaves for the Lean Incremental Merkle tree.
 * @param {bigint} leaf - The specific leaf to generate the inclusion proof for.
 * @returns {LeanIMTMerkleProof<bigint>} A lean incremental Merkle tree inclusion proof.
 * @throws {Error} If the leaf is not found in the leaves array.
 */
export function generateMerkleProof(
  leaves: bigint[],
  leaf: bigint,
): LeanIMTMerkleProof<bigint> {
  const tree = new LeanIMT<bigint>((a: bigint, b: bigint) => poseidon([a, b]));

  tree.insertMany(leaves);

  const leafIndex = tree.indexOf(leaf);

  // if leaf does not exist in tree, throw error
  if (leafIndex === -1) {
    throw new PrivacyPoolError(
      ErrorCode.MERKLE_ERROR,
      "Leaf not found in the leaves array.",
    );
  }

  const proof = tree.generateProof(leafIndex);

  if (proof.siblings.length < 32) {
    proof.siblings = [
      ...proof.siblings,
      ...Array(32 - proof.siblings.length).fill(BigInt(0)),
    ];
  }

  return proof;
}

export function bigintToHash(value: bigint): Hash {
  return `0x${value.toString(16).padStart(64, "0")}` as unknown as Hash;
}

export function bigintToHex(num: bigint | string | undefined): Hex {
  if (num === undefined) throw new Error("Undefined bigint value!");
  return `0x${BigInt(num).toString(16).padStart(64, "0")}`;
}

/**
 * Calculates the context hash for a withdrawal.
 */
export function calculateContext(withdrawal: Withdrawal, scope: Hash): string {
  const hash =
    BigInt(
      keccak256(
        encodeAbiParameters(
          [
            {
              name: "withdrawal",
              type: "tuple",
              components: [
                { name: "processooor", type: "address" },
                { name: "data", type: "bytes" },
              ],
            },
            { name: "scope", type: "uint256" },
          ],
          [
            {
              processooor: withdrawal.processooor,
              data: withdrawal.data,
            },
            scope,
          ],
        ),
      ),
    ) % SNARK_SCALAR_FIELD;
  return numberToHex(hash);
}
