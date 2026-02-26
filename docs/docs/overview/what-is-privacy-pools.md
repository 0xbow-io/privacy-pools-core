---
title: What is Privacy Pools?
slug: /
---

### The challenge of private transactions

On public blockchains like Ethereum, every transaction is visible to everyone. While this transparency is a core feature, it creates significant privacy challenges and risks for users. When all transactions are visible, every transaction reveals the full balances and transaction history of both parties.

### Privacy Pools offers a solution

Privacy Pool enables private withdrawals through a combination of zero-knowledge proofs and commitment schemes. Users can deposit assets into Privacy Pools and later withdraw them, either partially or fully, without creating an on-chain link between their deposit and withdrawal addresses. The protocol uses an Association Set Provider (ASP) to maintain a set of approved deposits, preventing potentially illicit funds from entering the system and enabling regulatory compliance.

### System architecture overview

Privacy pool's architecture consists of three distinct layers:

1. **Contract Layer**
   - An upgradeable Entrypoint contract that coordinates ASP-operated privacy pool
   - Asset-specific privacy pools that hold funds and manage state
2. **Zero-Knowledge Layer**
   - Commitment circuits for secure deposit registration
   - Withdrawal circuits that enable private asset withdrawals
   - On-chain verifiers that validate circuit proofs
3. **Association Set Provider (ASP) Layer**
   - Maintains the current set of approved deposit labels
   - Updates state through authorized accounts
   - Enables regulatory compliance without compromising privacy

These layers work together to create a secure privacy-preserving system: the contract layer manages assets and state, the zero-knowledge layer ensures privacy, and the ASP layer provides compliance capabilities.

### Key features and capabilities

- **Partial Withdrawals**: Users can withdraw portions of their deposits while maintaining privacy.
- **Multi-Asset Support**: Supports both native cryptocurrency and ERC20 tokens.
- **Compliance Integration**: ASP-based approval system for regulatory compliance.
- **Non-Custodial**: Users maintain control of their funds through cryptographic commitments.
- **Ragequit Mechanism**: Allows original depositors to recover funds if their funds are not approved by the ASP by **publicly** exiting the privacy pool.
