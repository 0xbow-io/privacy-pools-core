import { Circomkit } from "circomkit";
import { poseidon } from "../../../../node_modules/maci-crypto/build/ts/hashing.js";

export interface Commitment {
  value: bigint;
  label: bigint;
  nullifier: bigint;
  secret: bigint;
}

export const circomkit = new Circomkit({
  verbose: false,
  protocol: "groth16",
  include: ["../../node_modules/circomlib/circuits", "../../node_modules/maci-circuits/circom"],
});

export function hashCommitment(input: Commitment): [bigint, bigint] {
  const precommitment = poseidon([BigInt(input.nullifier), BigInt(input.secret)]);
  const nullifierHash = poseidon([BigInt(input.nullifier)]);
  const commitmentHash = poseidon([BigInt(input.value), BigInt(input.label), precommitment]);
  return [commitmentHash, nullifierHash];
}

export function randomBigInt(): bigint {
  return BigInt(Math.floor(Math.random() * Number.MAX_SAFE_INTEGER));
}

export function padSiblings(siblings: bigint[], targetDepth: number): bigint[] {
  const paddedSiblings = [...siblings];
  while (paddedSiblings.length < targetDepth) {
    paddedSiblings.push(BigInt(0));
  }
  return paddedSiblings;
}
