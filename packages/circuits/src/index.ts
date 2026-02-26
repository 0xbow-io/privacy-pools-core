import { Circomkit } from "circomkit";

async function main() {
  // create circomkit
  const circomkit = new Circomkit({
    protocol: "groth16",
    include: ["../../node_modules/circomlib/circuits", "../../node_modules/maci-circuits/circom"],
    inspect: true,
  });

  // artifacts output at `build/commitment` directory
  await circomkit.compile("commitment", {
    file: "commitment",
    template: "CommitmentHasher",
    pubs: ["value", "label"],
  });

  // artifacts output at `build/withdraw` directory
  await circomkit.compile("withdraw", {
    file: "withdraw",
    template: "Withdraw",
    params: [32],
    pubs: ["withdrawnValue", "stateRoot", "stateTreeDepth", "ASPRoot", "ASPTreeDepth", "context"],
  });

  // artifacts output at `build/merkleTree` directory
  await circomkit.compile("merkleTree", {
    file: "merkleTree",
    template: "LeanIMTInclusionProof",
    params: [32],
    pubs: ["leaf", "leafIndex", "siblings", "actualDepth"],
  });
}

main()
  .then(() => process.exit(0))
  .catch((e) => {
    console.error(e);
    process.exit(1);
  });
