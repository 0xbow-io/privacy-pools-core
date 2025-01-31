#!/usr/bin/env node
import { ethers } from "ethers";
import { generateMerkleProof } from "@privacy-pool-core/sdk";

// Function to temporarily redirect stdout
function withSilentStdout(fn) {
  const originalStdoutWrite = process.stdout.write;
  const originalStderrWrite = process.stderr.write;

  return async (...args) => {
    // Temporarily disable stdout/stderr
    process.stdout.write = () => true;
    process.stderr.write = () => true;

    try {
      const result = await fn(...args);
      // Restore stdout/stderr
      process.stdout.write = originalStdoutWrite;
      process.stderr.write = originalStderrWrite;
      return result;
    } catch (error) {
      // Restore stdout/stderr
      process.stdout.write = originalStdoutWrite;
      process.stderr.write = originalStderrWrite;
      throw error;
    }
  };
}

async function main() {
  try {
    const args = process.argv.slice(2);
    const leaf = BigInt(args[0]);
    const leaves = args.slice(1).map(BigInt);

    // Wrap the generateMerkleProof call with stdout redirection
    const silentGenerateProof = withSilentStdout(() =>
      generateMerkleProof(leaves, leaf),
    );

    const proof = await silentGenerateProof();
    proof.index = Object.is(proof.index, NaN) ? 0 : proof.index;

    const abiCoder = new ethers.AbiCoder();
    const encodedProof = abiCoder.encode(
      ["uint256", "uint256", "uint256[]"],
      [proof.root, proof.index, proof.siblings],
    );

    process.stdout.write(encodedProof);
    process.exit(0);
  } catch {
    // Exit silently on any error
    process.exit(1);
  }
}

// Catch any uncaught errors and exit silently
main().catch(() => process.exit(1));
