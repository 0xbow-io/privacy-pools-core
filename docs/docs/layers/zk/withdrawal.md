---
title: Withdrawal Circuit
---

The withdrawal circuit (`withdraw.circom`) handles private withdrawals:

```cpp
template Withdraw(maxTreeDepth) {
    // Public inputs
    signal input withdrawnValue;
    signal input stateRoot;
    signal input stateTreeDepth;
    signal input ASPRoot;
    signal input ASPTreeDepth;
    signal input context;

    // Private inputs
    signal input label;
    signal input existingValue;
    signal input existingNullifier;
    signal input existingSecret;
    signal input newNullifier;
    signal input newSecret;
    signal input stateSiblings[maxTreeDepth];
    signal input stateIndex;
    signal input ASPSiblings[maxTreeDepth];
    signal input ASPIndex;

    // Outputs
    signal output newCommitmentHash;
    signal output existingNullifierHash;
}
```

Circuit constraints:

1. Validates existing commitment in state tree
2. Verifies label inclusion in ASP tree
3. Ensures withdrawn amount is valid
4. Computes new commitment for remaining value
5. Checks the existing and new nullifier don't match
6. Verifies context matches on-chain data
