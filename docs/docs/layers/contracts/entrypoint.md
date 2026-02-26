---
title: Entrypoint
---

The Entrypoint contract acts as the central coordinator for the Privacy Pools protocol, managing:

1. Asset-specific privacy pools
2. Deposits and withdrawal relays
3. Association Set Provider (ASP) root updates
4. Protocol fees and configurations

It follows the UUPS (Universal Upgradeable Proxy Standard) pattern and uses OpenZeppelin's AccessControl for role-based permissions.

## Key Components

### State Management

The contract maintains several key state variables:

```solidity
mapping(uint256 _scope => IPrivacyPool _pool) public scopeToPool;
mapping(IERC20 _asset => AssetConfig _config) public assetConfig;
AssociationSetData[] public associationSets;
```

- `scopeToPool`: Maps pool identifiers to their contract addresses
- `assetConfig`: Stores configurations for each supported asset
- `associationSets`: Maintains an array of ASP root data for withdrawal validations

### Access Control

Two main roles control the contract:

- `OWNER_ROLE`: Can register/remove pools and manage configurations
- `ASP_POSTMAN`: Can update ASP roots that validate withdrawals

## Core Functionality

### 1. Deposit Flow

The contract supports both native ETH and ERC20 deposits:

```solidity
function deposit(uint256 _precommitment) external payable returns (uint256 _commitment);
function deposit(IERC20 _asset, uint256 _value, uint256 _precommitment) external returns (uint256 _commitment);
```

The deposit process:

1. Validates minimum deposit amount
2. Calculates and deducts protocol fees
3. Forwards remaining funds to appropriate privacy pools
4. Returns commitment hash for future withdrawals

### 2. Withdrawal Relay

```solidity
function relay(IPrivacyPool.Withdrawal calldata _withdrawal, ProofLib.WithdrawProof calldata _proof) external nonReentrant
```

Handles private withdrawals by:

1. Verifying withdrawal proofs
2. Processing withdrawals through privacy pools
3. Distributing funds between recipient and relayer (if used)
4. Enforcing security checks on pool state

### 3. Pool Management

Provides functions for pool lifecycle management:

```solidity
function registerPool(IERC20 _asset, IPrivacyPool _pool, uint256 _minimumDepositAmount, uint256 _vettingFeeBPS) external;
function removePool(IERC20 _asset) external;
function updatePoolConfiguration(IERC20 _asset, uint256 _minimumDepositAmount, uint256 _vettingFeeBPS) external;
function windDownPool(IPrivacyPool _pool) external;
```

These functions allow:

- Registration of new privacy pools
- Removal of existing pools
- Configuration updates
- Graceful shutdown of pools

### 4. ASP Root Management

```solidity
function updateRoot(uint256 _root, bytes32 _ipfsHash) external returns (uint256 _index);
```

Maintains withdrawal validation data:

1. Stores new ASP roots
2. Links to IPFS data containing validation details
3. Tracks root update timestamps

### Security Features

1. **Reentrancy Protection**: Uses OpenZeppelin's ReentrancyGuard
2. **Access Control**: Role-based permissions for sensitive operations
3. **Fee Validation**: Ensures fees cannot exceed 100%
4. **Balance Verification**: Checks pool state consistency after operations
5. **Upgradability**: UUPS pattern with owner-controlled upgrades

### Fee Management

The contract handles two types of fees:

1. **Vetting Fees**: Charged on deposits via contract, controlled by pool configuration
2. **Relay Fees**: Optional fees for relayed withdrawals (paid to the relayer)

Fees can be withdrawn by the owner:

```solidity
function withdrawFees(IERC20 _asset, address _recipient) external;
```
