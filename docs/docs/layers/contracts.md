---
title: Smart Contracts Layer
---

### Contract architecture overview

The Privacy Pool protocol is built on three core contracts:

1. **Entrypoint**
   - Central access point for deposits
   - Manages pool registry and ASP root updates
   - Handles fee collection and relay operations
   - Controls protocol-wide settings
2. **Privacy Pools**
   - `PrivacyPoolSimple`: Handles native asset (ETH)
   - `PrivacyPoolComplex`: Handles ERC20 tokens
   - Both inherit from base `PrivacyPool` and `State` contracts
3. **Verifiers**
   - `CommitmentVerifier`: Validates ragequit proofs
   - `WithdrawalVerifier`: Validates withdrawal proofs
   - Both implement Groth16 verification

### Component interaction

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

### State management basics

Each Privacy Pool maintains:

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
