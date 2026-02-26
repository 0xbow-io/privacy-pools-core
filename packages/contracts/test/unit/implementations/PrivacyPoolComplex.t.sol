// SPDX-License-Identifier: Apache-2.0
pragma solidity 0.8.28;

import {IPrivacyPoolComplex, PrivacyPoolComplex} from 'contracts/implementations/PrivacyPoolComplex.sol';
import {Test} from 'forge-std/Test.sol';

import {IERC20} from '@oz/token/ERC20/IERC20.sol';
import {IPrivacyPool} from 'interfaces/IPrivacyPool.sol';
import {IState} from 'interfaces/IState.sol';

import {Constants} from 'test/helper/Constants.sol';

/**
 * @notice Test contract for the PrivacyPoolComplex
 */
contract ComplexPoolForTest is PrivacyPoolComplex {
  constructor(
    address _entrypoint,
    address _withdrawalVerifier,
    address _ragequitVerifier,
    address _asset
  ) PrivacyPoolComplex(_entrypoint, _withdrawalVerifier, _ragequitVerifier, _asset) {}

  function pull(address _sender, uint256 _amount) external payable {
    _pull(_sender, _amount);
  }

  function push(address _recipient, uint256 _amount) external {
    _push(_recipient, _amount);
  }
}

/**
 * @notice Base test contract for the PrivacyPoolComplex
 */
contract UnitPrivacyPoolComplex is Test {
  ComplexPoolForTest internal _pool;
  uint256 internal _scope;

  address internal immutable _ENTRYPOINT = makeAddr('entrypoint');
  address internal immutable _WITHDRAWAL_VERIFIER = makeAddr('withdrawalVerifier');
  address internal immutable _RAGEQUIT_VERIFIER = makeAddr('ragequitVerifier');
  address internal immutable _ASSET = makeAddr('asset');

  /*//////////////////////////////////////////////////////////////
                            SETUP
  //////////////////////////////////////////////////////////////*/

  function setUp() public {
    _pool = new ComplexPoolForTest(_ENTRYPOINT, _WITHDRAWAL_VERIFIER, _RAGEQUIT_VERIFIER, _ASSET);
    _scope = uint256(keccak256(abi.encodePacked(address(_pool), block.chainid, _ASSET))) % Constants.SNARK_SCALAR_FIELD;
  }

  /*//////////////////////////////////////////////////////////////
                            HELPERS
  //////////////////////////////////////////////////////////////*/

  function _mockAndExpect(address _contract, bytes memory _call, bytes memory _return) internal {
    vm.mockCall(_contract, _call, _return);
    vm.expectCall(_contract, _call);
  }
}

/**
 * @notice Unit tests for the constructor
 */
contract UnitConstructor is UnitPrivacyPoolComplex {
  /**
   * @notice Test for the constructor given valid addresses
   * @dev Assumes all addresses are non-zero and valid
   */
  function test_ConstructorGivenValidAddresses(
    address _entrypoint,
    address _withdrawalVerifier,
    address _ragequitVerifier,
    address _asset
  ) external {
    vm.assume(
      _entrypoint != address(0) && _withdrawalVerifier != address(0) && _ragequitVerifier != address(0)
        && _asset != address(0) && _asset != Constants.NATIVE_ASSET
    );

    _pool = new ComplexPoolForTest(_entrypoint, _withdrawalVerifier, _ragequitVerifier, _asset);
    _scope = uint256(keccak256(abi.encodePacked(address(_pool), block.chainid, _asset))) % Constants.SNARK_SCALAR_FIELD;
    assertEq(address(_pool.ENTRYPOINT()), _entrypoint, 'Entrypoint address should match constructor input');
    assertEq(
      address(_pool.WITHDRAWAL_VERIFIER()),
      _withdrawalVerifier,
      'Withdrawal verifier address should match constructor input'
    );
    assertEq(
      address(_pool.RAGEQUIT_VERIFIER()), _ragequitVerifier, 'Ragequit verifier address should match constructor input'
    );
    assertEq(_pool.ASSET(), _asset, 'Asset address should match constructor input');
    assertEq(_pool.SCOPE(), _scope, 'Scope should be computed correctly');
  }

  /**
   * @notice Test for the constructor when any address is zero
   * @dev Assumes all addresses are non-zero and valid
   */
  function test_ConstructorWhenAnyAddressIsZero(
    address _entrypoint,
    address _withdrawalVerifier,
    address _ragequitVerifier,
    address _asset
  ) external {
    vm.expectRevert(IState.ZeroAddress.selector);
    new ComplexPoolForTest(address(0), _withdrawalVerifier, _ragequitVerifier, _asset);
    vm.expectRevert(IState.ZeroAddress.selector);
    new ComplexPoolForTest(_entrypoint, address(0), _ragequitVerifier, _asset);
    vm.expectRevert(IState.ZeroAddress.selector);
    new ComplexPoolForTest(_entrypoint, _withdrawalVerifier, address(0), _asset);
    vm.expectRevert(IState.ZeroAddress.selector);
    new ComplexPoolForTest(_entrypoint, _withdrawalVerifier, _ragequitVerifier, address(0));
  }

  /**
   * @notice Test that constructor reverts when native asset is used
   */
  function test_ConstructorWhenAssetIsNative(
    address _entrypoint,
    address _withdrawalVerifier,
    address _ragequitVerifier
  ) external {
    vm.assume(_entrypoint != address(0));
    vm.assume(_withdrawalVerifier != address(0));
    vm.assume(_ragequitVerifier != address(0));

    vm.expectRevert(IPrivacyPoolComplex.NativeAssetNotSupported.selector);
    new ComplexPoolForTest(_entrypoint, _withdrawalVerifier, _ragequitVerifier, Constants.NATIVE_ASSET);
  }
}

contract UnitPull is UnitPrivacyPoolComplex {
  /**
   * @notice Test that the pool correctly pulls ERC20 tokens from sender
   */
  function test_Pull(address _sender, uint256 _amount) external {
    // Setup test with valid sender and amount
    vm.assume(_sender != address(0));
    vm.assume(_amount > 0);

    // Mock successful token transfer from sender to pool
    _mockAndExpect(
      _ASSET, abi.encodeWithSelector(IERC20.transferFrom.selector, _sender, address(_pool), _amount), abi.encode(true)
    );

    // Execute pull operation as sender
    vm.prank(_sender);
    _pool.pull(_sender, _amount);
  }

  /**
   * @notice Test that pull reverts when ETH is sent with the call
   */
  function test_PullWhenMsgValueNotZero(address _sender, uint256 _amount) external {
    // Setup test with valid sender and amount
    vm.assume(_sender != address(0));
    vm.assume(_amount > 0);

    // Fund sender with ETH for the test
    deal(address(_sender), _amount);

    // Expect revert when ETH is sent with call
    vm.expectRevert(IPrivacyPoolComplex.NativeAssetNotAccepted.selector);
    vm.prank(_sender);
    _pool.pull{value: _amount}(_sender, _amount);
  }
}

contract UnitPush is UnitPrivacyPoolComplex {
  /**
   * @notice Test that the pool correctly pushes ERC20 tokens to recipient
   */
  function test_Push(address _recipient, uint256 _amount) external {
    // Setup test with valid amount and recipient
    vm.assume(_amount > 0);
    vm.assume(_recipient != address(0));

    // Mock successful token transfer to recipient
    _mockAndExpect(_ASSET, abi.encodeWithSelector(IERC20.transfer.selector, _recipient, _amount), abi.encode(true));

    // Execute push operation as recipient
    vm.prank(_recipient);
    _pool.push(_recipient, _amount);
  }
}
