---
title: Circuits Interfaces
---

**`CommitmentHasher`**

Creates commitment proofs using Poseidon hash.

```
Public Inputs:
- value: Amount being committed
- label: keccak256(scope, nonce)

Private Inputs:
- nullifier: Unique nullifier for commitment
- secret: Secret for commitment

Public Outputs:
- commitment: Poseidon(value, label, Poseidon(nullifier, secret))
- precommitmentHash: Poseidon(nullifier, secret)
- nullifierHash: Poseidon(nullifier)
```

**`Withdraw`**

Validates withdrawal proofs.

```
Public Inputs:
- withdrawnValue: Amount being withdrawn
- stateRoot: Current state root
- stateTreeDepth: Current state tree depth
- ASPRoot: Latest ASP root
- ASPTreeDepth: Current ASP tree depth
- context: keccak256(scope, Withdrawal)

Private Inputs:
- label: keccak256(scope, nonce)
- existingValue: Value of existing commitment
- existingNullifier: Nullifier of existing commitment
- existingSecret: Secret of existing commitment
- newNullifier: Nullifier for new commitment
- newSecret: Secret for new commitment
- stateSiblings[]: State tree merkle proof
- stateIndex: Index in state tree
- ASPSiblings[]: ASP tree merkle proof
- ASPIndex: Index in ASP tree

Public Outputs:
- newCommitmentHash: Hash of new commitment
- existingNullifierHash: Hash of spent nullifier

```
