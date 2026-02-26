import { WitnessTester } from "circomkit";
import { circomkit, randomBigInt, padSiblings } from "./common";
import { hashLeftRight } from "../../../node_modules/maci-crypto/build/ts/hashing.js"; // TODO: fix maci import
import { LeanIMT } from "@zk-kit/lean-imt";

describe("LeanIMTInclusionProof Circuit", () => {
  let circuit: WitnessTester<["leaf", "leafIndex", "siblings", "actualDepth"], ["out"]>;

  const hash = (a: bigint, b: bigint) => hashLeftRight(a, b);
  const maxDepth = 8;

  // Lean Incrementral Merkle tree
  let tree: LeanIMT<bigint>;

  before(async () => {
    circuit = await circomkit.WitnessTester(`merkleTree`, {
      file: "merkleTree",
      template: "LeanIMTInclusionProof",
      pubs: ["leaf", "leafIndex", "siblings", "actualDepth"],
      params: [maxDepth],
    });
  });

  // Flush trees before each test
  beforeEach(async () => {
    tree = new LeanIMT(hash);
  });

  it("Should compute roots correctly", async () => {
    const LEAVES = 16;

    let leavesIndexes = [];

    // insert leaves
    for (let i = 0; i < LEAVES; ++i) {
      let leafValue = randomBigInt();
      tree!.insert(leafValue);

      leavesIndexes.push(tree.indexOf(leafValue));
    }

    for (let i = 0; i < LEAVES; ++i) {
      let stateProof = tree.generateProof(i);

      await circuit.expectPass(
        {
          leaf: stateProof.leaf,
          leafIndex: stateProof.index,
          siblings: padSiblings(stateProof.siblings, maxDepth),
          actualDepth: tree.depth,
        },
        { out: tree.root },
      );
    }
  });

  it("Should fail when passing a tree depth greater than the max depth", async () => {
    const LEAVES = 16;

    let leavesIndexes = [];

    // insert leaves
    for (let i = 0; i < LEAVES; ++i) {
      let leafValue = randomBigInt();
      tree!.insert(leafValue);

      leavesIndexes.push(tree.indexOf(leafValue));
    }

    for (let i = 0; i < LEAVES; ++i) {
      let stateProof = tree.generateProof(i);

      await circuit.expectFail({
        leaf: stateProof.leaf,
        leafIndex: stateProof.index,
        siblings: padSiblings(stateProof.siblings, maxDepth),
        actualDepth: maxDepth + 1,
      });
    }
  });
});
