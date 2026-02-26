// SPDX-License-Identifier: Apache-2.0

pragma solidity 0.8.28;

import {Entrypoint} from 'contracts/Entrypoint.sol';

import {Script} from 'forge-std/Script.sol';

import {IERC20} from '@oz/interfaces/IERC20.sol';
import {IPrivacyPool} from 'interfaces/IPrivacyPool.sol';

import {Constants} from 'contracts/lib/Constants.sol';

/**
 * @notice Script to register a Privacy Pool.
 */
contract RegisterPool is Script {
  // @notice The deployed Entrypoint
  Entrypoint public entrypoint;
  // @notice The Pool asset
  IERC20 internal _asset;
  // @notice The PrivacyPool address
  IPrivacyPool internal _pool;
  // @notice The minimum amount to deposit
  uint256 internal _minimumDepositAmount;
  // @notice The vetting fee in basis points
  uint256 internal _vettingFeeBPS;
  // @notice The maximum relay fee in basis points
  uint256 internal _maxRelayFeeBPS;

  function setUp() public {
    // Read the Entrypoint address from environment
    entrypoint = Entrypoint(payable(vm.envAddress('ENTRYPOINT_ADDRESS')));

    // Ask the user for the asset address
    try vm.parseAddress(vm.prompt('Enter asset address (empty for native)')) returns (address _assetAddress) {
      _asset = IERC20(_assetAddress);
    } catch {
      _asset = IERC20(Constants.NATIVE_ASSET);
    }

    // Ask the user for the PrivayPool address
    _pool = IPrivacyPool(vm.parseAddress(vm.prompt('Enter pool address')));
    // Ask the user for the minimum deposit amount
    _minimumDepositAmount = vm.parseUint(vm.prompt('Enter minimum deposit amount padded with decimals'));
    // Ask the user for the vetting fee in basis points
    _vettingFeeBPS = vm.parseUint(vm.prompt('Enter vetting fee BPS'));
    // Ask the user for the max relay fee in basis points
    _maxRelayFeeBPS = vm.parseUint(vm.prompt('Enter max relay fee BPS'));
  }

  // @dev Must be called with the `--account` flag which acts as the caller
  function run() public {
    vm.startBroadcast();

    // Register pool
    entrypoint.registerPool(_asset, _pool, _minimumDepositAmount, _vettingFeeBPS, _maxRelayFeeBPS);

    vm.stopBroadcast();
  }
}

/**
 * @notice Script to update an ASP root.
 */
contract UpdateRoot is Script {
  // @notice The deployed Entrypoint
  Entrypoint public entrypoint;

  // @notice Placeholder IPFS CID
  string public IPFS_CID = 'ipfs_cid_ipfs_cid_ipfs_cid_ipfs_cid_ipfs_cid_';
  // @notice New computed root
  uint256 public newRoot;

  function setUp() public {
    // Read the Entrypoint address from environment
    entrypoint = Entrypoint(payable(vm.envAddress('ENTRYPOINT_ADDRESS')));

    // Build merkle tree and compute root
    newRoot = _computeMerkleRoot();
  }

  // @notice Compute merkle root using LeanIMT lib
  function _computeMerkleRoot() internal returns (uint256) {
    string[] memory runCommand = new string[](2);
    runCommand[0] = 'node';
    runCommand[1] = 'script/utils/tree.mjs';
    bytes memory result = vm.ffi(runCommand);

    // Parse the root from the output
    return abi.decode(result, (uint256));
  }

  // @dev Must be called with the `--account` flag which acts as the caller
  function run() public {
    vm.startBroadcast();

    // Update root
    entrypoint.updateRoot(newRoot, IPFS_CID);

    vm.stopBroadcast();
  }
}

/**
 * @notice Script to assign a role in the Entrypoint.
 */
contract AssignRole is Script {
  // @notice Owner role
  bytes32 internal constant _OWNER_ROLE = 0x6270edb7c868f86fda4adedba75108201087268ea345934db8bad688e1feb91b;
  // @notice Postman role
  bytes32 internal constant _ASP_POSTMAN = 0xfc84ade01695dae2ade01aa4226dc40bdceaf9d5dbd3bf8630b1dd5af195bbc5;

  // @notice The deployed Entrypoint
  Entrypoint public entrypoint;

  // @notice Account to assign the role to
  address internal _account;
  // @notice Role to assign
  bytes32 internal _role;

  error InvalidRoleID();

  function setUp() public {
    // Read the Entrypoint address from environment
    entrypoint = Entrypoint(payable(vm.envAddress('ENTRYPOINT_ADDRESS')));

    // Ask the user for the account to assign the role to
    _account = vm.parseAddress(vm.prompt('Enter account'));

    // Ask the user for the role to assign
    uint256 _roleId = vm.parseUint(vm.prompt('Select role [owner: 0, postman: 1]'));
    if (_roleId > 1) revert InvalidRoleID();
    _role = _roleId == 0 ? _OWNER_ROLE : _ASP_POSTMAN;
  }

  // @dev Must be called with the `--account` flag which acts as the caller
  function run() public {
    vm.startBroadcast();

    // Grant role to account
    entrypoint.grantRole(_role, _account);

    vm.stopBroadcast();
  }
}
