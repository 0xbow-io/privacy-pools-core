import { poseidonContract } from "circomlibjs";
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Generate bytecodes and remove '0x' prefix
const bytecode2 = poseidonContract.createCode(2).slice(2); // remove '0x' prefix
const bytecode3 = poseidonContract.createCode(3).slice(2); // remove '0x' prefix

// Create Solidity contract content
const contractContent = `// SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

contract Iden3PoseidonBytecodes {
    bytes constant POSEIDON_T2_BYTECODE = hex"${bytecode2}";
    bytes constant POSEIDON_T3_BYTECODE = hex"${bytecode3}";
}`;

// Write the contract to a file
fs.writeFileSync(
  path.join(__dirname, "Iden3PoseidonBytecodes.sol"),
  contractContent
);

console.log("Generated Iden3PoseidonBytecodes.sol successfully!");
