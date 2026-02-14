---
title: Contracts Interfaces
description: "Contract interface reference for Privacy Pools components, including structs, events, and function signatures."
keywords:
  - privacy pools
  - contract interfaces
  - solidity
  - abi
  - entrypoint
  - privacypool
  - events
---

**`IPrivacyPool`**

Core interface for privacy pools smart contracts that handle deposits and withdrawals.

```solidity
interface IPrivacyPool {
    struct Withdrawal {
        address processooor;    // Allowed address to process withdrawal
        bytes data;             // Encoded arbitrary data for Entrypoint
    }

    // Core Functions
    function deposit(
        address depositor,
        uint256 value,
        uint256 precommitment
    ) external payable returns (uint256 commitment);

    function withdraw(
        Withdrawal memory w,
        ProofLib.WithdrawProof memory p
    ) external;

    function ragequit(ProofLib.RagequitProof memory p) external;

    // View Functions
    function SCOPE() external view returns (uint256);
    function ASSET() external view returns (address);
    function currentRoot() external view returns (uint256);
}

```

**`IEntrypoint`**

Central registry and coordinator for privacy pools.

```solidity
interface IEntrypoint {
    struct AssetConfig {
        IPrivacyPool pool;
        uint256 minimumDepositAmount;
        uint256 vettingFeeBPS;
        uint256 maxRelayFeeBPS;
    }

    struct RelayData {
        address recipient;
        address feeRecipient;
        uint256 relayFeeBPS;
    }

    // Registry Functions
    function registerPool(
        IERC20 asset,
        IPrivacyPool pool,
        uint256 minimumDepositAmount,
        uint256 vettingFeeBPS,
        uint256 maxRelayFeeBPS
    ) external;

    function deposit(uint256 precommitment) external payable returns (uint256);

    function deposit(
        IERC20 asset,
        uint256 value,
        uint256 precommitment
    ) external returns (uint256);

    function relay(
        IPrivacyPool.Withdrawal calldata withdrawal,
        ProofLib.WithdrawProof calldata proof,
        uint256 scope
    ) external;

    // ASP Root Management
    function updateRoot(uint256 root, string memory ipfsCID) external returns (uint256 index);

    // View Functions
    function scopeToPool(uint256 scope) external view returns (IPrivacyPool);
    function assetConfig(IERC20 asset) external view returns (
        IPrivacyPool pool,
        uint256 minimumDepositAmount,
        uint256 vettingFeeBPS,
        uint256 maxRelayFeeBPS
    );
    function latestRoot() external view returns (uint256);
}

```
