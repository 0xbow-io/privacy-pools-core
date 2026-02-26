import { WitnessTester } from "circomkit";
import { circomkit, hashCommitment, randomBigInt, padSiblings, Commitment } from "./common";
import { poseidon } from "../../../node_modules/maci-crypto/build/ts/hashing.js";
import { parseEther, hexToBigInt, getAddress } from "viem";
import { LeanIMT } from "@zk-kit/lean-imt";

// TODO: once the circuits are unchanged, add assertion on error messages

describe("Withdraw Circuit", () => {
  let circuit: WitnessTester<
    [
      "withdrawnValue",
      "stateRoot",
      "stateTreeDepth",
      "ASPRoot",
      "ASPTreeDepth",
      "context",
      "label",
      "existingValue",
      "existingNullifier",
      "existingSecret",
      "newNullifier",
      "newSecret",
      "stateSiblings",
      "stateIndex",
      "ASPSiblings",
      "ASPIndex",
    ],
    ["newCommitmentHash", "existingNullifierHash"]
  >;

  // Test constants
  const maxTreeDepth = 32;
  const LABEL = randomBigInt(); // Random label for original deposit. Should be keccak256(SCOPE, nonce)
  const REMOVED_LEAF = poseidon([BigInt(0)]);

  // Original deposit for 5 ETH
  const deposit = {
    value: parseEther("5"),
    label: LABEL,
    nullifier: randomBigInt(),
    secret: randomBigInt(),
  };

  // Get deposit commitment hash
  const [depositHash, depositNullifierHash] = hashCommitment(deposit);

  // Using Poseidon for hashing the tree nodes
  const hash = (a: bigint, b: bigint) => poseidon([a, b]);

  // Lean Incrementral Merkle trees
  let stateTree: LeanIMT<bigint>;
  let ASPTree: LeanIMT<bigint>;

  // Instantiate circuit with public signals
  before(async () => {
    circuit = await circomkit.WitnessTester("withdraw", {
      file: "withdraw",
      template: "Withdraw",
      params: [maxTreeDepth],
      pubs: ["withdrawnValue", "stateRoot", "stateTreeDepth", "ASPRoot", "ASPTreeDepth", "context"],
    });
  });

  // Flush trees before each test
  beforeEach(async () => {
    stateTree = new LeanIMT(hash);
    ASPTree = new LeanIMT(hash);
  });

  it("Should allow withdrawing value from an approved deposit", async () => {
    // Insert deposit commitment in state tree
    stateTree!.insert(randomBigInt());
    stateTree!.insert(randomBigInt());
    stateTree!.insert(randomBigInt());
    stateTree!.insert(depositHash);

    // Insert deposit label in ASP tree (deposit is now validated)
    ASPTree!.insert(randomBigInt());
    ASPTree!.insert(randomBigInt());
    ASPTree!.insert(randomBigInt());
    ASPTree!.insert(LABEL);

    // Withrdaw 1 ETH from deposit
    const withdrawal = {
      value: parseEther("4"), // New value after withdrawal
      label: LABEL,
      nullifier: randomBigInt(),
      secret: randomBigInt(),
    };

    // Hash the new commitment
    const [commitmentHash, ,] = hashCommitment(withdrawal);

    // Generate merkle proofs for commitment and label
    let stateProof = stateTree.generateProof(3);
    let ASPProof = ASPTree.generateProof(3);

    // Spend the deposit commitment and create a new commitment for the remaining value
    await circuit.expectPass(
      {
        withdrawnValue: parseEther("1"),
        stateRoot: stateProof.root,
        stateTreeDepth: stateTree.depth,
        ASPRoot: ASPProof.root,
        ASPTreeDepth: ASPTree.depth,
        context: randomBigInt(),
        label: LABEL,
        existingValue: deposit.value,
        existingNullifier: deposit.nullifier,
        existingSecret: deposit.secret,
        newNullifier: withdrawal.nullifier,
        newSecret: withdrawal.secret,
        stateSiblings: padSiblings(stateProof.siblings, maxTreeDepth),
        stateIndex: stateProof.index,
        ASPSiblings: padSiblings(ASPProof.siblings, maxTreeDepth),
        ASPIndex: ASPProof.index,
      },
      {
        newCommitmentHash: commitmentHash,
        existingNullifierHash: depositNullifierHash,
      },
    );
  });

  it("Should allow withdrawing value from a child commitment", async () => {
    // Insert deposit in state tree
    stateTree!.insert(randomBigInt());
    stateTree!.insert(randomBigInt());
    stateTree!.insert(depositHash);

    // Insert deposit label in ASP tree to mark as validated
    ASPTree!.insert(randomBigInt());
    ASPTree!.insert(randomBigInt());
    ASPTree!.insert(randomBigInt());
    ASPTree!.insert(randomBigInt());
    ASPTree!.insert(randomBigInt());
    ASPTree!.insert(LABEL);

    // First withdrawal
    const firstChild = {
      value: parseEther("4"), // New value after withdrawal
      label: LABEL,
      nullifier: randomBigInt(),
      secret: randomBigInt(),
    };

    // Hash first withdrawal commitment
    const [firstChildCommitmentHash, firstChildNullifierHash] = hashCommitment(firstChild);

    // Generate merkle proofs to spend deposit
    let stateProof = stateTree.generateProof(2);
    let ASPProof = ASPTree.generateProof(5);

    // Spend the deposit commitment and create the new commitment for the remaining value
    await circuit.expectPass(
      {
        withdrawnValue: parseEther("1"),
        stateRoot: stateProof.root,
        stateTreeDepth: stateTree.depth,
        ASPRoot: ASPProof.root,
        ASPTreeDepth: ASPTree.depth,
        context: randomBigInt(),
        label: LABEL,
        existingValue: deposit.value,
        existingNullifier: deposit.nullifier,
        existingSecret: deposit.secret,
        newNullifier: firstChild.nullifier,
        newSecret: firstChild.secret,
        stateSiblings: padSiblings(stateProof.siblings, maxTreeDepth),
        stateIndex: stateProof.index,
        ASPSiblings: padSiblings(ASPProof.siblings, maxTreeDepth),
        ASPIndex: ASPProof.index,
      },
      {
        newCommitmentHash: firstChildCommitmentHash,
        existingNullifierHash: depositNullifierHash,
      },
    );

    // Insert the new child commitment in the state tree
    stateTree!.insert(firstChildCommitmentHash);

    // Second child product of spending the first child and withdrawing 2.5 ETH
    let secondChild = {
      value: parseEther("1.5"), // New value after withdrawal
      label: LABEL,
      nullifier: randomBigInt(),
      secret: randomBigInt(),
    };

    // Hash the second child commitment
    const [secondChildComitmentHash] = hashCommitment(secondChild);

    // Regenerate state merkle proof
    let newStateProof = stateTree.generateProof(3);

    // Spend the first child and create the second one for the remaining 1.5 ETH
    await circuit.expectPass(
      {
        withdrawnValue: parseEther("2.5"),
        stateRoot: newStateProof.root,
        stateTreeDepth: stateTree.depth,
        ASPRoot: ASPProof.root,
        ASPTreeDepth: ASPTree.depth,
        context: randomBigInt(),
        label: LABEL,
        existingValue: firstChild.value,
        existingNullifier: firstChild.nullifier,
        existingSecret: firstChild.secret,
        newNullifier: secondChild.nullifier,
        newSecret: secondChild.secret,
        stateSiblings: padSiblings(newStateProof.siblings, maxTreeDepth),
        stateIndex: newStateProof.index,
        ASPSiblings: padSiblings(ASPProof.siblings, maxTreeDepth),
        ASPIndex: ASPProof.index,
      },
      {
        newCommitmentHash: secondChildComitmentHash,
        existingNullifierHash: firstChildNullifierHash,
      },
    );
  });

  it("Should allow for a full value withdrawal", async () => {
    // Insert commitment in state
    stateTree!.insert(randomBigInt());
    stateTree!.insert(depositHash);
    stateTree!.insert(randomBigInt());
    stateTree!.insert(randomBigInt());
    stateTree!.insert(randomBigInt());
    stateTree!.insert(randomBigInt());

    // Insert label in ASP to mark as validated
    ASPTree!.insert(randomBigInt());
    ASPTree!.insert(randomBigInt());
    ASPTree!.insert(LABEL);
    ASPTree!.insert(randomBigInt());

    // Withdraw the full amount of the existing commitment. New value = 0 wei
    let fullWithdrawal = {
      value: parseEther("0"), // Empty value after full withdrawal
      label: LABEL,
      nullifier: randomBigInt(),
      secret: randomBigInt(),
    };

    // Hash new commitment of zero value
    const [commitmentHash] = hashCommitment(fullWithdrawal);

    // generate merkle proofs
    let stateProof = stateTree.generateProof(1);
    let ASPProof = ASPTree.generateProof(2);

    // Fully spend the existing commitment
    await circuit.expectPass(
      {
        withdrawnValue: parseEther("5"),
        stateRoot: stateProof.root,
        stateTreeDepth: stateTree.depth,
        ASPRoot: ASPProof.root,
        ASPTreeDepth: ASPTree.depth,
        context: randomBigInt(),
        label: LABEL,
        existingValue: parseEther("5"),
        existingNullifier: deposit.nullifier,
        existingSecret: deposit.secret,
        newNullifier: fullWithdrawal.nullifier,
        newSecret: fullWithdrawal.secret,
        stateSiblings: padSiblings(stateProof.siblings, maxTreeDepth),
        stateIndex: stateProof.index,
        ASPSiblings: padSiblings(ASPProof.siblings, maxTreeDepth),
        ASPIndex: ASPProof.index,
      },
      {
        newCommitmentHash: commitmentHash,
        existingNullifierHash: depositNullifierHash,
      },
    );
  });

  it("Withdrawal should fail if existing commitment is not in the state tree", async () => {
    // Insert commitment in state
    stateTree!.insert(randomBigInt());
    stateTree!.insert(randomBigInt());

    // Insert leaves in ASP tree
    ASPTree!.insert(randomBigInt());
    ASPTree!.insert(randomBigInt());

    // Withdraw any amount
    let withdrawal = {
      value: parseEther("1"),
      label: LABEL,
      nullifier: randomBigInt(),
      secret: randomBigInt(),
    };

    // Generate ASP tree merkle proof for another commitment. Generating a proof for a commitment that is not in the tree will fail
    let stateProof = stateTree.generateProof(1);
    // Generate ASP tree merkle proof for another label. Generating a proof for a label that is not in the tree will fail
    let ASPProof = ASPTree.generateProof(1);

    // Fail when trying to spend a commitment that is not in the state tree
    // TODO: add assertion on error message. Currently fails on line 72 => state tree inclusion check
    await circuit.expectFail({
      withdrawnValue: parseEther("4"),
      stateRoot: stateProof.root,
      stateTreeDepth: stateTree.depth,
      ASPRoot: ASPProof.root,
      ASPTreeDepth: ASPTree.depth,
      context: randomBigInt(),
      label: LABEL,
      existingValue: parseEther("5"),
      existingNullifier: deposit.nullifier, // User only knows the secrets of the deposit
      existingSecret: deposit.secret, // User only knows the secrets of the deposit
      newNullifier: withdrawal.nullifier,
      newSecret: withdrawal.secret,
      stateSiblings: padSiblings(stateProof.siblings, maxTreeDepth),
      stateIndex: stateProof.index,
      ASPSiblings: padSiblings(ASPProof.siblings, maxTreeDepth),
      ASPIndex: ASPProof.index,
    });
  });

  it("Withdrawal should fail if label is not present in the ASP tree", async () => {
    // Insert commitment in state
    stateTree!.insert(randomBigInt());
    stateTree!.insert(randomBigInt());
    stateTree!.insert(randomBigInt());
    stateTree!.insert(randomBigInt());
    stateTree!.insert(depositHash);
    stateTree!.insert(randomBigInt());
    stateTree!.insert(randomBigInt());

    // Insert leaves in ASP tree
    ASPTree!.insert(randomBigInt());
    ASPTree!.insert(randomBigInt());

    // Withdraw any amount
    let withdrawal = {
      value: parseEther("2.33"),
      label: LABEL,
      nullifier: randomBigInt(),
      secret: randomBigInt(),
    };

    // Generate state tree merkle proof
    let stateProof = stateTree.generateProof(4);
    // Generate ASP tree merkle proof for another label. Generating a proof for a label that is not in the tree will fail
    let ASPProof = ASPTree.generateProof(1);

    // Fail when trying to spend the deposit with a label that is not included in the ASP tree
    // TODO: add assertion on error message. Currently fails on line 82 => ASP inclusion check
    await circuit.expectFail({
      withdrawnValue: parseEther("1.77"),
      stateRoot: stateProof.root,
      stateTreeDepth: stateTree.depth,
      ASPRoot: ASPProof.root,
      ASPTreeDepth: ASPTree.depth,
      context: randomBigInt(),
      label: LABEL,
      existingValue: parseEther("5"),
      existingNullifier: deposit.nullifier,
      existingSecret: deposit.secret,
      newNullifier: withdrawal.nullifier,
      newSecret: withdrawal.secret,
      stateSiblings: padSiblings(stateProof.siblings, maxTreeDepth),
      stateIndex: stateProof.index,
      ASPSiblings: padSiblings(ASPProof.siblings, maxTreeDepth),
      ASPIndex: ASPProof.index,
    });
  });

  it("Withdrawal should fail if label is removed from the ASP tree", async () => {
    // Insert commitment in state
    stateTree!.insert(randomBigInt());
    stateTree!.insert(randomBigInt());
    stateTree!.insert(randomBigInt());
    stateTree!.insert(depositHash);

    // Insert label in ASP to mark as validated
    ASPTree!.insert(randomBigInt());
    ASPTree!.insert(randomBigInt());
    ASPTree!.insert(randomBigInt());
    ASPTree!.insert(LABEL);

    // Withdraw a partial amount
    let firstWithdrawal: Commitment = {
      value: parseEther("4"),
      label: LABEL,
      nullifier: randomBigInt(),
      secret: randomBigInt(),
    };

    // Hash the first withdrawal
    const [firstWithdrawalHash, ,] = hashCommitment(firstWithdrawal);

    // Generate merkle proofs
    let stateProof = stateTree.generateProof(3);
    let ASPProof = ASPTree.generateProof(3);

    // Partially spend the deposit commitment
    await circuit.expectPass(
      {
        withdrawnValue: parseEther("1"),
        stateRoot: stateProof.root,
        stateTreeDepth: stateTree.depth,
        ASPRoot: ASPProof.root,
        ASPTreeDepth: ASPTree.depth,
        context: randomBigInt(),
        label: LABEL,
        existingValue: parseEther("5"),
        existingNullifier: deposit.nullifier,
        existingSecret: deposit.secret,
        newNullifier: firstWithdrawal.nullifier,
        newSecret: firstWithdrawal.secret,
        stateSiblings: padSiblings(stateProof.siblings, maxTreeDepth),
        stateIndex: stateProof.index,
        ASPSiblings: padSiblings(ASPProof.siblings, maxTreeDepth),
        ASPIndex: ASPProof.index,
      },
      {
        newCommitmentHash: firstWithdrawalHash,
        existingNullifierHash: depositNullifierHash,
      },
    );

    // Insert new commitment in tree
    stateTree!.insert(firstWithdrawalHash);

    // Remove label from ASP tree
    ASPTree!.update(3, REMOVED_LEAF);

    // Generate new state root. ASP proof should remain the same
    stateProof = stateTree.generateProof(4);

    // Withdraw the full amount of the existing commitment
    let secondWithdrawal: Commitment = {
      value: parseEther("3"), // empty value after full withdrawal
      label: LABEL,
      nullifier: randomBigInt(), // new nullifier
      secret: randomBigInt(), // new secret
    };

    // Fail when trying to spend the commitment with a removed label
    // TODO: add assertion on error message. Currently fails on line 82 => ASP inclusion check
    await circuit.expectFail({
      withdrawnValue: parseEther("1"),
      stateRoot: stateProof.root,
      stateTreeDepth: stateTree.depth,
      ASPRoot: ASPTree.root,
      ASPTreeDepth: ASPTree.depth,
      context: randomBigInt(),
      label: LABEL,
      existingValue: parseEther("4"),
      existingNullifier: firstWithdrawal.nullifier,
      existingSecret: firstWithdrawal.secret,
      newNullifier: secondWithdrawal.nullifier,
      newSecret: secondWithdrawal.secret,
      stateSiblings: padSiblings(stateProof.siblings, maxTreeDepth),
      stateIndex: stateProof.index,
      ASPSiblings: padSiblings(ASPProof.siblings, maxTreeDepth),
      ASPIndex: ASPProof.index,
    });
  });

  it("Withdrawal should fail if reusing a nullifier", async () => {
    // Insert deposit commitment in state tree
    stateTree!.insert(randomBigInt());
    stateTree!.insert(randomBigInt());
    stateTree!.insert(randomBigInt());
    stateTree!.insert(depositHash);

    // Insert deposit label in ASP tree (deposit is now validated)
    ASPTree!.insert(randomBigInt());
    ASPTree!.insert(randomBigInt());
    ASPTree!.insert(randomBigInt());
    ASPTree!.insert(LABEL);

    // Withrdaw 1 ETH from deposit
    const withdrawal = {
      value: parseEther("4"), // New value after withdrawal
      label: LABEL,
      nullifier: deposit.nullifier, // Reusing same nullifier as deposit commitment
      secret: randomBigInt(),
    };

    // Generate merkle proofs for commitment and label
    let stateProof = stateTree.generateProof(3);
    let ASPProof = ASPTree.generateProof(3);

    // Fail to withdraw because using the same nullifier
    await circuit.expectFail({
      withdrawnValue: parseEther("1"),
      stateRoot: stateProof.root,
      stateTreeDepth: stateTree.depth,
      ASPRoot: ASPProof.root,
      ASPTreeDepth: ASPTree.depth,
      context: randomBigInt(),
      label: LABEL,
      existingValue: deposit.value,
      existingNullifier: deposit.nullifier,
      existingSecret: deposit.secret,
      newNullifier: withdrawal.nullifier,
      newSecret: withdrawal.secret,
      stateSiblings: padSiblings(stateProof.siblings, maxTreeDepth),
      stateIndex: stateProof.index,
      ASPSiblings: padSiblings(ASPProof.siblings, maxTreeDepth),
      ASPIndex: ASPProof.index,
    });
  });

  it("Withdrawal should fail if passing an invalid tree depth", async () => {
    // Insert deposit commitment in state tree
    stateTree!.insert(randomBigInt());
    stateTree!.insert(randomBigInt());
    stateTree!.insert(randomBigInt());
    stateTree!.insert(depositHash);

    // Insert deposit label in ASP tree (deposit is now validated)
    ASPTree!.insert(randomBigInt());
    ASPTree!.insert(randomBigInt());
    ASPTree!.insert(randomBigInt());
    ASPTree!.insert(LABEL);

    // Withrdaw 1 ETH from deposit
    const withdrawal = {
      value: parseEther("4"), // New value after withdrawal
      label: LABEL,
      nullifier: randomBigInt(),
      secret: randomBigInt(),
    };

    // Generate merkle proofs for commitment and label
    let stateProof = stateTree.generateProof(3);
    let ASPProof = ASPTree.generateProof(3);

    // Fail to withdraw because using the same nullifier
    await circuit.expectFail({
      withdrawnValue: parseEther("1"),
      stateRoot: stateProof.root,
      stateTreeDepth: 33,
      ASPRoot: ASPProof.root,
      ASPTreeDepth: ASPTree.depth,
      context: randomBigInt(),
      label: LABEL,
      existingValue: deposit.value,
      existingNullifier: deposit.nullifier,
      existingSecret: deposit.secret,
      newNullifier: withdrawal.nullifier,
      newSecret: withdrawal.secret,
      stateSiblings: padSiblings(stateProof.siblings, maxTreeDepth),
      stateIndex: stateProof.index,
      ASPSiblings: padSiblings(ASPProof.siblings, maxTreeDepth),
      ASPIndex: ASPProof.index,
    });
  });
});
