import { poseidon } from "maci-crypto/build/ts/hashing.js";
import { Hash, Secret } from "./types/index.js";
import { Hex } from "viem";
import { generatePrivateKey } from "viem/accounts";

export function genMasterKeys(seed?: Hex): [Secret, Secret] {
  const preimage = seed ? poseidon([BigInt(seed)]) : BigInt(generatePrivateKey());

  const masterKey1 = poseidon([preimage, BigInt(1)]) as Secret;
  const masterKey2 = poseidon([preimage, BigInt(2)]) as Secret;

  return [masterKey1, masterKey2];
}

/**
 * Computes a Poseidon hash for the given nullifier and secret.
 *
 * @param {Secret} nullifier - The nullifier to hash.
 * @param {Secret} secret - The secret to hash.
 * @returns {Hash} The Poseidon hash.
 */
export function getDepositSecrets(
  masterKey: [Secret, Secret],
  scope: Hash,
  index: bigint,
): { nullifier: Secret; secret: Secret } {
  const depositNullifier = poseidon([masterKey[0], scope, index]) as Secret;
  const depositSecret = poseidon([masterKey[1], scope, index]) as Secret;

  return { nullifier: depositNullifier, secret: depositSecret };
}

export function getWithdrawalSecrets(
  masterKey: [Secret, Secret],
  label: Hash,
  index: bigint,
): { nullifier: Secret; secret: Secret } {
  const withdrawalNullifier = poseidon([masterKey[0], label, index]) as Secret;
  const withdrawalSecret = poseidon([masterKey[1], label, index]) as Secret;

  return { nullifier: withdrawalNullifier, secret: withdrawalSecret };
}
