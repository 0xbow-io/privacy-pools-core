// SPDX-License-Identifier: MIT
pragma solidity 0.8.28;

import {ProofLib} from './lib/ProofLib.sol';

import {AccessControl} from '@oz/access/AccessControl.sol';
import {UUPSUpgradeable} from '@oz/proxy/utils/UUPSUpgradeable.sol';
import {SafeERC20} from '@oz/token/ERC20/utils/SafeERC20.sol';

import {IERC20} from '@oz/interfaces/IERC20.sol';
import {IEntrypoint} from 'interfaces/IEntrypoint.sol';
import {IPrivacyPool} from 'interfaces/IPrivacyPool.sol';

contract Entrypoint is AccessControl, UUPSUpgradeable, IEntrypoint {
  using SafeERC20 for IERC20;
  using ProofLib for ProofLib.Proof;

  bytes32 public constant OWNER_ROLE = 0x6270edb7c868f86fda4adedba75108201087268ea345934db8bad688e1feb91b;
  bytes32 public constant ADMIN_ROLE = 0xdf8b4c520ffe197c5343c6f5aec59570151ef9a492f2c624fd45ddde6135ec42;
  address public ETH = 0xEeeeeEeeeEeEeeEeEeEeeEEEeeeeEeeeeeeeEEeE;

  mapping(uint256 _scope => IPrivacyPool _pool) public scopeToPool;
  mapping(IERC20 _asset => AssetConfig _config) public assetConfig;
  AssociationSetData[] public associationSets;

  /*///////////////////////////////////////////////////////////////
                      ASSOCIATION SET METHODS
    //////////////////////////////////////////////////////////////*/

  function updateRoot(uint256 _root, bytes32 _ipfsHash) external onlyRole(ADMIN_ROLE) {
    require(_root != 0, EmptyRoot());
    require(_ipfsHash != 0, EmptyIPFSHash());

    associationSets.push(AssociationSetData(_root, _ipfsHash, block.timestamp));

    emit RootUpdated(_root, _ipfsHash, block.timestamp);
  }

  /*///////////////////////////////////////////////////////////////
                          DEPOSIT METHODS
    //////////////////////////////////////////////////////////////*/

  function deposit(uint256 _precommitment) external payable returns (uint256 _commitment) {
    AssetConfig memory _config = assetConfig[IERC20(ETH)];

    // Fetch ETH pool
    IPrivacyPool _pool = _config.pool;
    require(address(_pool) != address(0), PoolNotFound());

    // Check deposited value is bigger than minimum
    require(msg.value >= _config.minimumDepositAmount, MinimumDepositAmount());

    // Deduct fees
    uint256 _amountAfterFees = _deductFee(msg.value, _config.feeBPS);

    // Deposit commitment into pool
    _commitment = _pool.deposit{value: _amountAfterFees}(msg.sender, _amountAfterFees, _precommitment);

    emit Deposited(msg.sender, _pool, _amountAfterFees);
  }

  function deposit(IERC20 _asset, uint256 _value, uint256 _precommitment) external returns (uint256 _commitment) {
    AssetConfig memory _config = assetConfig[_asset];

    // Fetch pool by asset
    IPrivacyPool _pool = _config.pool;
    require(address(_pool) != address(0), PoolNotFound());

    // Check deposited value is bigger than minimum
    require(_value >= _config.minimumDepositAmount, MinimumDepositAmount());

    // Deduct fees
    uint256 _amountAfterFees = _deductFee(_value, _config.feeBPS);

    // Transfer assets from user to Entrypoint using `SafeERC20`
    _asset.safeTransferFrom(msg.sender, address(this), _value);

    // Deposit commitment into pool
    _commitment = _pool.deposit(msg.sender, _amountAfterFees, _precommitment);

    emit Deposited(msg.sender, _pool, _amountAfterFees);
  }

  /*///////////////////////////////////////////////////////////////
                               RELAY
    //////////////////////////////////////////////////////////////*/

  function relay(IPrivacyPool.Withdrawal calldata _withdrawal, ProofLib.Proof calldata _proof) external {
    // Fetch pool by proof scope
    IPrivacyPool _pool = scopeToPool[_proof.scope()];
    require(address(_pool) != address(0), PoolNotFound());

    // Store pool asset
    IERC20 _asset = _pool.ASSET();

    // Check allowed procesooor is this Entrypoint
    require(_withdrawal.procesooor == address(this), InvalidProcessooor());

    uint256 _balanceBefore = _asset.balanceOf(address(this));

    // Process withdrawal
    _pool.withdraw(_withdrawal, _proof);

    // Decode fee data
    FeeData memory _data = abi.decode(_withdrawal.data, (FeeData));
    uint256 _withdrawnAmount = _proof.withdrawnAmount();

    // Deduct fees
    uint256 _amountAfterFees = _deductFee(_withdrawnAmount, _data.feeBPS);

    // Transfer withdrawn amount less fees to withdrawal recipient
    _asset.safeTransferFrom(address(this), _data.recipient, _amountAfterFees);

    // Transfer fees to fee recipient
    _asset.safeTransferFrom(address(this), _data.feeRecipient, _withdrawnAmount - _amountAfterFees);

    // Check pool balance has not been reduced
    uint256 _balanceAfter = _asset.balanceOf(address(this));
    require(_balanceBefore >= _balanceAfter, InvalidPoolState());

    emit WithdrawalRelayed(msg.sender, _data.recipient, _asset, _withdrawnAmount, _withdrawnAmount - _amountAfterFees);
  }

  /*///////////////////////////////////////////////////////////////
                          POOL MANAGEMENT 
    //////////////////////////////////////////////////////////////*/

  function registerPool(
    IERC20 _asset,
    IPrivacyPool _pool,
    uint256 _minimumDepositAmount,
    uint256 _feeBPS
  ) external onlyRole(ADMIN_ROLE) {
    AssetConfig storage _config = assetConfig[_asset];

    require(address(_config.pool) == address(0), AssetPoolAlreadyRegistered());

    uint256 _scope = _pool.SCOPE();
    require(address(scopeToPool[_scope]) == address(0), ScopePoolAlreadyRegistered());

    scopeToPool[_scope] = _pool;

    _config.pool = _pool;
    _config.minimumDepositAmount = _minimumDepositAmount;
    _config.feeBPS = _feeBPS;

    _asset.approve(address(_pool), type(uint256).max);

    emit PoolRegistered(_pool, _asset, _scope);
  }

  function removePool(IERC20 _asset) external onlyRole(ADMIN_ROLE) {
    IPrivacyPool _pool = assetConfig[_asset].pool;
    require(address(_pool) != address(0), PoolNotFound());

    uint256 _scope = _pool.SCOPE();

    delete scopeToPool[_scope];
    delete assetConfig[_asset];

    emit PoolRemoved(_pool, _asset, _scope);
  }

  function windDownPool(IPrivacyPool _pool) external onlyRole(OWNER_ROLE) {
    _pool.windDown();
    emit PoolWindDown(_pool);
  }

  /*///////////////////////////////////////////////////////////////
                           VIEW METHODS 
    //////////////////////////////////////////////////////////////*/

  function latestRoot() external view returns (uint256 _root) {
    _root = associationSets[associationSets.length].root;
  }

  function rootByIndex(uint256 _index) external view returns (uint256 _root) {
    _root = associationSets[_index].root;
  }

  /*///////////////////////////////////////////////////////////////
                        INTERNAL METHODS 
    //////////////////////////////////////////////////////////////*/

  function _deductFee(uint256 _amount, uint256 _feeBPS) internal pure returns (uint256 _afterFees) {
    _afterFees = _amount - (_amount * _feeBPS) / 10_000;
  }

  function _authorizeUpgrade(address newImplementation) internal override onlyRole(OWNER_ROLE) {}
}
