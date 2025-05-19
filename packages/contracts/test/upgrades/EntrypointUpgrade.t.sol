// SPDX-License-Identifier: Apache-2.0
pragma solidity 0.8.28;

import {UUPSUpgradeable} from '@oz-upgradeable/proxy/utils/UUPSUpgradeable.sol';
import {IERC1967} from '@oz/interfaces/IERC1967.sol';
import {Test} from 'forge-std/Test.sol';

import {IERC20} from '@oz/interfaces/IERC20.sol';
import {Constants} from 'contracts/lib/Constants.sol';

import {PrivacyPoolComplex} from 'contracts/implementations/PrivacyPoolComplex.sol';
import {IPrivacyPool} from 'interfaces/IPrivacyPool.sol';
import {Entrypoint, IEntrypoint} from 'src/contracts/Entrypoint.sol';

contract MainnetEnvironment {
  /// @notice Current implementation address
  address internal implementationV1 = 0xdD8aA0560a08E39C0b3A84BBa356Bc025AfbD4C1;
  /// @notice Entrypoint ERC1967Proxy address
  Entrypoint internal proxy = Entrypoint(payable(0x6818809EefCe719E480a7526D76bD3e561526b46));

  /// @notice ETH Privacy Pool address
  IPrivacyPool public constant ethPool = IPrivacyPool(0xF241d57C6DebAe225c0F2e6eA1529373C9A9C9fB);

  /// @notice Owner address (SAFE multisig)
  address public constant owner = 0xAd7f9A19E2598b6eFE0A25C84FB1c87F81eB7159;
  /// @notice Postman address
  address public constant postman = 0x1f4Fe25Cf802a0605229e0Dc497aAf653E86E187;

  /// @notice Association set index at fork block
  uint256 internal constant _associationSetIndex = 20;

  /// @notice Ethereum Mainnet fork block
  uint256 internal constant _FORK_BLOCK = 22_495_337;
}

/**
 * @title EntrypointUpgradeIntegration
 * @notice Integration tests for upgrading the Entrypoint contract on mainnet
 * @dev This test suite verifies the upgrade process of the Entrypoint contract using UUPS proxy pattern
 * @dev Tests are run against a forked mainnet environment to ensure compatibility with production state
 */
contract EntrypointUpgradeIntegration is Test, MainnetEnvironment {
  /// @notice Entrypoint owner role
  bytes32 internal constant _OWNER_ROLE = keccak256('OWNER_ROLE');
  /// @notice Entrypoint postman role
  bytes32 internal constant _ASP_POSTMAN = keccak256('ASP_POSTMAN');
  /// @notice Storage slot where the implementation address is located for ERC1967 Proxies
  bytes32 internal constant _IMPLEMENTATION_SLOT = 0x360894a13ba1a3210667c828492db98dca3e2076cc3735a920a3ca505d382bbc;

  /// @notice Pool configuration tracking
  IPrivacyPool internal _poolAddressFromConfig;
  uint256 internal _minimumDepositAmountFromConfig;
  uint256 internal _vettingFeeBPSFromConfig;
  uint256 internal _maxRelayFeeBPSFromConfig;
  uint256 internal _ethPoolScopeFromConfig;
  uint256 internal _ethPoolScope;

  /// @notice Root state tracking
  uint256 internal _latestASPRoot;
  uint256 internal _latestRootByIndex;

  address internal _user = makeAddr('user');

  function setUp() public {
    // Fork from specific block since that's the tree state we're using
    vm.createSelectFork(vm.rpcUrl('mainnet'), _FORK_BLOCK);

    // Store current asset configuration previous to upgrade
    (_poolAddressFromConfig, _minimumDepositAmountFromConfig, _vettingFeeBPSFromConfig, _maxRelayFeeBPSFromConfig) =
      proxy.assetConfig(IERC20(Constants.NATIVE_ASSET));
    _ethPoolScope = ethPool.SCOPE();

    // Store root state previous to upgrade
    _latestASPRoot = proxy.latestRoot();
    _latestRootByIndex = proxy.rootByIndex(_associationSetIndex);

    // Deploy new Entrypoint implementation
    Entrypoint _newImplementation = new Entrypoint();

    // Expect event emission with new implementation address
    vm.expectEmit(address(proxy));
    emit IERC1967.Upgraded(address(_newImplementation));

    // As owner, upgrade to the new implementation
    vm.prank(owner);
    proxy.upgradeToAndCall(address(_newImplementation), '');

    // Check the implementation was successfully updated in the proxy storage
    bytes32 _implementationAddressRaw = vm.load(address(proxy), _IMPLEMENTATION_SLOT);
    assertEq(
      address(uint160(uint256(_implementationAddressRaw))),
      address(_newImplementation),
      "Implementation addresses don't match"
    );
  }

  function test_StateIsKept() public view {
    // Check owner has kept his role
    assertTrue(proxy.hasRole(_OWNER_ROLE, owner), 'Owner address must have the owner role');
    assertTrue(proxy.hasRole(_ASP_POSTMAN, postman), 'Postman address must have the postman role');

    // Fetch current configuration for ETH pool
    (IPrivacyPool _pool, uint256 _minimumDepositAmount, uint256 _vettingFeeBPS, uint256 _maxRelayFeeBPS) =
      proxy.assetConfig(IERC20(Constants.NATIVE_ASSET));

    // Check the address for the ETH pool has not changed
    assertEq(address(_pool), address(_poolAddressFromConfig), 'ETH pool address must be the same');
    // Check the minimum deposit amount for the ETH pool has not changed
    assertEq(_minimumDepositAmount, _minimumDepositAmountFromConfig, 'Minimum deposit amount must be the same');
    // Check the vetting fee for the ETH pool has not changed
    assertEq(_vettingFeeBPS, _vettingFeeBPSFromConfig, 'Vetting fee BPS must be the same');
    // Check the max relay fee for the ETH pool has not changed
    assertEq(_maxRelayFeeBPS, _maxRelayFeeBPSFromConfig, 'Max relay fee BPS must be the same');

    // Check the registered scope for the ETH pool has not changed
    assertEq(address(_pool), address(proxy.scopeToPool(_ethPoolScope)), 'ETH pool scope must match');

    // Check the latest root has not changed
    assertEq(proxy.latestRoot(), _latestASPRoot, 'Root must have not changed');
    // Check the latest root index has not changed
    assertEq(proxy.rootByIndex(_associationSetIndex), _latestASPRoot, 'Index must have not changed');
  }

  // NOTE: not sure this test adds any value (yet)
  function test_CurrentRootMatches() public {
    // Command to execute the script
    string[] memory inputs = new string[](2);
    inputs[0] = 'node';
    // Path to the script, assuming 'forge test' is run from the workspace root
    inputs[1] = 'test/upgrades/calculateRoot.mjs';

    // Execute the script using ffi
    bytes memory result = vm.ffi(inputs);

    // Decode the ABI-encoded uint256 output from the script
    uint256 localCalculatedRoot = abi.decode(result, (uint256));

    // Get the current root from the forked environment
    uint256 onChainRoot = ethPool.currentRoot();

    // Assert that the locally calculated root matches the on-chain root
    assertEq(localCalculatedRoot, onChainRoot, 'Local root does not match on-chain root');
  }

  function test_UpdateRoot() public {
    uint256 _newRoot = uint256(keccak256('some_root'));

    // Push some random root as postman
    vm.prank(postman);
    proxy.updateRoot(_newRoot, 'ipfs_cid_ipfs_cid_ipfs_cid_ipfs_cid_ipfs_cid_ipfs_cid');

    // Check lates root and latest index were updated correctly
    assertEq(proxy.latestRoot(), _newRoot, 'ASP root must have been updated');
    assertEq(proxy.rootByIndex(_associationSetIndex + 1), _newRoot, 'ASP root index must have been updated');
  }

  function test_ETHDeposit() public {
    uint256 _depositAmount = 10 ether;

    // Calculate deposited amount after configured fees
    uint256 _afterFees = _deductFee(_depositAmount, _vettingFeeBPSFromConfig);
    uint256 _fees = _depositAmount - _afterFees;

    // Deal user
    vm.deal(_user, _depositAmount);

    // Fetch previous balances
    uint256 _entrypointBalanceBefore = address(proxy).balance;
    uint256 _poolBalanceBefore = address(ethPool).balance;

    // Expect `deposit` call to ETH pool
    vm.expectCall(
      address(ethPool),
      _afterFees,
      abi.encodeWithSelector(IPrivacyPool.deposit.selector, _user, _afterFees, uint256(keccak256('precommitment')))
    );

    // Deposit
    vm.prank(_user);
    proxy.deposit{value: _depositAmount}(_user, uint256(keccak256('precommitment')));

    // Check balances were updated correctly
    assertEq(_entrypointBalanceBefore + _fees, address(proxy).balance, 'Entrypoint balance mismatch');
    assertEq(_poolBalanceBefore + _afterFees, address(ethPool).balance, 'Pool balance mismatch');
  }

  function test_RegisterNewPool() public {
    address _raiToken = 0x03ab458634910AaD20eF5f1C8ee96F1D6ac54919;

    // Deploy new RAI pool
    PrivacyPoolComplex _raiPool = new PrivacyPoolComplex(
      address(proxy), address(ethPool.WITHDRAWAL_VERIFIER()), address(ethPool.RAGEQUIT_VERIFIER()), _raiToken
    );
    uint256 _poolScope = _raiPool.SCOPE();

    // Register pool as owner
    vm.prank(owner);
    proxy.registerPool(IERC20(_raiToken), IPrivacyPool(address(_raiPool)), 0.1 ether, 1000, 500);

    // Check pool is active
    assertFalse(_raiPool.dead(), 'Pool must be alive');

    // Fetch stored configuration for RAI pool
    (_poolAddressFromConfig, _minimumDepositAmountFromConfig, _vettingFeeBPSFromConfig, _maxRelayFeeBPSFromConfig) =
      proxy.assetConfig(IERC20(_raiToken));

    // Check the configured values match the ones provided by the owner on `registerPool`
    assertEq(address(_poolAddressFromConfig), address(_raiPool), 'Registered pool address must match');
    assertEq(_minimumDepositAmountFromConfig, 0.1 ether, 'Minimum deposit amount must match');
    assertEq(_vettingFeeBPSFromConfig, 1000, 'Vetting fee must match');
    assertEq(_maxRelayFeeBPSFromConfig, 500, 'Max relay fee must match');
    assertEq(address(_raiPool), address(proxy.scopeToPool(_poolScope)), 'Registered pool scope must match');

    // As owner, wind down RAI pool
    vm.prank(owner);
    proxy.windDownPool(IPrivacyPool(address(_raiPool)));

    // Check pool is disabled
    assertTrue(_raiPool.dead(), 'Pool must be dead');
  }

  function test_WindDownAndRemovePool() public {
    // Check pool is active
    assertFalse(ethPool.dead(), 'Pool must be alive');

    // Wind down pool
    vm.prank(owner);
    proxy.windDownPool(IPrivacyPool(address(ethPool)));

    // Check pool is disabled
    assertTrue(ethPool.dead(), 'Pool must be dead');

    // Remove pool from configuration
    vm.prank(owner);
    proxy.removePool(IERC20(Constants.NATIVE_ASSET));

    // Fetch updated pool configuration
    (_poolAddressFromConfig, _minimumDepositAmountFromConfig, _vettingFeeBPSFromConfig, _maxRelayFeeBPSFromConfig) =
      proxy.assetConfig(IERC20(Constants.NATIVE_ASSET));

    // Check all values were zeroe'd
    assertEq(address(_poolAddressFromConfig), address(0), 'Registered pool address must be address zero');
    assertEq(_minimumDepositAmountFromConfig, 0, 'Minimum deposit amount must be zero');
    assertEq(_vettingFeeBPSFromConfig, 0, 'Vetting fee must be zero');
    assertEq(_maxRelayFeeBPSFromConfig, 0, 'Max relay fee must be zero');
  }

  function test_WithdrawFees() public {
    // Fetch previous balances
    uint256 _ownerBalanceBefore = owner.balance;
    uint256 _entrypointBalanceBefore = address(proxy).balance;

    // Withdraw all ETH fees to owner
    vm.prank(owner);
    proxy.withdrawFees(IERC20(Constants.NATIVE_ASSET), owner);

    // Check balances were updated correctly
    assertEq(owner.balance, _ownerBalanceBefore + _entrypointBalanceBefore, 'Owner balance mismatch');
    assertEq(address(proxy).balance, 0, 'Entrypoint balance should be zero');
  }

  function _deductFee(uint256 _amount, uint256 _feeBPS) internal pure returns (uint256 _afterFees) {
    _afterFees = _amount - ((_amount * _feeBPS) / 10_000);
  }
}

