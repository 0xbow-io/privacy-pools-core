// SPDX-License-Identifier: Apache-2.0
pragma solidity 0.8.28;

import {UUPSUpgradeable} from '@oz-upgradeable/proxy/utils/UUPSUpgradeable.sol';
import {IERC1967} from '@oz/interfaces/IERC1967.sol';
import {Test} from 'forge-std/Test.sol';
import {Entrypoint, IEntrypoint} from 'src/contracts/Entrypoint.sol';

/**
 * @title EntrypointUpgradeTest
 * @notice Integration tests for upgrading the Entrypoint contract on mainnet
 * @dev This test suite verifies the upgrade process of the Entrypoint contract using UUPS proxy pattern
 * @dev Tests are run against a forked mainnet environment to ensure compatibility with production state
 */
contract EntrypointUpgradeTest is Test {
  // Ethereum Mainnet addresses
  address internal implementationV1 = 0xdD8aA0560a08E39C0b3A84BBa356Bc025AfbD4C1;
  Entrypoint internal proxy = Entrypoint(payable(0x6818809EefCe719E480a7526D76bD3e561526b46));
  address public owner = 0xAd7f9A19E2598b6eFE0A25C84FB1c87F81eB7159;

  bytes32 internal constant _OWNER_ROLE = keccak256('OWNER_ROLE');
  bytes32 internal constant _IMPLEMENTATION_SLOT = 0x360894a13ba1a3210667c828492db98dca3e2076cc3735a920a3ca505d382bbc;

  /**
   * @notice Sets up the test environment by forking mainnet
   * @dev This allows tests to run against the actual deployed contract state
   */
  function setUp() public {
    vm.createSelectFork(vm.rpcUrl('mainnet'));
  }

  /**
   * @notice Verifies that the current implementation address matches the expected V1 implementation
   * @dev Checks the implementation slot in the proxy contract to ensure it points to the correct address
   */
  function test_currentImplementationMatches() public view {
    bytes32 _implementationAddressRaw = vm.load(address(proxy), _IMPLEMENTATION_SLOT);
    assertEq(
      address(uint160(uint256(_implementationAddressRaw))), implementationV1, "Implementation addresses don't match"
    );
  }

  /**
   * @notice Verifies that the owner address has the OWNER_ROLE
   * @dev Ensures the access control is properly set up for the upgrade process
   */
  function test_ownerHasOwnerRole() public view {
    assertTrue(proxy.hasRole(_OWNER_ROLE, owner), 'Address does not have the OWNER_ROLE');
  }

  /**
   * @notice Tests the upgrade process to a new implementation
   * @dev This test:
   *      1. Deploys a new implementation contract
   *      2. Verifies the upgrade event is emitted
   *      3. Performs the upgrade as the owner
   *      4. Verifies the implementation slot is updated correctly
   */
  function test_UpgradeEntrypoint_ToNewImplementation() public {
    // 1. Deploy newest version of implementation
    Entrypoint _newImplementation = new Entrypoint();

    // Expect event emission with new implementation address
    vm.expectEmit(address(proxy));
    emit IERC1967.Upgraded(address(_newImplementation));

    // 2. As owner, upgrade to the newest implementation
    vm.prank(owner);
    proxy.upgradeToAndCall(address(_newImplementation), '');

    bytes32 _implementationAddressRaw = vm.load(address(proxy), _IMPLEMENTATION_SLOT);
    assertEq(
      address(uint160(uint256(_implementationAddressRaw))),
      address(_newImplementation),
      "Implementation addresses don't match"
    );
  }
}
