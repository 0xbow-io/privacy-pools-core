---
title: ASP Layer
description: "ASP layer responsibilities for approved-label set management, inclusion data publication, and compliance-aware withdrawal gating."
keywords:
  - privacy pools
  - ASP
  - association set provider
  - approved labels
  - compliance
  - state updates
  - withdrawals
---


## Overview - Role in the Protocol

The Association Set Provider is a crucial compliance layer that controls which deposits can be privately withdrawn from Privacy Pools. It maintains a set of approved labels and provides the data necessary for cryptographic proofs of label inclusion, bridging privacy with regulatory requirements.

## Core Responsibilities

- Manages list of approved deposit labels
- Provides inclusion proofs for [withdrawals](/protocol/withdrawal)
- Enables label revocation when needed
- Maintains compliance without compromising privacy

## Integration Points

- Interacts with [Entrypoint](/layers/contracts/entrypoint) via authorized postmen
- Provides roots for withdrawal validation
- Determines withdrawal eligibility
- Enforces protocol compliance rules

## Operation - Label Management

### Root Updates

- Only authorized postmen can update roots
- Each update includes:

  ```solidity
  struct AssociationSetData {
    uint256 root;        // Merkle root of approved labels
    string ipfsCID;      // IPFS v1 CID referencing off-chain association set data
    uint256 timestamp;   // Update timestamp
  }

  ```

- History maintained for proof verification
- Circular buffer stores recent roots

### Set Validation

- Withdrawals require valid ASP root
- Proof must demonstrate label inclusion
- Latest root used for validation
- Failed validations trigger [ragequit](/protocol/ragequit) option

### Wind Down Process

- Labels can be removed from ASP set
- Removal triggers withdrawal restrictions
- Original depositors can [ragequit](/protocol/ragequit)
- Enables compliant exit path

The ASP system enables Privacy Pools to maintain compliance requirements while preserving the core privacy features of the protocol through cryptographic proofs and controlled label management.
