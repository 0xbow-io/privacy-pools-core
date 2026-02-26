# Privacy Pool Circuits

This package contains the zero-knowledge circuit implementations for the Privacy Pool protocol. The circuits are written in Circom and are designed to work together to enable private withdrawals with membership proofs.

## Circuit Architecture

The protocol implements three main circuits that work together:

### Withdrawal Circuit

The withdrawal circuit verifies that a user can privately withdraw funds from the protocol. It takes as input:

- The withdrawal amount and details
- The unique related commitments identifier (label)
- A state root and ASP (Association Set Provider) root
- A proof of inclusion in the state tree
- A proof of inclusion in the ASP tree
- Nullifier and commitment secrets

The circuit ensures the withdrawal is valid by verifying:

- The user knows the preimage of the commitment
- The commitment exists in the state tree
- The comimtment label is included in the ASP tree
- The withdrawal amount is valid and matches the commitment

### LeanIMT Circuit

The LeanIMT (Lean Incremental Merkle Tree) circuit handles merkle tree operations. It implements an optimized merkle tree that:

- Supports dynamic depth
- Optimizes node computations by propagating single child values
- Verifies inclusion proofs efficiently

### Commitment Circuit

The commitment circuit manages the hashing and verification of commitments. It:

- Computes commitment hashes from input values and secrets
- Generates nullifier hashes for preventing double-spending
- Creates precommitment hashes for privacy preservation

## Development

### Prerequisites

- Node.js 20+
- Yarn
- circom 2.2.0+

### Building

```bash
# Compile circuits
yarn compile
```

### Testing

```bash
# Run circuit tests
yarn test
```

### Generating Groth16 Solidity verifiers

```bash
# Generate verifier for the withdrawal circuit
yarn gencontract:withdraw
```

```bash
# Generate verifier for the commitment circuit
yarn gencontract:commitment
```

## Directory Structure

```
circuits/
├── circuits/
│   ├── commitment.circom     # Commitment circuit
│   ├── merkleTree.circom     # LeanIMT circuit
│   └── withdraw.circom       # Withdrawal circuit
└── tests/                    # Circuit tests
```
