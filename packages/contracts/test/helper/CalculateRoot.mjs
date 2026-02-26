#!/usr/bin/env node
import { LeanIMT } from "@zk-kit/lean-imt";
import { poseidon } from "maci-crypto/build/ts/hashing.js";
import * as fs from "fs";
import { dirname, resolve } from "path";
import { fileURLToPath } from "url";
import { encodeAbiParameters } from "viem";

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// Get CSV file path from command-line argument
const args = process.argv.slice(2);
if (args.length < 1) {
  console.error("Usage: CalculateRoot.mjs <csvFilePath>");
  process.exit(1);
}

// Resolve CSV file path relative to project root
const projectRoot = resolve(__dirname, '../..');
const csvFilePath = resolve(projectRoot, args[0]);

// Read and parse the CSV data
const csvData = fs.readFileSync(csvFilePath, "utf8")
  .split("\n")
  .slice(1) // Skip header row
  .filter((line) => line.trim() !== "")
  .map((line) => {
    const parts = line.split(',').map(part => part.trim().replace(/"/g, ''));
    if (parts.length < 4) { // Basic validation for enough parts
      console.warn(`Skipping malformed CSV line: ${line}`);
      return null;
    }
    try {
      return {
        id: parseInt(parts[0], 10),
        root: BigInt(parts[1]),
        index: parseInt(parts[2], 10),
        leaf: BigInt(parts[3]),
      };
    } catch (e) {
      console.warn(`Skipping line due to parsing error (id: ${parts[0]}, leaf: ${parts[3]}, root: ${parts[1]}): ${line} - Error: ${e.message}`);
      return null;
    }
  })
  .filter(record => record !== null) // Filter out nulls from malformed lines
  .sort((a, b) => a.index - b.index); // Sort by index ascending

if (csvData.length === 0) {
  console.error("Error: No valid data found in CSV file or CSV format is incorrect after parsing.");
  process.exit(1);
}

// Initialize LeanIMT
const tree = new LeanIMT((a, b) => poseidon([a, b]));


let errorsFound = 0;
for (let i = 0; i < csvData.length; i++) {
  const record = csvData[i];

  tree.insert(record.leaf);
  const calculatedRoot = tree.root;

  if (calculatedRoot !== record.root) {
    errorsFound++;
    console.error(`MISMATCH found for leaf at index ${record.index} (CSV id: ${record.id}):`);
    console.error(`  Leaf inserted: ${record.leaf}`);
    console.error(`  Calculated Root: ${calculatedRoot}`);
    console.error(`  Expected Root (from CSV): ${record.root}`);
    console.error(`  Tree size after insertion: ${tree.size}`);
    console.error('--');
  } else {
    // console.log(`Index ${record.index} (CSV id: ${record.id}): Root matches (${calculatedRoot})`);
  }
}

const encodedRoot = encodeAbiParameters([{ type: "uint256" }], [tree.root]);
process.stdout.write(encodedRoot);

