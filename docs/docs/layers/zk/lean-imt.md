---
title: LeanIMT Circuit
---

The merkle tree circuit (`merkleTree.circom`) implements efficient inclusion proofs:

```cpp
template LeanIMTInclusionProof(maxDepth) {
    signal input leaf;               // Leaf to prove inclusion
    signal input leafIndex;          // Index in tree
    signal input siblings[maxDepth]; // Sibling hashes
    signal input actualDepth;        // Current tree depth

    signal output out;               // Computed root
}
```

Key features:

- Dynamic tree depth
- Optimized batch processing
- Single-child node optimization
- Path validation
