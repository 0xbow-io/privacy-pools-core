---
title: Circuit Architecture Overview
---

The Privacy Pool protocol uses three main Circom circuits:

1. **CommitmentHasher Circuit**
   - Computes commitment hashes from inputs
   - Generates precommitment and nullifier hashes
   - Uses Poseidon hash for efficient ZK computation
2. **LeanIMTInclusionProof Circuit**
   - Verifies membership in Lean Incremental Merkle Trees
   - Computes path from leaf to root
   - Validates hashes for each tree level
   - Accommodates dynamic tree depth
3. **Withdrawal Circuit**
   - Combines commitment and Merkle tree proofs
   - Verifies ownership of existing commitment
   - Validates new commitment creation
   - Checks ASP root inclusion

## Commitments

Commitments are cryptographic primitives that allow users to commit to values while keeping them private. In Privacy Pool:

1. **Components**
   - Value: The amount of assets being committed
   - Label: Unique identifier from pool scope and nonce
   - Nullifier: Secret value preventing double-spending
   - Secret: Random value proving ownership
2. **Hash Construction**

   ```tsx
   nullifierHash = PoseidonHash(nullifier);
   precommitmentHash = PoseidonHash(nullifier, secret);
   commitmentHash = PoseidonHash(value, label, precommitmentHash);
   ```

### Basic Proof Concepts

Privacy Pool uses Groth16 proofs with the following structure:

1. **Public Inputs**
   - Values visible on-chain
   - Examples: withdrawal amount, roots, context
   - Used for on-chain verification
2. **Private Inputs**
   - Values kept secret by the prover
   - Examples: nullifiers, secrets, siblings
   - Used to generate proofs
3. **Circuit Signals**
   - Internal values computed during proving
   - Enforce mathematical constraints
   - Connect public and private inputs

### Verification Flow

1. **Proof Generation**
   - User provides private and public inputs
   - Circuit computes internal signals
   - Generates Groth16 proof elements:
     - π_A: First elliptic curve point
     - π_B: Second elliptic curve point (2x2 matrix)
     - π_C: Third elliptic curve point
2. **On-chain Verification**
   - Contract receives proof and public signals
   - Verifier performs pairing checks
   - Validates against verification key
   - Returns boolean indicating validity
3. **Proof Integration**
   - Proofs linked to protocol operations
   - Results determine state transitions
   - Failed verifications revert transactions
