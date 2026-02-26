import { LeanIMT } from "@zk-kit/lean-imt";
import { poseidon } from "maci-crypto/build/ts/hashing.js";
import * as fs from "fs";
import { fileURLToPath } from "url";
import { dirname, resolve } from "path";
import { encodeAbiParameters } from "viem";

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const leaves = fs
  .readFileSync(resolve(__dirname, "leaves.txt"), "utf8")
  .split("\n")
  .filter((line) => line.trim() !== "")
  .map((line) => BigInt(line));
const tree = new LeanIMT((a, b) => poseidon([a, b]));

tree.insertMany(leaves);

const encodedRoot = encodeAbiParameters([{ type: "uint256" }], [tree.root]);

process.stdout.write(encodedRoot);
