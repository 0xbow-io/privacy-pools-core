#!/usr/bin/env node
import { encodeAbiParameters } from "viem";
import { generateMerkleProof } from "@0xbow/privacy-pools-core-sdk";
import fs from "fs";

// Get CSV file path and leaf from command-line arguments
const args = process.argv.slice(2);
if (args.length < 2) {
  process.stderr.write("Usage: MerkleProofFromFile.mjs <leavesFile> <leaf>\n");
  process.exit(1);
}
const leavesFile = args[0];
const leaf = BigInt(args[1]);

// Read and parse the CSV data (skip header, use 4th column as leaf, sort by index)
const csvData = fs.readFileSync(leavesFile, "utf8")
  .split("\n")
  .slice(1) // Skip header row
  .filter((line) => line.trim() !== "")
  .map((line) => {
    const parts = line.split(',').map(part => part.trim().replace(/"/g, ''));
    if (parts.length < 4) return null;
    try {
      return {
        index: parseInt(parts[2], 10),
        leaf: BigInt(parts[3]),
      };
    } catch (e) {
      return null;
    }
  })
  .filter(record => record !== null)
  .sort((a, b) => a.index - b.index);

let leaves = csvData.map(record => record.leaf);
leaves.push(leaf);

// Wrap the generateMerkleProof call with stdout redirection
function withSilentStdout(fn) {
  const originalStdoutWrite = process.stdout.write;
  const originalStderrWrite = process.stderr.write;

  return async (...args) => {
    process.stdout.write = () => true;
    process.stderr.write = () => true;

    try {
      const result = await fn(...args);
      process.stdout.write = originalStdoutWrite;
      process.stderr.write = originalStderrWrite;
      return result;
    } catch (error) {
      process.stdout.write = originalStdoutWrite;
      process.stderr.write = originalStderrWrite;
      throw error;
    }
  };
}

async function main() {
  try {
    const silentGenerateProof = withSilentStdout(() =>
      generateMerkleProof(leaves, leaf),
    );

    const proof = await silentGenerateProof();
    proof.index = Object.is(proof.index, NaN) ? 0 : proof.index;

    const encodedProof = encodeAbiParameters(
      [
        { name: "root", type: "uint256" },
        { name: "index", type: "uint256" },
        { name: "siblings", type: "uint256[]" },
      ],
      [proof.root, proof.index, proof.siblings],
    );

    process.stdout.write(encodedProof);
    process.exit(0);
  } catch (e) {
    console.log(e);
    process.exit(1);
  }
}

main().catch(() => process.exit(1)); 
