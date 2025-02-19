---
title: Contracts Interfaces
---

**`IPrivacyPool`**

Core interface for privacy pool smart contracts that handle deposits and withdrawals.

```solidity
interface IPrivacyPool {
    struct Withdrawal {
        address processooor;    // Allowed address to process withdrawal
        uint256 scope;         // Unique pool identifier
        bytes data;           // Encoded arbitrary data for Entrypoint
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
    }

    struct FeeData {
        address recipient;
        address feeRecipient;
        uint256 relayFeeBPS;
    }

    // Registry Functions
    function registerPool(
        IERC20 asset,
        IPrivacyPool pool,
        uint256 minimumDepositAmount,
        uint256 vettingFeeBPS
    ) external;

    function deposit(uint256 precommitment) external payable returns (uint256);

    function deposit(
        IERC20 asset,
        uint256 value,
        uint256 precommitment
    ) external returns (uint256);

    function relay(
        IPrivacyPool.Withdrawal calldata withdrawal,
        ProofLib.WithdrawProof calldata proof
    ) external;

    // View Functions
    function scopeToPool(uint256 scope) external view returns (IPrivacyPool);
    function assetConfig(IERC20 asset) external view returns (
        IPrivacyPool pool,
        uint256 minimumDepositAmount,
        uint256 vettingFeeBPS
    );
}

```
