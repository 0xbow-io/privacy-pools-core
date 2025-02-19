pragma circom 2.2.0;

include "../../../node_modules/circomlib/circuits/poseidon.circom";

/**
 * @title CommitmentHasher template
 * @dev Template for computing commitment hashes, precommitments and nullifier hashes
 */
template CommitmentHasher() {

  //////////////////////// SIGNALS ////////////////////////

  signal input value;              // Value of commitment
  signal input label;              // keccak256(pool_scope, nonce) % SNARK_SCALAR_FIELD
  signal input nullifier;          // Nullifier of commitment
  signal input secret;             // Secret of commitment

  signal output commitment;        // Commitment hash
  signal output precommitmentHash; // Precommitment hash
  signal output nullifierHash;     // Nullifier hash

  ///////////////////// END OF SIGNALS /////////////////////

  // 1. Compute nullifier hash
  component nullifierHasher = Poseidon(1);
  nullifierHasher.inputs[0] <== nullifier;

  // 2. Compute precommitment
  component precommitmentHasher = Poseidon(2);
  precommitmentHasher.inputs[0] <== nullifier;
  precommitmentHasher.inputs[1] <== secret;

  // 3. Compute commitment hash
  component commitmentHasher = Poseidon(3);
  commitmentHasher.inputs[0] <== value;
  commitmentHasher.inputs[1] <== label;
  commitmentHasher.inputs[2] <== precommitmentHasher.out;

  // 4. Populate output signals
  commitment <== commitmentHasher.out;
  precommitmentHash <== precommitmentHasher.out;
  nullifierHash <== nullifierHasher.out;
}
