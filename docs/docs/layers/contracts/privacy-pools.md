---
title: Privacy Pools
---

The PrivacyPool contract is an abstract contract that implements core privacy pools functionality for both native ETH and ERC20 tokens. It:

1. Manages commitments and nullifiers
2. Processes deposits and withdrawals
3. Handles merkle tree state
4. Validates zero-knowledge proofs

The contract extends the State base contract which manages the merkle tree and nullifier state.

## Key Components

### State Management

Inherits key state variables from the State contract:

```solidity
string public constant VERSION = '0.1.0';
uint32 public constant ROOT_HISTORY_SIZE = 30;
IEntrypoint public immutable ENTRYPOINT;
IVerifier public immutable WITHDRAWAL_VERIFIER;
IVerifier public immutable RAGEQUIT_VERIFIER;
uint256 public nonce;
bool public dead;
```

And adds pool-specific state:

```solidity
uint256 public immutable SCOPE;
address public immutable ASSET;
```

## Core Data Structures

### Withdrawal Struct

```solidity
struct Withdrawal {
    address processooor;  // Allowed address to process withdrawal
    uint256 scope;        // Unique pool identifier
    bytes data;          // Encoded arbitrary data used by Entrypoint
}
```

## Core Functionality

### 1. Deposit Processing

```solidity
function deposit(
    address _depositor,
    uint256 _value,
    uint256 _precommitmentHash
) external payable onlyEntrypoint returns (uint256 _commitment)
```

The deposit flow:

1. Validates pool is active
2. Computes unique label from scope and nonce
3. Records deposit details and ragequit cooldown
4. Computes and stores commitment hash
5. Updates merkle tree state
6. Pulls funds from depositor

### 2. Withdrawal Processing

```solidity
function withdraw(
    Withdrawal memory _withdrawal,
    ProofLib.WithdrawProof memory _proof
) external validWithdrawal(_withdrawal, _proof)
```

Handles withdrawals by:

1. Validating withdrawal proof
2. Verifying state root and ASP root
3. Spending nullifier hash
4. Inserting new commitment
5. Transferring funds to processor

### 3. Ragequit Functionality

```solidity
function ragequit(ProofLib.RagequitProof memory _proof) external
```

Allows original depositors to:

1. Reclaim funds when ASP excludes them
2. Verify they are original depositor
3. Spend nullifier hash
4. Receive back deposited funds

### 4. Wind Down Capability

```solidity
function windDown() external onlyEntrypoint
```

Allows graceful shutdown:

1. Marks pool as dead
2. Prevents new deposits
3. Allows existing withdrawals

### Security Features

1. **Access Control**:

- `onlyEntrypoint` modifier for sensitive operations
- `validWithdrawal` modifier for proof validation

1. **Withdrawal Validation**:

```solidity
modifier validWithdrawal(Withdrawal memory _withdrawal, ProofLib.WithdrawProof memory _proof) {
    // Check caller is allowed processor
    if (msg.sender != _withdrawal.processooor) revert InvalidProcesooor();

    // Verify context integrity
    if (_proof.context() != uint256(keccak256(abi.encode(_withdrawal, SCOPE)))) {
        revert ContextMismatch();
    }

    // Validate roots
    if (!_isKnownRoot(_proof.stateRoot())) revert UnknownStateRoot();
    if (_proof.ASPRoot() != ENTRYPOINT.latestRoot()) revert IncorrectASPRoot();
    _;
}
```

1. **Proof Verification**:

- Validates zero-knowledge proofs using Groth16 verifiers
- Verifies nullifier hash uniqueness
- Checks commitment existence

### Asset Handling

The contract is abstract and requires implementation of two key functions:

```solidity
function _pull(address _sender, uint256 _value) internal virtual;
function _push(address _recipient, uint256 _value) internal virtual;
```

These are implemented differently for:

- Native ETH (PrivacyPoolSimple)
- ERC20 tokens (PrivacyPoolComplex)

The PrivacyPool contract provides a robust foundation for implementing privacy-preserving asset pools, with strong security guarantees and efficient state management. It's designed to be extended for specific asset types while maintaining consistent privacy and security properties.
