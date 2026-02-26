// SPDX-License-Identifier: Apache-2.0
pragma solidity 0.8.28;

import {IPrivacyPoolSimple, PrivacyPoolSimple} from 'contracts/implementations/PrivacyPoolSimple.sol';
import {Test} from 'forge-std/Test.sol';
import {Constants} from 'test/helper/Constants.sol';

import {IPrivacyPool} from 'interfaces/IPrivacyPool.sol';
import {IState} from 'interfaces/IState.sol';

/**
 * @notice Test contract for the PrivacyPoolSimple
 */
contract SimplePoolForTest is PrivacyPoolSimple {
  constructor(
    address _entrypoint,
    address _withdrawalVerifier,
    address _ragequitVerifier
  ) PrivacyPoolSimple(_entrypoint, _withdrawalVerifier, _ragequitVerifier) {}

  function pull(address _sender, uint256 _amount) external payable {
    _pull(_sender, _amount);
  }

  function push(address _recipient, uint256 _amount) external {
    _push(_recipient, _amount);
  }
}

/**
 * @notice Base test contract for the PrivacyPoolSimple
 */
contract UnitPrivacyPoolSimple is Test {
  SimplePoolForTest internal _pool;
  uint256 internal _scope;

  address internal immutable _ENTRYPOINT = makeAddr('entrypoint');
  address internal immutable _WITHDRAWAL_VERIFIER = makeAddr('withdrawalVerifier');
  address internal immutable _RAGEQUIT_VERIFIER = makeAddr('ragequitVerifier');
  address internal immutable _ASSET = 0xEeeeeEeeeEeEeeEeEeEeeEEEeeeeEeeeeeeeEEeE;

  /*//////////////////////////////////////////////////////////////
                            SETUP
  //////////////////////////////////////////////////////////////*/

  function setUp() public {
    _pool = new SimplePoolForTest(_ENTRYPOINT, _WITHDRAWAL_VERIFIER, _RAGEQUIT_VERIFIER);
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
contract UnitConstructor is UnitPrivacyPoolSimple {
  /**
   * @notice Test for the constructor given valid addresses
   * @dev Assumes all addresses are non-zero and valid
   */
  function test_ConstructorGivenValidAddresses(
    address _entrypoint,
    address _withdrawalVerifier,
    address _ragequitVerifier
  ) external {
    vm.assume(_entrypoint != address(0) && _withdrawalVerifier != address(0) && _ragequitVerifier != address(0));

    _pool = new SimplePoolForTest(_entrypoint, _withdrawalVerifier, _ragequitVerifier);
    _scope = uint256(keccak256(abi.encodePacked(address(_pool), block.chainid, _ASSET))) % Constants.SNARK_SCALAR_FIELD;
    assertEq(address(_pool.ENTRYPOINT()), _entrypoint, 'Entrypoint address should match constructor input');
    assertEq(
      address(_pool.WITHDRAWAL_VERIFIER()),
      _withdrawalVerifier,
      'Withdrawal verifier address should match constructor input'
    );
    assertEq(
      address(_pool.RAGEQUIT_VERIFIER()), _ragequitVerifier, 'Ragequit verifier address should match constructor input'
    );
    assertEq(_pool.ASSET(), _ASSET, 'Asset address should match constructor input');
    assertEq(_pool.SCOPE(), _scope, 'Scope should be computed correctly');
  }

  /**
   * @notice Test for the constructor when any address is zero
   * @dev Assumes all addresses are non-zero and valid
   */
  function test_ConstructorWhenAnyAddressIsZero(
    address _entrypoint,
    address _withdrawalVerifier,
    address _ragequitVerifier
  ) external {
    vm.expectRevert(IState.ZeroAddress.selector);
    new SimplePoolForTest(address(0), _withdrawalVerifier, _ragequitVerifier);
    vm.expectRevert(IState.ZeroAddress.selector);
    new SimplePoolForTest(_entrypoint, address(0), _ragequitVerifier);
    vm.expectRevert(IState.ZeroAddress.selector);
    new SimplePoolForTest(_entrypoint, _withdrawalVerifier, address(0));
    vm.expectRevert(IState.ZeroAddress.selector);
    new SimplePoolForTest(address(0), _withdrawalVerifier, _ragequitVerifier);
  }
}

contract UnitPull is UnitPrivacyPoolSimple {
  /**
   * @notice Test that the pool correctly pulls ETH from sender
   */
  function test_Pull(address _sender, uint256 _amount) external {
    // Ensure sender is not the pool itself to avoid self-transfers
    vm.assume(_sender != address(_pool));

    // Setup initial state and record balances
    deal(_sender, _amount);
    uint256 _senderInitialBalance = _sender.balance;
    uint256 _poolInitialBalance = address(_pool).balance;

    // Execute pull operation as sender
    vm.prank(_sender);
    _pool.pull{value: _amount}(_sender, _amount);

    // Verify balances are updated correctly
    assertEq(address(_pool).balance, _poolInitialBalance + _amount, 'Pool balance should increase by pull amount');
    assertEq(_sender.balance, _senderInitialBalance - _amount, 'Sender balance should decrease by pull amount');
  }

  /**
   * @notice Test that pull reverts when msg.value is less than amount
   */
  function test_PullWhenAmountIsGreaterThanMsgValue(address _sender, uint256 _amount, uint256 _msgValue) external {
    // Setup test with amount greater than msg.value
    vm.assume(_amount > 0);
    deal(_sender, _amount);
    _msgValue = bound(_msgValue, 0, _amount - 1);

    // Expect revert when msg.value is insufficient
    vm.expectRevert(IPrivacyPoolSimple.InsufficientValue.selector);
    vm.prank(_sender);
    _pool.pull{value: _msgValue}(_sender, _amount);
  }
}

contract UnitPush is UnitPrivacyPoolSimple {
  /**
   * @notice Test that the pool correctly pushes ETH to recipient
   */
  function test_Push(address _recipient, uint256 _amount) external {
    // Setup test with valid amount and non-precompile recipient
    // Bounding to avoid balance overflow
    _amount = _bound(_amount, 0, type(uint128).max);
    vm.assume(_recipient > address(10) && _recipient.code.length == 0);

    // Setup initial state and record balances
    deal(address(_pool), _amount);
    uint256 _poolInitialBalance = address(_pool).balance;
    uint256 _recipientInitialBalance = _recipient.balance;

    // Execute push operation as recipient
    vm.prank(_recipient);
    _pool.push(_recipient, _amount);

    // Verify balances are updated correctly
    assertEq(address(_pool).balance, _poolInitialBalance - _amount, 'Pool balance should decrease by push amount');
    assertEq(_recipient.balance, _recipientInitialBalance + _amount, 'Recipient balance should increase by push amount');
  }

  /**
   * @notice Test that push reverts when ETH transfer to recipient fails
   */
  function test_PushWhenTransferFails(address _recipient, uint256 _amount) external {
    // Setup test with valid amount and recipient
    vm.assume(_recipient > address(10));
    vm.assume(_recipient != address(_pool));
    vm.assume(_amount > 0);

    // Deploy contract that reverts on ETH receive
    bytes memory revertingCode = hex'60006000fd';
    vm.etch(_recipient, revertingCode);

    // Expect revert when ETH transfer fails
    vm.expectRevert(IPrivacyPoolSimple.FailedToSendNativeAsset.selector);
    vm.prank(_recipient);
    _pool.push(_recipient, _amount);
  }
}
