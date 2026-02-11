---
title: Withdrawal
description: "Direct and relayed withdrawal flows, proof generation, nullifier-spend checks, fee handling, and state transition behavior."
keywords:
  - privacy pools
  - withdrawal
  - relayer
  - direct withdrawal
  - nullifier
  - proof verification
  - fees
---


Privacy Pools supports two types of withdrawals:

1. **Direct Withdrawals**: User directly interacts with pool contract
2. **Relayed Withdrawals**: Withdrawal processed through a relayer for additional privacy

Both methods require [zero-knowledge proofs](/layers/zk/withdrawal) to prove commitment ownership and maintain privacy.

> Integration note:
> For production integrations, relayed withdrawals typically use `https://fastrelay.xyz` on production chains and `https://testnet-relayer.privacypools.com` on Sepolia testnets.  
> For a concise integration path, see [Integrations](/protocol/integrations). For exact request/response schemas (`/relayer/quote`, `/relayer/request`, `/relayer/details`) and `feeCommitment` timing constraints, see [skills.md](https://docs.privacypools.com/skills.md).

## Withdrawal Types Comparison

| Aspect                   | Direct Withdrawal  | Relayed Withdrawal                      |
| ------------------------ | ------------------ | --------------------------------------- |
| Privacy Level            | Basic (signer pays gas, linking address to on-chain activity) | Enhanced (relayer pays gas, decoupling recipient from tx sender) |
| Gas Payment              | User pays directly | Relayer pays, takes fee                 |
| Fee Structure            | No fees            | Configurable relayer fee                |
| Complexity               | Simpler flow       | Additional fee computation              |
| Front-running Protection | Context-based      | Context-based                           |

### Protocol Flow - Direct Withdrawal

```mermaid
sequenceDiagram
    participant User
    participant SDK
    participant Pool
    participant Entrypoint

    Note over User: Has: nullifier, secret,<br/>label, value
    User->>SDK: Prepare withdrawal(amount)

    activate SDK
    Note over SDK: Generate:<br/>newNullifier, newSecret
    SDK->>SDK: Compute remaining value
    SDK->>SDK: Generate Withdrawal proof
    SDK-->>User: withdrawalProof
    deactivate SDK

    User->>Pool: withdraw(withdrawal, proof)

    activate Pool
    Pool->>Pool: Verify processooor == msg.sender
    Pool->>Entrypoint: Check proof uses latest ASP root
    Pool->>Pool: Verify proof


    Pool->>Pool: Update state<br/>Record spent nullifier
    Pool->>User: Transfer amount

    Pool-->>User: Emit Withdrawn
    deactivate Pool

    Note over User: Store new secrets<br/>for remaining balance

```

### Protocol Flow - Relayed Withdrawal

```mermaid
sequenceDiagram
    participant User
    participant SDK
    participant Relayer
    participant Entrypoint
    participant Pool


    Note over User: Has: nullifier, secret,<br/>label, value
    User->>SDK: Prepare withdrawal(amount, relayer)

    activate SDK
    Note over SDK: Generate:<br/>newNullifier, newSecret
    SDK->>SDK: Compute remaining value
    SDK->>SDK: Generate Withdrawal proof
    SDK-->>User: withdrawalProof
    deactivate SDK

    User->>Relayer: Submit withdrawal + proof
    Relayer->>Relayer: Verify proof locally
    Relayer->>Entrypoint: relay(withdrawal, proof, scope)

    activate Entrypoint
    Entrypoint->>Pool: withdraw(withdrawal, proof)

    activate Pool
    Pool->>Pool: Verify processooor is Entrypoint
    Pool->>Pool: Verify proof
    Pool->>Entrypoint: Check proof uses latest ASP root

    Pool->>Pool: Update state<br/>Record spent nullifier
    Pool->>Entrypoint: Transfer full amount
    deactivate Pool

    Entrypoint->>Entrypoint: Calculate fees
    Entrypoint->>User: Transfer(amount - fees)
    Entrypoint->>Relayer: Pay relayer fee

    Entrypoint-->>User: Emit WithdrawalRelayed
    deactivate Entrypoint

    Note over User: Store new secrets<br/>for remaining balance

```

### Withdrawal Data Structure

```solidity
struct Withdrawal {
    address processooor;    // Direct: tx signer (msg.sender), Relayed: Entrypoint address
    bytes data;             // Direct: empty, Relayed: ABI-encoded RelayData
}

struct RelayData {
    address recipient;     // Final recipient of withdrawn funds
    address feeRecipient;  // Relayer address (receives the fee)
    uint256 relayFeeBPS;   // Fee in basis points
}
```

## Withdrawal Steps

### Direct Withdrawal

1. **Proof Generation**
   - User constructs withdrawal parameters
   - Generates ZK proof of commitment ownership
   - Computes new commitment for remaining value
2. **Contract Interaction**
   - User submits proof to pool contract
   - Pool verifies proof and context
   - Updates state (nullifiers, commitments)
   - Transfers assets to signer (processooor)

### Relayed Withdrawal

1. **User Steps**
   - Construct withdrawal with Entrypoint as processooor
   - Generate ZK proof
   - Submit to relayer off-chain
2. **Relayer Steps**
   - Verify proof locally
   - Submit transaction to Entrypoint
   - Pay gas fees
3. **Entrypoint Processing**
   - Verify proof and context
   - Process withdrawal through pool
   - Handle fee distribution
   - Transfer assets to recipient

### Context Generation

The `context` signal binds the proof to specific withdrawal parameters:

```solidity
context = uint256(keccak256(abi.encode(
    withdrawal,
    pool.SCOPE()
))) % SNARK_SCALAR_FIELD;
```
