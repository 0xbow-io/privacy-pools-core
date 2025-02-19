pragma circom 2.2.0;

include "./commitment.circom";
include "./merkleTree.circom";
include "../../../node_modules/circomlib/circuits/comparators.circom";

/**
 * @title Withdraw template
 * @dev Template for withdrawing value from a commitment
 * @param maxTreeDepth The maximum depth of the Merkle trees
 */
template Withdraw(maxTreeDepth) {

  //////////////////////// PUBLIC SIGNALS ////////////////////////

  // Signals to compute commitments
  signal input withdrawnValue;                   // Value being withdrawn

  // Signals for merkle tree inclusion proofs
  signal input stateRoot;                        // A known state root
  signal input stateTreeDepth;                   // Current state tree depth
  signal input ASPRoot;                          // Latest ASP root
  signal input ASPTreeDepth;                     // Current ASP tree depth
  signal input context;                          // keccak256(IPrivacyPool.Withdrawal, scope) % SNARK_SCALAR_FIELD

  //////////////////// END OF PUBLIC SIGNALS ////////////////////


  /////////////////////// PRIVATE SIGNALS ///////////////////////

  // Signals to compute commitments
  signal input label;                            // keccak256(scope, nonce) % SNARK_SCALAR_FIELD
  signal input existingValue;                    // Value of the existing commitment
  signal input existingNullifier;                // Nullifier of the existing commitment
  signal input existingSecret;                   // Secret of the existing commitment
  signal input newNullifier;                     // Nullifier for the new commitment
  signal input newSecret;                        // Secret for the new commitment

  // Signals for merkle tree inclusion proofs
  signal input stateSiblings[maxTreeDepth];      // Siblings of the state tree
  signal input stateIndex;                       // Indices for the state tree
  signal input ASPSiblings[maxTreeDepth];        // Siblings of the ASP tree
  signal input ASPIndex;                         // Indices for the ASP tree

  /////////////////// END OF PRIVATE SIGNALS ///////////////////


  /////////////////////// OUTPUT SIGNALS ///////////////////////

  signal output newCommitmentHash;               // Hash of new commitment
  signal output existingNullifierHash;           // Hash of the existing commitment nullifier

  /////////////////// END OF OUTPUT SIGNALS ///////////////////

  // 1. Compute existing commitment
  component existingCommitmentHasher = CommitmentHasher();
  existingCommitmentHasher.value <== existingValue;
  existingCommitmentHasher.label <== label;
  existingCommitmentHasher.nullifier <== existingNullifier;
  existingCommitmentHasher.secret <== existingSecret;
  signal existingCommitment <== existingCommitmentHasher.commitment;

  // 2. Output existing nullifier hash
  existingNullifierHash <== existingCommitmentHasher.nullifierHash;
  _ <== existingCommitmentHasher.precommitmentHash;

  // 3. Verify existing commitment is in state tree
  component stateRootChecker = LeanIMTInclusionProof(maxTreeDepth);
  stateRootChecker.leaf <== existingCommitment;
  stateRootChecker.leafIndex <== stateIndex;
  stateRootChecker.siblings <== stateSiblings;
  stateRootChecker.actualDepth <== stateTreeDepth;

  stateRoot === stateRootChecker.out;

  // 4. Verify label is in ASP tree
  component ASPRootChecker = LeanIMTInclusionProof(maxTreeDepth);
  ASPRootChecker.leaf <== label;
  ASPRootChecker.leafIndex <== ASPIndex;
  ASPRootChecker.siblings <== ASPSiblings;
  ASPRootChecker.actualDepth <== ASPTreeDepth;

  ASPRoot === ASPRootChecker.out;

  // 5. Check the withdrawn amount is valid
  signal remainingValue <== existingValue - withdrawnValue;
  component remainingValueRangeCheck = Num2Bits(128);
  remainingValueRangeCheck.in <== remainingValue;
  _ <== remainingValueRangeCheck.out;
  component withdrawnValueRangeCheck = Num2Bits(128);
  withdrawnValueRangeCheck.in <== withdrawnValue;
  _ <== withdrawnValueRangeCheck.out;

  // 6. Compute new commitment
  component newCommitmentHasher = CommitmentHasher();
  newCommitmentHasher.value <== remainingValue;
  newCommitmentHasher.label <== label;
  newCommitmentHasher.nullifier <== newNullifier;
  newCommitmentHasher.secret <== newSecret;

  // 7. Output new commitment hash
  newCommitmentHash <== newCommitmentHasher.commitment;
  _ <== newCommitmentHasher.precommitmentHash;
  _ <== newCommitmentHasher.nullifierHash;

  // 8. Square context for integrity
  signal contextSquared <== context * context;
}
