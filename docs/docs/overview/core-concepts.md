---
title: Core Concepts
description: "Core protocol concepts including commitments, nullifiers, Merkle trees, proof types, and how Privacy Pools preserves privacy with verifiability."
keywords:
  - privacy pools
  - commitments
  - nullifiers
  - merkle tree
  - zk proofs
  - state root
  - ASP
---


## Zero-knowledge proofs in Privacy Pools

Privacy Pools uses [zero-knowledge proofs](/layers/zk) to demonstrate valid statements about private information without revealing that information. The protocol employs three proof types:

- **[Commitment Proofs](/layers/zk/commitment)**: Verify the ownership of a commitment
- **[Withdrawal Proofs](/layers/zk/withdrawal)**: Verify ownership and inclusion in state of a commitment
- **[Merkle Proofs](/layers/zk/lean-imt)**: Demonstrate membership in a tree without revealing position

## Commitments and nullifiers

A PrivacyPool commitment is a note for some value deposited in a Pool composed of:

- **`value`**: The amount being committed
- **`label`**: A unique identifier derived from scope and nonce
- **`nullifier`**: A secret that prevents double-spending
- **`secret`**: A value that helps hide the nullifier

The protocol uses:

- **Commitment Hash**: `PoseidonHash(value, label, precommitmentHash)`
- **Precommitment Hash**: `PoseidonHash(nullifier, secret)`
- **Nullifier Hash**: `PoseidonHash(nullifier)`

These values enable secure state transitions while maintaining privacy.

## Basic operations

- **[Deposit](/protocol/deposit)**
  - User generates commitment components
  - Deposits funds and submits commitment to pool
  - Commitment is added to the state tree
- **[Withdrawal](/protocol/withdrawal)**
  - User proves ownership of an existing commitment
  - Creates new commitment for remaining funds
  - Marks previous commitment as spent
  - Receives withdrawn assets
- **[Ragequit](/protocol/ragequit)**
  - Original depositor proves ownership of a commitment
  - Recovers full remaining deposit value
  - Marks commitment as spent
