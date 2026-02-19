---
title: Smart Contracts Layer
description: "Architecture of the smart contract layer, covering Entrypoint, asset-specific pools, verifiers, and protocol state responsibilities."
keywords:
  - privacy pools
  - smart contracts
  - entrypoint
  - privacy pool
  - verifiers
  - solidity
  - architecture
---


## Contract architecture overview

The Privacy Pools protocol is built on three core contracts:

1. **[Entrypoint](/layers/contracts/entrypoint)**
   - Central access point for deposits
   - Manages pool registry and ASP root updates
   - Handles fee collection and relay operations
   - Controls protocol-wide settings
2. **[Privacy Pools](/layers/contracts/privacy-pools)**
   - `PrivacyPoolSimple`: Handles native asset (ETH)
   - `PrivacyPoolComplex`: Handles ERC20 tokens
   - Both inherit from base `PrivacyPool` and `State` contracts
3. **Verifiers**
   - `CommitmentVerifier`: Validates [ragequit](/protocol/ragequit) proofs
   - `WithdrawalVerifier`: Validates [withdrawal](/protocol/withdrawal) proofs
   - Both implement Groth16 verification

## Component interaction

- User operations flow through the Entrypoint:
  - Deposits route funds to appropriate pools
  - Withdrawals can be direct to the Pool or relayed through the Entrypoint
  - Fees are deducted and distributed
- Privacy Pools handle:
  - Asset custody and proof verification
  - State tree updates
  - Nullifier tracking
  - Ragequit operations
- The ASP layer interacts through:
  - Root updates via authorized postman
  - Label verification during withdrawals

## State management basics

Each Privacy Pools maintains:

1. **Tree State**
   - Lean Incremental Merkle Tree (LeanIMT) for commitments
   - Dynamic depth that grows with insertions
   - Cached roots for historical validation
2. **Nullifier Registry**
   - Tracks spent nullifiers to prevent double-spending
3. **Deposit Records**
   - Maps labels to original depositor addresses
   - Tracks deposit amounts
   - Enables direct recovery through ragequit
