pragma circom 2.2.0;

include "../../../node_modules/circomlib/circuits/poseidon.circom";
include "../../../node_modules/circomlib/circuits/comparators.circom";
include "../../../node_modules/circomlib/circuits/mux1.circom";

/**
 * @title LeanIMTInclusionProof template
 * @dev Template for generating and verifying inclusion proofs in a Lean Incremental Merkle Tree
 * @notice This circuit follows the LeanIMT design where:
 *   1. Every node with two children is the hash of its left and right nodes
 *   2. Every node with one child has the same value as its child node
 *   3. Tree is always built from leaves to root
 *   4. Tree is always balanced by construction
 *   5. Tree depth is dynamic and can increase with insertion of new leaves
 * @param maxDepth The maximum depth of the Merkle tree
 */
template LeanIMTInclusionProof(maxDepth) {

    //////////////////////// SIGNALS ////////////////////////

    signal input leaf;               // The leaf value to prove inclusion for
    signal input leafIndex;          // The index of the leaf in the tree
    signal input siblings[maxDepth]; // The sibling values along the path to the root
    signal input actualDepth;        // Current tree depth (unused as |siblings| <= actualDepth)

    signal output out;               // The computed root value

    /////////////////// INTERNAL SIGNALS ///////////////////

    signal nodes[maxDepth + 1];      // Array to store computed node values at each level
    signal indices[maxDepth];        // Array to store path indices for each level

    ////////////////// COMPONENT SIGNALS //////////////////

    component siblingIsEmpty[maxDepth];      // Checks if sibling node is empty (zero)
    component hashInCorrectOrder[maxDepth];   // Orders node pairs for hashing
    component latestValidHash[maxDepth];      // Selects between hash and propagation
    component poseidons[maxDepth];

    /////////////////////// LOGIC ///////////////////////

    // Check provided depth is valid according to the max depth 
    component depthCheck = LessEqThan(6);
    depthCheck.in[0] <== actualDepth;
    depthCheck.in[1] <== maxDepth;
    depthCheck.out === 1;

    // Convert leaf index to binary path
    component indexToPath = Num2Bits(maxDepth);
    indexToPath.in <== leafIndex;
    indices <== indexToPath.out;

    // Initialize with leaf value
    nodes[0] <== leaf;

    // For each level up to maxDepth
    for (var i = 0; i < maxDepth; i++) {
        // Prepare node pairs for both possible orderings (left/right)
        var childrenToSort[2][2] = [ [nodes[i], siblings[i]], [siblings[i], nodes[i]] ];
        hashInCorrectOrder[i] = MultiMux1(2);
        hashInCorrectOrder[i].c <== childrenToSort;
        hashInCorrectOrder[i].s <== indices[i];

        // Hash the nodes
        poseidons[i] = Poseidon(2);
        poseidons[i].inputs <== hashInCorrectOrder[i].out;

        // Check if sibling is empty (zero)
        siblingIsEmpty[i] = IsZero();
        siblingIsEmpty[i].in <== siblings[i];

        // Either keep the previous hash (no more siblings) or the new one
        nodes[i + 1] <== (nodes[i] - poseidons[i].out) * siblingIsEmpty[i].out + poseidons[i].out;
    }

    // Output final computed root
    out <== nodes[maxDepth];
}
