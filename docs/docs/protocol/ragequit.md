---
title: Ragequit
---

Ragequit is a safety mechanism that allows the original depositor to publicly withdraw their funds without needing ASP approval. This operation serves as a critical backup withdrawal method which ensures the ability to withdraw user funds when the label is not approved by the ASP or its approval was revoked (removed from the approved labels set).

## Protocol Flow

```mermaid
sequenceDiagram
    participant User as Original Depositor
    participant SDK
    participant Pool
    participant State as State Tree
    participant RQ as RagequitVerifier

    Note over User,State: User has original commitment parameters<br/>(value, label, nullifier, secret)

    User->>SDK: Generate ragequit proof

    activate SDK
    SDK->>SDK: Compute commitment hash
    SDK->>SDK: Compute precommitment hash
    SDK->>SDK: Compute nullifier hash

    Note over SDK: Package proof with:<br/>- Commitment hash<br/>- Value<br/>- Label
    SDK-->>User: Return ragequit proof
    deactivate SDK

    User->>Pool: ragequit(proof)

    activate Pool

    Pool->>State: Check commitment exists

    alt Commitment not found
        Pool-->>User: Revert: InvalidCommitment
    end

    Pool->>Pool: Verify caller is original depositor

    alt Not original depositor
        Pool-->>User: Revert: OnlyOriginalDepositor
    end

    Pool->>RQ: Verify proof

    alt Invalid proof
        Pool-->>User: Revert: InvalidProof
    end

    Pool->>State: Mark nullifier as spent

    alt Nullifier already spent
        Pool-->>User: Revert: NullifierAlreadySpent
    end

    Pool->>User: Transfer full commitment value

    Pool->>Pool: Emit Ragequit event
    deactivate Pool

    Note over User,State: Funds returned to original depositor<br/>Commitment permanently spent
```

### Ragequit steps

1. Check Requirements
   - Must be original depositor
   - Commitment must not be already spent
2. Generate Proof
3. Call the `ragequit` method with the proof
4. Finalized ragequit
   - User received the full commitment amount
