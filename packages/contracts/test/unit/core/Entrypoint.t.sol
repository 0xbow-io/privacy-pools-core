// SPDX-License-Identifier: Apache-2.0
pragma solidity 0.8.28;

import {IAccessControl} from '@oz/access/IAccessControl.sol';

import {Initializable} from '@oz/proxy/utils/Initializable.sol';
import {ERC20, IERC20} from '@oz/token/ERC20/ERC20.sol';
import {UnsafeUpgrades} from '@upgrades/Upgrades.sol';

import {ReentrancyGuardUpgradeable} from '@oz-upgradeable/utils/ReentrancyGuardUpgradeable.sol';
import {IERC1967} from '@oz/interfaces/IERC1967.sol';

import {IPrivacyPool} from 'contracts/PrivacyPool.sol';

import {Constants} from 'contracts/lib/Constants.sol';
import {ProofLib} from 'contracts/lib/ProofLib.sol';
import {IState} from 'interfaces/IState.sol';

import {Entrypoint, IEntrypoint} from 'contracts/Entrypoint.sol';
import {Test} from 'forge-std/Test.sol';

struct PoolParams {
  address pool;
  address asset;
  uint256 minDeposit;
  uint256 vettingFeeBPS;
  uint256 maxRelayFeeBPS;
}

struct RelayParams {
  address caller;
  address processooor;
  address recipient;
  address feeRecipient;
  uint256 feeBPS;
  uint256 maxRelayFeeBPS;
  uint256 scope;
  address asset;
  uint256 amount;
  address pool;
}

contract PrivacyPoolERC20ForTest {
  address internal _asset;

  function withdraw(IPrivacyPool.Withdrawal calldata, ProofLib.WithdrawProof calldata _proof) external {
    uint256 _amount = _proof.pubSignals[2];
    IERC20(_asset).transfer(msg.sender, _amount);
  }

  function setAsset(address __asset) external {
    _asset = __asset;
  }
}

contract PrivacyPoolETHForTest {
  error ETHTransferFailed();

  function withdraw(IPrivacyPool.Withdrawal calldata, ProofLib.WithdrawProof calldata _proof) external {
    uint256 _amount = _proof.pubSignals[2];
    (bool success,) = msg.sender.call{value: _amount}('');
    if (!success) revert ETHTransferFailed();
  }
}

contract FaultyPrivacyPool is Test {
  function withdraw(IPrivacyPool.Withdrawal calldata, ProofLib.WithdrawProof calldata) external {
    // remove half of the eth balance from msg.sender
    deal(msg.sender, msg.sender.balance / 2);
  }
}

contract ERC20forTest is ERC20 {
  constructor(string memory _name, string memory _symbol) ERC20(_name, _symbol) {}
}

/**
 * @notice Mock contract for testing
 */
contract EntrypointForTest is Entrypoint {
  function mockPool(PoolParams memory _params) external {
    IEntrypoint.AssetConfig storage _config = assetConfig[IERC20(_params.asset)];
    _config.pool = IPrivacyPool(_params.pool);
    _config.minimumDepositAmount = _params.minDeposit;
    _config.vettingFeeBPS = _params.vettingFeeBPS;
    _config.maxRelayFeeBPS = _params.maxRelayFeeBPS;
  }

  function mockScopeToPool(uint256 _scope, address _pool) external {
    scopeToPool[_scope] = IPrivacyPool(_pool);
  }

  function mockAssociationSets(uint256 _root, string memory _ipfsCID) external {
    associationSets.push(IEntrypoint.AssociationSetData({root: _root, ipfsCID: _ipfsCID, timestamp: block.timestamp}));
  }

  function mockMaxRelayFeeBPS(IERC20 _asset, uint256 _maxRelayFeeBPS) external {
    assetConfig[_asset].maxRelayFeeBPS = _maxRelayFeeBPS;
  }

  function mockUsedPrecommitment(uint256 _precommitment) external {
    usedPrecommitments[_precommitment] = true;
  }

  bytes32 public constant OWNER_ROLE = keccak256('OWNER_ROLE');

  bytes32 public constant ASP_POSTMAN = keccak256('ASP_POSTMAN');
}

/**
 * @notice Base test contract for Entrypoint
 */
contract UnitEntrypoint is Test {
  EntrypointForTest internal _entrypoint;
  address internal _impl;

  address internal immutable _OWNER = makeAddr('owner');
  address internal immutable _POSTMAN = makeAddr('postman');
  address internal constant _ETH = 0xEeeeeEeeeEeEeeEeEeEeeEEEeeeeEeeeeeeeEEeE;

  /*///////////////////////////////////////////////////////////////
                           MODIFIERS 
  //////////////////////////////////////////////////////////////*/

  modifier givenCallerHasPostmanRole() {
    vm.startPrank(_POSTMAN);
    _;
    vm.stopPrank();
  }

  modifier givenCallerHasOwnerRole() {
    vm.startPrank(_OWNER);
    _;
    vm.stopPrank();
  }

  modifier givenPoolExists(PoolParams memory _params) {
    _assumeFuzzable(_params.pool);
    _assumeFuzzable(_params.asset);
    _params.vettingFeeBPS = bound(_params.vettingFeeBPS, 0, 10_000 - 1);
    _params.maxRelayFeeBPS = bound(_params.maxRelayFeeBPS, 0, 10_000 - 1);
    _params.minDeposit = bound(_params.minDeposit, 1, 100);
    _entrypoint.mockPool(_params);
    _;
  }

  /*///////////////////////////////////////////////////////////////
                           SETUP 
  //////////////////////////////////////////////////////////////*/

  function setUp() public {
    _impl = address(new EntrypointForTest());

    _entrypoint = EntrypointForTest(
      payable(UnsafeUpgrades.deployUUPSProxy(_impl, abi.encodeCall(Entrypoint.initialize, (_OWNER, _POSTMAN))))
    );
  }

  /*///////////////////////////////////////////////////////////////
                           HELPERS 
  //////////////////////////////////////////////////////////////*/

  function _mockAndExpect(address _contract, bytes memory _call, bytes memory _return) internal {
    vm.mockCall(_contract, _call, _return);
    vm.expectCall(_contract, _call);
  }

  function _mockAndExpect(address _contract, uint256 _value, bytes memory _call, bytes memory _return) internal {
    vm.mockCall(_contract, _value, _call, _return);
    vm.expectCall(_contract, _value, _call);
  }

  function _deductFee(uint256 _amount, uint256 _feeBPS) internal pure returns (uint256 _afterFees) {
    _afterFees = _amount - (_amount * _feeBPS) / 10_000;
  }

  function _assumeFuzzable(address _address) internal view {
    assumeNotForgeAddress(_address);
    assumeNotZeroAddress(_address);
    assumeNotPrecompile(_address);
    vm.assume(_address != address(_entrypoint));
    vm.assume(_address != _impl);
    vm.assume(_address != address(10));
  }
}

/**
 * @notice Unit tests for Entrypoint constructor and initializer
 */
contract UnitConstructor is UnitEntrypoint {
  /**
   * @notice Test that the Entrypoint is initialized with version 1
   */
  function test_ConstructorWhenDeployed() external view {
    bytes32 _initializableStorageSlot = 0xf0c57e16840df040f15088dc2f81fe391c3923bec73e23a9662efc9c229c6a00;
    bytes32 _data = vm.load(address(_entrypoint), _initializableStorageSlot);
    uint64 _initialized = uint64(uint256(_data)); // First 64 bits contain _initialized
    assertEq(_initialized, 1, 'Entrypoint should be initialized with value 1');
  }

  /**
   * @notice Test that the Entrypoint correctly assigns OWNER_ROLE and ASP_POSTMAN roles
   */
  function test_InitializeGivenValidOwnerAndAdmin() external view {
    assertEq(_entrypoint.hasRole(_entrypoint.OWNER_ROLE(), _OWNER), true, 'Owner should have OWNER_ROLE');
    assertEq(_entrypoint.hasRole(_entrypoint.ASP_POSTMAN(), _POSTMAN), true, 'Postman should have ASP_POSTMAN role');
  }

  /**
   * @notice Test that the Entrypoint reverts when already initialized
   */
  function test_InitializeWhenAlreadyInitialized() external {
    vm.expectRevert(abi.encodeWithSelector(Initializable.InvalidInitialization.selector));
    _entrypoint.initialize(_OWNER, _POSTMAN);
  }
}

/**
 * @notice Unit tests for Entrypoint root update functionality
 */
contract UnitRootUpdate is UnitEntrypoint {
  /**
   * @notice Test that the Entrypoint correctly updates root and emits event
   */
  function test_UpdateRootGivenValidRootAndIpfsHash(
    uint256 _root,
    string memory _ipfsCID,
    uint256 _timestamp
  ) external givenCallerHasPostmanRole {
    vm.assume(_root != 0);
    uint256 _length = bytes(_ipfsCID).length;
    vm.assume(_length >= 32 && _length <= 64);

    _timestamp = bound(_timestamp, 1, type(uint64).max - 1);

    vm.warp(_timestamp);

    vm.expectEmit(address(_entrypoint));
    emit IEntrypoint.RootUpdated(_root, _ipfsCID, _timestamp);

    uint256 _index = _entrypoint.updateRoot(_root, _ipfsCID);
    (uint256 _retrievedRoot, string memory _retrievedIpfsCID, uint256 _retrievedTimestamp) =
      _entrypoint.associationSets(0);
    assertEq(_retrievedRoot, _root, 'Retrieved root should match input root');
    assertEq(_retrievedIpfsCID, _ipfsCID, 'Retrieved IPFS CID should match input CID');
    assertEq(_retrievedTimestamp, _timestamp, 'Retrieved timestamp should match block timestamp');
    assertEq(_index, 0, 'First root update should have index 0');

    vm.expectEmit(address(_entrypoint));
    emit IEntrypoint.RootUpdated(_root, 'ipfs_cid_ipfs_cid_ipfs_cid_ipfs_cid_ipfs_cid_ipfs_cid', _timestamp);

    _index = _entrypoint.updateRoot(_root, 'ipfs_cid_ipfs_cid_ipfs_cid_ipfs_cid_ipfs_cid_ipfs_cid');
    assertEq(_index, 1, 'Second root update should have index 1');
  }

  function test_UpdateRootWhenRootIsZero(string memory _ipfsCID) external givenCallerHasPostmanRole {
    uint256 _length = bytes(_ipfsCID).length;
    vm.assume(_length >= 32 && _length <= 64);

    vm.expectRevert(abi.encodeWithSelector(IEntrypoint.EmptyRoot.selector));
    _entrypoint.updateRoot(0, _ipfsCID);
  }

  /**
   * @notice Test that the Entrypoint reverts when the IPFS hash is zero
   */
  function test_UpdateRootWhenIpfsCIDHasInvalidLength(uint256 _root) external givenCallerHasPostmanRole {
    vm.assume(_root != 0);
    string memory _shortCID = 'This is a 31-byte string exampl';
    assertEq(bytes(_shortCID).length, 31);

    vm.expectRevert(abi.encodeWithSelector(IEntrypoint.InvalidIPFSCIDLength.selector));
    _entrypoint.updateRoot(_root, _shortCID);

    string memory _longCID = 'This string contains exactly sixty-five bytes for your testing ne';
    assertEq(bytes(_longCID).length, 65);

    vm.expectRevert(abi.encodeWithSelector(IEntrypoint.InvalidIPFSCIDLength.selector));
    _entrypoint.updateRoot(_root, _longCID);
  }

  /**
   * @notice Test that the Entrypoint reverts when the caller lacks the postman role
   */
  function test_UpdateRootWhenCallerLacksPostmanRole(address _caller, uint256 _root, string memory _ipfsCID) external {
    vm.assume(_caller != _POSTMAN);
    uint256 _length = bytes(_ipfsCID).length;
    vm.assume(_length >= 32 && _length <= 64);

    vm.expectRevert(
      abi.encodeWithSelector(
        IAccessControl.AccessControlUnauthorizedAccount.selector, _caller, _entrypoint.ASP_POSTMAN()
      )
    );
    vm.prank(_caller);
    _entrypoint.updateRoot(_root, _ipfsCID);
  }
}

/**
 * @notice Unit tests for Entrypoint deposit functionality
 */
contract UnitDeposit is UnitEntrypoint {
  function test_DepositETHGivenValueMeetsMinimum(
    address _depositor,
    uint256 _amount,
    uint256 _precommitment,
    uint256 _commitment,
    PoolParams memory _params
  )
    external
    givenPoolExists(
      PoolParams({
        pool: _params.pool,
        asset: _ETH,
        minDeposit: _params.minDeposit,
        vettingFeeBPS: _params.vettingFeeBPS,
        maxRelayFeeBPS: 500 // Default to 5%
      })
    )
  {
    _assumeFuzzable(_depositor);
    vm.assume(_depositor != address(_entrypoint));

    (IPrivacyPool _pool, uint256 _minDeposit, uint256 _vettingFeeBPS,) = _entrypoint.assetConfig(IERC20(_ETH));
    // Can't be too big, otherwise overflows
    _amount = bound(_amount, _minDeposit, 1e30);
    uint256 _amountAfterFees = _deductFee(_amount, _vettingFeeBPS);
    deal(_depositor, _amount);

    _mockAndExpect(
      address(_pool),
      _amountAfterFees,
      abi.encodeWithSignature('deposit(address,uint256,uint256)', _depositor, _amountAfterFees, _precommitment),
      abi.encode(_commitment)
    );

    uint256 _depositorBalanceBefore = _depositor.balance;

    vm.expectEmit(address(_entrypoint));
    emit IEntrypoint.Deposited(_depositor, IPrivacyPool(_params.pool), _commitment, _amountAfterFees);

    vm.prank(_depositor);
    _entrypoint.deposit{value: _amount}(_precommitment);

    assertEq(
      _depositor.balance, _depositorBalanceBefore - _amount, 'Depositor balance should decrease by deposit amount'
    );
    assertEq(address(_entrypoint).balance, _amount, 'Entrypoint should receive the deposit amount');
  }

  /**
   * @notice Test that the Entrypoint reverts when the deposit amount is below the minimum deposit amount
   */
  function test_DepositETHWhenValueBelowMinimum(
    address _depositor,
    uint256 _amount,
    uint256 _precommitment,
    PoolParams memory _params
  )
    external
    givenPoolExists(
      PoolParams({
        pool: _params.pool,
        asset: _ETH,
        minDeposit: _params.minDeposit,
        vettingFeeBPS: _params.vettingFeeBPS,
        maxRelayFeeBPS: 500 // Default to 5%
      })
    )
  {
    vm.assume(_depositor != address(0));

    (, uint256 _minDeposit,,) = _entrypoint.assetConfig(IERC20(_ETH));
    _amount = bound(_amount, 0, _minDeposit - 1);
    vm.deal(_depositor, _amount);

    vm.expectRevert(abi.encodeWithSelector(IEntrypoint.MinimumDepositAmount.selector));
    vm.prank(_depositor);
    _entrypoint.deposit{value: _amount}(_precommitment);
  }

  function test_DepositETHWhenPoolNotFound(address _depositor, uint256 _amount, uint256 _precommitment) external {
    vm.assume(_depositor != address(0));
    vm.deal(_depositor, _amount);
    vm.expectRevert(abi.encodeWithSelector(IEntrypoint.PoolNotFound.selector));
    vm.prank(_depositor);
    _entrypoint.deposit{value: _amount}(_precommitment);
  }

  /**
   * @notice Test that the Entrypoint deposits ERC20 tokens and emits an event
   */
  function test_DepositERC20GivenValueMeetsMinimum(
    address _depositor,
    uint256 _amount,
    uint256 _precommitment,
    uint256 _commitment,
    PoolParams memory _params
  ) external givenPoolExists(_params) {
    _assumeFuzzable(_depositor);
    vm.assume(_depositor != address(0));

    // Can't be too big, otherwise overflows
    _amount = bound(_amount, _params.minDeposit, 1e30);
    uint256 _amountAfterFees = _deductFee(_amount, _params.vettingFeeBPS);

    _mockAndExpect(
      _params.asset,
      abi.encodeWithSignature('transferFrom(address,address,uint256)', _depositor, address(_entrypoint), _amount),
      abi.encode(true)
    );

    _mockAndExpect(
      _params.pool,
      abi.encodeWithSignature('deposit(address,uint256,uint256)', _depositor, _amountAfterFees, _precommitment),
      abi.encode(_commitment)
    );

    vm.expectEmit(address(_entrypoint));
    emit IEntrypoint.Deposited(_depositor, IPrivacyPool(_params.pool), _commitment, _amountAfterFees);

    vm.prank(_depositor);
    _entrypoint.deposit(IERC20(_params.asset), _amount, _precommitment);
  }

  function test_DepositERC20WhenValueBelowMinimum(
    address _depositor,
    uint256 _amount,
    uint256 _precommitment,
    PoolParams memory _params
  ) external givenPoolExists(_params) {
    vm.assume(_depositor != address(0));

    (, uint256 _minDeposit,,) = _entrypoint.assetConfig(IERC20(_params.asset));
    _amount = bound(_amount, 0, _minDeposit - 1);

    _mockAndExpect(
      _params.asset,
      abi.encodeWithSignature('transferFrom(address,address,uint256)', _depositor, address(_entrypoint), _amount),
      abi.encode(true)
    );

    vm.expectRevert(abi.encodeWithSelector(IEntrypoint.MinimumDepositAmount.selector));
    vm.prank(_depositor);
    _entrypoint.deposit(IERC20(_params.asset), _amount, _precommitment);
  }

  /**
   * @notice Test that the Entrypoint reverts when the pool is not found
   */
  function test_DepositERC20WhenPoolNotFound(
    address _depositor,
    address _asset,
    uint256 _amount,
    uint256 _precommitment
  ) external {
    _assumeFuzzable(_asset);
    vm.assume(_depositor != address(0));
    vm.assume(_asset != _ETH);

    _mockAndExpect(
      _asset,
      abi.encodeWithSignature('transferFrom(address,address,uint256)', _depositor, address(_entrypoint), _amount),
      abi.encode(true)
    );

    vm.expectRevert(abi.encodeWithSelector(IEntrypoint.PoolNotFound.selector));
    vm.prank(_depositor);
    _entrypoint.deposit(IERC20(_asset), _amount, _precommitment);
  }

  /**
   * @notice Test that the Entrypoint reverts when the precommitment has already been used for ETH deposits
   */
  function test_DepositETHWhenPrecommitmentAlreadyUsed(
    address _depositor,
    uint256 _amount,
    uint256 _precommitment,
    PoolParams memory _params
  )
    external
    givenPoolExists(
      PoolParams({
        pool: _params.pool,
        asset: _ETH,
        minDeposit: _params.minDeposit,
        vettingFeeBPS: _params.vettingFeeBPS,
        maxRelayFeeBPS: 500 // Default to 5%
      })
    )
  {
    _assumeFuzzable(_depositor);
    vm.assume(_depositor != address(_entrypoint));

    (, uint256 _minDeposit,,) = _entrypoint.assetConfig(IERC20(_ETH));
    _amount = bound(_amount, _minDeposit, 1e30);
    deal(_depositor, _amount);

    // Mark the precommitment as used
    _entrypoint.mockUsedPrecommitment(_precommitment);

    vm.expectRevert(abi.encodeWithSelector(IEntrypoint.PrecommitmentAlreadyUsed.selector));
    vm.prank(_depositor);
    _entrypoint.deposit{value: _amount}(_precommitment);
  }

  /**
   * @notice Test that the Entrypoint reverts when the precommitment has already been used for ERC20 deposits
   */
  function test_DepositERC20WhenPrecommitmentAlreadyUsed(
    address _depositor,
    uint256 _amount,
    uint256 _precommitment,
    PoolParams memory _params
  ) external givenPoolExists(_params) {
    vm.assume(_depositor != address(0));

    _amount = bound(_amount, _params.minDeposit, 1e30);

    // Mark the precommitment as used
    _entrypoint.mockUsedPrecommitment(_precommitment);

    _mockAndExpect(
      _params.asset,
      abi.encodeWithSignature('transferFrom(address,address,uint256)', _depositor, address(_entrypoint), _amount),
      abi.encode(true)
    );

    vm.expectRevert(abi.encodeWithSelector(IEntrypoint.PrecommitmentAlreadyUsed.selector));
    vm.prank(_depositor);
    _entrypoint.deposit(IERC20(_params.asset), _amount, _precommitment);
  }
}

/**
 * @notice Unit tests for Entrypoint relay functionality
 */
contract UnitRelay is UnitEntrypoint {
  using ProofLib for ProofLib.WithdrawProof;

  receive() external payable {}

  /**
   * @notice Test that the Entrypoint correctly relays ERC20 withdrawal and distributes fees
   */
  function test_RelayERC20GivenValidWithdrawalAndProof(
    RelayParams memory _params,
    ProofLib.WithdrawProof memory _proof
  ) external {
    // Set up test environment with mock ERC20 token and privacy pool
    _params.asset = address(new ERC20forTest('Test', 'TEST'));
    _params.pool = address(new PrivacyPoolERC20ForTest());

    // Ensure recipient and fee recipient are valid and different addresses
    _assumeFuzzable(_params.recipient);
    _assumeFuzzable(_params.feeRecipient);

    vm.assume(_params.recipient != _params.feeRecipient);

    // Configure withdrawal parameters within valid bounds
    _params.maxRelayFeeBPS = bound(_params.maxRelayFeeBPS, 0, 10_000);
    _params.feeBPS = bound(_params.feeBPS, 0, _params.maxRelayFeeBPS);
    _params.amount = bound(_params.amount, 1, 1e30);
    _proof.pubSignals[2] = _params.amount;

    // Construct withdrawal data with fee distribution details
    bytes memory _data = abi.encode(
      IEntrypoint.RelayData({
        recipient: _params.recipient,
        feeRecipient: _params.feeRecipient,
        relayFeeBPS: _params.feeBPS
      })
    );
    IPrivacyPool.Withdrawal memory _withdrawal =
      IPrivacyPool.Withdrawal({processooor: address(_entrypoint), data: _data});

    // Set up pool and mock necessary interactions
    _entrypoint.mockScopeToPool(_params.scope, _params.pool);
    _entrypoint.mockMaxRelayFeeBPS(IERC20(_params.asset), _params.maxRelayFeeBPS);
    uint256 _amountAfterFees = _deductFee(_params.amount, _params.feeBPS);
    uint256 _feeAmount = _params.amount - _amountAfterFees;
    _mockAndExpect(_params.pool, abi.encodeWithSelector(IState.ASSET.selector), abi.encode(_params.asset));

    // Fund the pool with test tokens
    deal(_params.asset, _params.pool, _params.amount);
    PrivacyPoolERC20ForTest(_params.pool).setAsset(_params.asset);

    // Record initial balances for verification
    uint256 _poolBalanceBefore = IERC20(_params.asset).balanceOf(_params.pool);
    uint256 _entrypointBalanceBefore = IERC20(_params.asset).balanceOf(address(_entrypoint));
    uint256 _recipientBalanceBefore = IERC20(_params.asset).balanceOf(_params.recipient);
    uint256 _feeRecipientBalanceBefore = IERC20(_params.asset).balanceOf(_params.feeRecipient);

    // Expect the withdrawal relay event to be emitted
    vm.expectEmit(address(_entrypoint));
    emit IEntrypoint.WithdrawalRelayed(
      _params.caller, _params.recipient, IERC20(_params.asset), _params.amount, _feeAmount
    );

    // Execute the relay operation
    vm.prank(_params.caller);
    _entrypoint.relay(_withdrawal, _proof, _params.scope);

    // Verify final balances reflect correct token distribution
    assertEq(
      IERC20(_params.asset).balanceOf(_params.pool),
      _poolBalanceBefore - _params.amount,
      'Pool balance should decrease by withdrawal amount'
    );
    assertEq(
      IERC20(_params.asset).balanceOf(address(_entrypoint)),
      _entrypointBalanceBefore,
      'Entrypoint balance should remain unchanged'
    );
    assertEq(
      IERC20(_params.asset).balanceOf(_params.recipient),
      _recipientBalanceBefore + _amountAfterFees,
      'Recipient should receive amount after fees'
    );
    assertEq(
      IERC20(_params.asset).balanceOf(_params.feeRecipient),
      _feeRecipientBalanceBefore + _feeAmount,
      'Fee recipient should receive fee amount'
    );
  }

  /**
   * @notice Test that the Entrypoint correctly relays ETH withdrawal and distributes fees
   */
  function test_RelayETHGivenValidWithdrawalAndProof(
    RelayParams memory _params,
    ProofLib.WithdrawProof memory _proof
  ) external {
    // Setup test with valid recipients and amounts
    _assumeFuzzable(_params.recipient);
    _assumeFuzzable(_params.feeRecipient);

    vm.assume(_params.recipient != _params.feeRecipient);
    vm.assume(_params.amount != 0);

    // Configure ETH pool and parameters
    _params.asset = _ETH;
    _params.pool = address(new PrivacyPoolETHForTest());

    // Set up withdrawal parameters within valid bounds
    _params.maxRelayFeeBPS = bound(_params.maxRelayFeeBPS, 0, 10_000);
    _params.feeBPS = bound(_params.feeBPS, 0, _params.maxRelayFeeBPS);
    _params.amount = bound(_params.amount, 1, 1e30);
    _proof.pubSignals[2] = _params.amount;

    // Construct withdrawal data with fee distribution
    bytes memory _data = abi.encode(
      IEntrypoint.RelayData({
        recipient: _params.recipient,
        feeRecipient: _params.feeRecipient,
        relayFeeBPS: _params.feeBPS
      })
    );
    IPrivacyPool.Withdrawal memory _withdrawal =
      IPrivacyPool.Withdrawal({processooor: address(_entrypoint), data: _data});

    // Setup pool and mock interactions
    _entrypoint.mockScopeToPool(_params.scope, _params.pool);
    // Set up pool as only ETH sender
    _entrypoint.mockPool(
      PoolParams({
        pool: _params.pool,
        asset: _ETH,
        minDeposit: 0,
        vettingFeeBPS: 0,
        maxRelayFeeBPS: _params.maxRelayFeeBPS
      })
    );
    uint256 _amountAfterFees = _deductFee(_params.amount, _params.feeBPS);
    uint256 _feeAmount = _params.amount - _amountAfterFees;
    _mockAndExpect(_params.pool, abi.encodeWithSelector(IState.ASSET.selector), abi.encode(_params.asset));
    deal(_params.pool, _params.amount);

    // Record initial balances for verification
    uint256 _poolBalanceBefore = address(_params.pool).balance;
    uint256 _entrypointBalanceBefore = address(_entrypoint).balance;
    uint256 _recipientBalanceBefore = address(_params.recipient).balance;
    uint256 _feeRecipientBalanceBefore = address(_params.feeRecipient).balance;

    // Expect withdrawal relay event
    vm.expectEmit(address(_entrypoint));
    emit IEntrypoint.WithdrawalRelayed(
      _params.caller, _params.recipient, IERC20(_params.asset), _params.amount, _feeAmount
    );

    // Execute relay operation
    vm.prank(_params.caller);
    _entrypoint.relay(_withdrawal, _proof, _params.scope);

    // Verify final balances reflect correct ETH distribution
    assertEq(
      address(_params.pool).balance, _poolBalanceBefore - _params.amount, 'Pool balance should decrease by push amount'
    );
    assertEq(address(_entrypoint).balance, _entrypointBalanceBefore, 'Entrypoint balance should remain unchanged');
    assertEq(
      address(_params.recipient).balance,
      _recipientBalanceBefore + _amountAfterFees,
      'Recipient should receive amount after fees'
    );
    assertEq(
      address(_params.feeRecipient).balance,
      _feeRecipientBalanceBefore + _feeAmount,
      'Fee recipient should receive fee amount'
    );
  }

  /**
   * @notice Test that the Entrypoint reverts when the pool state is invalid
   */
  function test_RelayInvalidPoolState(RelayParams memory _params, ProofLib.WithdrawProof memory _proof) external {
    // Setup test with valid recipients and amount
    _assumeFuzzable(_params.recipient);
    _assumeFuzzable(_params.feeRecipient);
    vm.assume(_params.amount != 0);

    // Configure ETH pool with faulty behavior
    _params.asset = _ETH;
    _params.pool = address(new FaultyPrivacyPool());

    // Set up withdrawal parameters within valid bounds
    _params.maxRelayFeeBPS = bound(_params.maxRelayFeeBPS, 0, 10_000);
    _params.feeBPS = bound(_params.feeBPS, 0, _params.maxRelayFeeBPS);
    _params.amount = bound(_params.amount, 1, 1e30);
    _proof.pubSignals[2] = _params.amount;

    _entrypoint.mockMaxRelayFeeBPS(IERC20(_params.asset), _params.maxRelayFeeBPS);

    // Construct withdrawal data with fee distribution
    bytes memory _data = abi.encode(
      IEntrypoint.RelayData({
        recipient: _params.recipient,
        feeRecipient: _params.feeRecipient,
        relayFeeBPS: _params.feeBPS
      })
    );
    IPrivacyPool.Withdrawal memory _withdrawal =
      IPrivacyPool.Withdrawal({processooor: address(_entrypoint), data: _data});

    // Fund entrypoint with more than needed to test faulty pool behavior
    deal(address(_entrypoint), _params.amount * 2);
    _entrypoint.mockScopeToPool(_params.scope, _params.pool);
    _mockAndExpect(_params.pool, abi.encodeWithSelector(IState.ASSET.selector), abi.encode(_params.asset));

    // Expect revert due to invalid pool state
    vm.expectRevert(abi.encodeWithSelector(IEntrypoint.InvalidPoolState.selector));
    vm.prank(_params.caller);
    _entrypoint.relay(_withdrawal, _proof, _params.scope);
  }

  /**
   * @notice Test that the Entrypoint reverts when the withdrawal amount is zero
   */
  function test_RelayWhenWithdrawalAmountIsZero(
    IPrivacyPool.Withdrawal memory _withdrawal,
    ProofLib.WithdrawProof memory _proof,
    uint256 _scope
  ) external {
    // Set withdrawal amount to zero
    _proof.pubSignals[2] = 0;
    _withdrawal.processooor = address(_entrypoint);

    // Expect revert due to invalid withdrawal amount
    vm.expectRevert(abi.encodeWithSelector(IEntrypoint.InvalidWithdrawalAmount.selector));
    vm.prank(_withdrawal.processooor);
    _entrypoint.relay(_withdrawal, _proof, _scope);
  }

  /**
   * @notice Test that the Entrypoint reverts when the pool is not found
   */
  function test_RelayWhenPoolNotFound(
    address _caller,
    IPrivacyPool.Withdrawal memory _withdrawal,
    ProofLib.WithdrawProof memory _proof,
    uint256 _scope
  ) external {
    // Ensure non-zero withdrawal amount
    vm.assume(_proof.pubSignals[2] != 0);
    _withdrawal.processooor = address(_entrypoint);

    // Expect revert due to pool not found
    vm.expectRevert(abi.encodeWithSelector(IEntrypoint.PoolNotFound.selector));
    vm.prank(_caller);
    _entrypoint.relay(_withdrawal, _proof, _scope);
  }

  /**
   * @notice Test that the Entrypoint reverts when the processooor is not valid
   */
  function test_RelayWhenInvalidProcessooor(
    address _processooor,
    RelayParams memory _params,
    ProofLib.WithdrawProof memory _proof
  ) external {
    // Setup test with valid parameters but invalid processooor
    _assumeFuzzable(_params.asset);
    _assumeFuzzable(_params.pool);
    vm.assume(_processooor != address(_entrypoint));
    vm.assume(_params.amount != 0);

    // Configure withdrawal parameters
    _params.feeBPS = bound(_params.feeBPS, 0, 10_000);
    _params.amount = bound(_params.amount, 1, 1e30);
    _proof.pubSignals[2] = _params.amount;

    // Construct withdrawal data with invalid processooor
    bytes memory _data = abi.encode(
      IEntrypoint.RelayData({
        recipient: _params.recipient,
        feeRecipient: _params.feeRecipient,
        relayFeeBPS: _params.feeBPS
      })
    );
    IPrivacyPool.Withdrawal memory _withdrawal = IPrivacyPool.Withdrawal({processooor: _processooor, data: _data});

    // Expect revert due to invalid processooor
    vm.expectRevert(abi.encodeWithSelector(IEntrypoint.InvalidProcessooor.selector));
    vm.prank(_params.caller);
    _entrypoint.relay(_withdrawal, _proof, _params.scope);
  }

  /**
   * @notice Test that the Entrypoint reverts when the recipient is address zero for ETH relay
   */
  function test_RelayWhenRecipientIsZeroForETH(
    RelayParams memory _params,
    ProofLib.WithdrawProof memory _proof
  ) external {
    // Setup test with valid parameters but zero recipient
    _assumeFuzzable(_params.feeRecipient);
    vm.assume(_params.amount != 0);
    _params.asset = _ETH;
    _params.pool = address(new PrivacyPoolETHForTest());
    _params.maxRelayFeeBPS = bound(_params.maxRelayFeeBPS, 0, 10_000);
    _params.feeBPS = bound(_params.feeBPS, 0, _params.maxRelayFeeBPS);
    _params.amount = bound(_params.amount, 1, 1e30);
    _proof.pubSignals[2] = _params.amount;

    // Construct withdrawal data with zero recipient
    bytes memory _data = abi.encode(
      IEntrypoint.RelayData({
        recipient: address(0), // Zero address recipient
        feeRecipient: _params.feeRecipient,
        relayFeeBPS: _params.feeBPS
      })
    );
    IPrivacyPool.Withdrawal memory _withdrawal =
      IPrivacyPool.Withdrawal({processooor: address(_entrypoint), data: _data});

    // Setup pool and mock interactions
    _entrypoint.mockScopeToPool(_params.scope, _params.pool);
    _entrypoint.mockPool(
      PoolParams({
        pool: _params.pool,
        asset: _ETH,
        minDeposit: 0,
        vettingFeeBPS: 0,
        maxRelayFeeBPS: _params.maxRelayFeeBPS
      })
    );
    _mockAndExpect(_params.pool, abi.encodeWithSelector(IState.ASSET.selector), abi.encode(_params.asset));
    deal(_params.pool, _params.amount);

    // Expect revert due to zero address recipient
    vm.expectRevert(IEntrypoint.ZeroAddress.selector);
    vm.prank(_params.caller);
    _entrypoint.relay(_withdrawal, _proof, _params.scope);
  }

  /**
   * @notice Test that the Entrypoint reverts when the recipient is address zero for ERC20 relay
   */
  function test_RelayWhenRecipientIsZeroForERC20(
    RelayParams memory _params,
    ProofLib.WithdrawProof memory _proof
  ) external {
    // Setup test with valid parameters but zero recipient
    _assumeFuzzable(_params.feeRecipient);
    vm.assume(_params.amount != 0);

    // Set up ERC20 token and pool
    _params.asset = address(new ERC20forTest('Test', 'TEST'));
    _params.pool = address(new PrivacyPoolERC20ForTest());
    _params.maxRelayFeeBPS = bound(_params.maxRelayFeeBPS, 0, 10_000);
    _params.feeBPS = bound(_params.feeBPS, 0, _params.maxRelayFeeBPS);
    _params.amount = bound(_params.amount, 1, 1e30);
    _proof.pubSignals[2] = _params.amount;

    _entrypoint.mockMaxRelayFeeBPS(IERC20(_params.asset), _params.maxRelayFeeBPS);

    // Construct withdrawal data with zero recipient
    bytes memory _data = abi.encode(
      IEntrypoint.RelayData({
        recipient: address(0), // Zero address recipient
        feeRecipient: _params.feeRecipient,
        relayFeeBPS: _params.feeBPS
      })
    );
    IPrivacyPool.Withdrawal memory _withdrawal =
      IPrivacyPool.Withdrawal({processooor: address(_entrypoint), data: _data});

    // Setup pool and mock interactions
    _entrypoint.mockScopeToPool(_params.scope, _params.pool);
    _mockAndExpect(_params.pool, abi.encodeWithSelector(IState.ASSET.selector), abi.encode(_params.asset));
    deal(_params.asset, _params.pool, _params.amount);
    PrivacyPoolERC20ForTest(_params.pool).setAsset(_params.asset);

    // Expect revert due to zero address recipient
    vm.expectRevert(IEntrypoint.ZeroAddress.selector);
    vm.prank(_params.caller);
    _entrypoint.relay(_withdrawal, _proof, _params.scope);
  }

  /**
   * @notice Test that the Entrypoint reverts when relay fee exceeds maximum allowed
   */
  function test_RelayWhenFeeExceedsMaximum(RelayParams memory _params, ProofLib.WithdrawProof memory _proof) external {
    // Setup test with valid recipients and amounts
    _assumeFuzzable(_params.recipient);
    _assumeFuzzable(_params.feeRecipient);

    vm.assume(_params.recipient != _params.feeRecipient);
    vm.assume(_params.amount != 0);

    // Configure ETH pool and parameters
    _params.asset = _ETH;
    _params.pool = address(new PrivacyPoolETHForTest());

    // Set up withdrawal parameters within valid bounds
    _params.maxRelayFeeBPS = bound(_params.maxRelayFeeBPS, 0, 10_000);
    _params.feeBPS = bound(_params.feeBPS, _params.maxRelayFeeBPS + 1, type(uint256).max);
    _params.amount = bound(_params.amount, 1, 1e30);
    _proof.pubSignals[2] = _params.amount;

    // Construct withdrawal data with fee distribution
    bytes memory _data = abi.encode(
      IEntrypoint.RelayData({
        recipient: _params.recipient,
        feeRecipient: _params.feeRecipient,
        relayFeeBPS: _params.feeBPS
      })
    );
    IPrivacyPool.Withdrawal memory _withdrawal =
      IPrivacyPool.Withdrawal({processooor: address(_entrypoint), data: _data});

    // Setup pool and mock interactions
    _entrypoint.mockScopeToPool(_params.scope, _params.pool);
    // Set up pool as only ETH sender
    _entrypoint.mockPool(
      PoolParams({
        pool: _params.pool,
        asset: _ETH,
        minDeposit: 0,
        vettingFeeBPS: 0,
        maxRelayFeeBPS: _params.maxRelayFeeBPS
      })
    );

    _mockAndExpect(_params.pool, abi.encodeWithSelector(IState.ASSET.selector), abi.encode(_params.asset));
    deal(_params.pool, _params.amount);

    // Execute relay operation
    vm.expectRevert(IEntrypoint.RelayFeeGreaterThanMax.selector);
    vm.prank(_params.caller);
    _entrypoint.relay(_withdrawal, _proof, _params.scope);
  }
}

/**
 * @notice Unit tests for Entrypoint pool registration functionality
 */
contract UnitRegisterPool is UnitEntrypoint {
  /**
   * @notice Test that the Entrypoint registers a new ETH pool
   */
  function test_RegisterETHPoolGivenPoolNotRegistered(
    address _pool,
    uint256 _minDeposit,
    uint256 _vettingFeeBPS
  ) external givenCallerHasOwnerRole {
    // Setup test with valid pool and asset addresses
    _assumeFuzzable(_pool);
    _vettingFeeBPS = bound(_vettingFeeBPS, 0, 10_000 - 1);

    // Calculate pool scope and mock interactions
    uint256 _scope = uint256(keccak256(abi.encodePacked(_pool, block.chainid, _ETH)));
    _mockAndExpect(_pool, abi.encodeWithSelector(IState.SCOPE.selector), abi.encode(_scope));
    _mockAndExpect(_pool, abi.encodeWithSelector(IState.ASSET.selector), abi.encode(_ETH));
    _mockAndExpect(_pool, abi.encodeWithSelector(IState.dead.selector), abi.encode(false));
    _mockAndExpect(_pool, abi.encodeWithSelector(IState.ENTRYPOINT.selector), abi.encode(address(_entrypoint)));

    // Expect pool registration event
    vm.expectEmit(address(_entrypoint));
    emit IEntrypoint.PoolRegistered(IPrivacyPool(_pool), IERC20(_ETH), _scope);

    // Execute pool registration
    _entrypoint.registerPool(IERC20(_ETH), IPrivacyPool(_pool), _minDeposit, _vettingFeeBPS, 500);

    // Verify pool configuration is set correctly
    (IPrivacyPool _retrievedPool, uint256 _retrievedMinDeposit, uint256 _retrievedFeeBPS,) =
      _entrypoint.assetConfig(IERC20(_ETH));
    assertEq(address(_retrievedPool), _pool, 'Retrieved pool should match input pool');
    assertEq(_retrievedMinDeposit, _minDeposit, 'Retrieved minimum deposit should match input');
    assertEq(_retrievedFeeBPS, _vettingFeeBPS, 'Retrieved vetting fee should match input');
  }

  /**
   * @notice Test that the Entrypoint registers a new ERC20 pool
   */
  function test_RegisterERC20PoolGivenPoolNotRegistered(
    address _pool,
    address _asset,
    uint256 _minDeposit,
    uint256 _vettingFeeBPS
  ) external givenCallerHasOwnerRole {
    // Setup test with valid pool and asset addresses
    vm.assume(_asset != _ETH);
    _assumeFuzzable(_pool);
    _assumeFuzzable(_asset);
    _vettingFeeBPS = bound(_vettingFeeBPS, 0, 10_000 - 1);

    // Calculate pool scope and mock interactions
    uint256 _scope = uint256(keccak256(abi.encodePacked(_pool, block.chainid, _asset)));
    _mockAndExpect(_pool, abi.encodeWithSelector(IState.SCOPE.selector), abi.encode(_scope));
    _mockAndExpect(_pool, abi.encodeWithSelector(IState.ASSET.selector), abi.encode(_asset));
    _mockAndExpect(_pool, abi.encodeWithSelector(IState.dead.selector), abi.encode(false));
    _mockAndExpect(_pool, abi.encodeWithSelector(IState.ENTRYPOINT.selector), abi.encode(address(_entrypoint)));

    // Mock ERC20 approval for non-ETH assets
    _mockAndExpect(_asset, abi.encodeWithSelector(IERC20.approve.selector, _pool, type(uint256).max), abi.encode(true));

    // Expect pool registration event
    vm.expectEmit(address(_entrypoint));
    emit IEntrypoint.PoolRegistered(IPrivacyPool(_pool), IERC20(_asset), _scope);

    // Execute pool registration
    _entrypoint.registerPool(IERC20(_asset), IPrivacyPool(_pool), _minDeposit, _vettingFeeBPS, 500);

    // Verify pool configuration is set correctly
    (IPrivacyPool _retrievedPool, uint256 _retrievedMinDeposit, uint256 _retrievedFeeBPS,) =
      _entrypoint.assetConfig(IERC20(_asset));
    assertEq(address(_retrievedPool), _pool, 'Retrieved pool should match input pool');
    assertEq(_retrievedMinDeposit, _minDeposit, 'Retrieved minimum deposit should match input');
    assertEq(_retrievedFeeBPS, _vettingFeeBPS, 'Retrieved vetting fee should match input');
  }

  /**
   * @notice Test that the Entrypoint reverts when the asset pool is already registered
   */
  function test_RegisterPoolWhenAssetPoolExists(PoolParams memory _params)
    external
    givenCallerHasOwnerRole
    givenPoolExists(_params)
  {
    // Ensure pool address is non-zero
    vm.assume(_params.pool != address(0));

    // Expect revert when trying to register pool for already registered asset
    vm.expectRevert(abi.encodeWithSelector(IEntrypoint.AssetPoolAlreadyRegistered.selector));
    _entrypoint.registerPool(
      IERC20(_params.asset),
      IPrivacyPool(_params.pool),
      _params.minDeposit,
      _params.vettingFeeBPS,
      _params.maxRelayFeeBPS
    );
  }

  /**
   * @notice Test that the Entrypoint reverts when the scope pool is already registered
   */
  function test_RegisterPoolWhenScopePoolExists(
    address _pool,
    address _asset,
    uint256 _minDeposit,
    uint256 _vettingFeeBPS
  ) external givenCallerHasOwnerRole {
    // Setup test with valid addresses and parameters
    _assumeFuzzable(_pool);
    _assumeFuzzable(_asset);
    vm.assume(_vettingFeeBPS < 10_000);

    // Mock existing pool with same scope
    uint256 _scope = uint256(keccak256(abi.encodePacked(_pool, block.chainid, _asset)));
    _entrypoint.mockScopeToPool(_scope, _pool);
    _mockAndExpect(_pool, abi.encodeWithSelector(IState.SCOPE.selector), abi.encode(_scope));
    _mockAndExpect(_pool, abi.encodeWithSelector(IState.dead.selector), abi.encode(false));
    _mockAndExpect(_pool, abi.encodeWithSelector(IState.ENTRYPOINT.selector), abi.encode(address(_entrypoint)));

    // Expect revert when trying to register pool with existing scope
    vm.expectRevert(abi.encodeWithSelector(IEntrypoint.ScopePoolAlreadyRegistered.selector));
    _entrypoint.registerPool(IERC20(_asset), IPrivacyPool(_pool), _minDeposit, _vettingFeeBPS, 500);
  }

  /**
   * @notice Test that the Entrypoint reverts when the caller lacks the owner role
   */
  function test_RegisterPoolWhenCallerLacksOwnerRole(
    address _caller,
    address _pool,
    address _asset,
    uint256 _minDeposit,
    uint256 _vettingFeeBPS
  ) external {
    // Setup test with caller different from owner
    vm.assume(_caller != _OWNER);

    // Expect revert when non-owner tries to register pool
    vm.expectRevert(
      abi.encodeWithSelector(
        IAccessControl.AccessControlUnauthorizedAccount.selector, _caller, _entrypoint.OWNER_ROLE()
      )
    );
    vm.prank(_caller);
    _entrypoint.registerPool(IERC20(_asset), IPrivacyPool(_pool), _minDeposit, _vettingFeeBPS, 500);
  }

  /**
   * @notice Test that the Entrypoint reverts when the pool is dead
   */
  function test_RegisterPoolWhenPoolIsDead(
    address _pool,
    address _asset,
    uint256 _minDeposit,
    uint256 _vettingFeeBPS
  ) external givenCallerHasOwnerRole {
    // Setup test with valid pool and asset addresses
    _assumeFuzzable(_pool);
    _assumeFuzzable(_asset);
    _vettingFeeBPS = bound(_vettingFeeBPS, 0, 10_000 - 1);

    // Mock pool being dead
    _mockAndExpect(_pool, abi.encodeWithSelector(IState.dead.selector), abi.encode(true));

    // Expect revert when trying to register a dead pool
    vm.expectRevert(abi.encodeWithSelector(IEntrypoint.PoolIsDead.selector));
    _entrypoint.registerPool(IERC20(_asset), IPrivacyPool(_pool), _minDeposit, _vettingFeeBPS, 500);
  }

  /**
   * @notice Test that the Entrypoint reverts when the pools' Entrypoint address mismatches
   */
  function test_RegisterPoolWhenEntrypointMismatches(
    address _pool,
    address _notEntrypoint,
    address _asset,
    uint256 _minDeposit,
    uint256 _vettingFeeBPS
  ) external givenCallerHasOwnerRole {
    vm.assume(_notEntrypoint != address(_entrypoint));
    _assumeFuzzable(_pool);
    _assumeFuzzable(_asset);
    _vettingFeeBPS = bound(_vettingFeeBPS, 0, 10_000 - 1);

    // Mock pool being dead
    _mockAndExpect(_pool, abi.encodeWithSelector(IState.dead.selector), abi.encode(false));
    _mockAndExpect(_pool, abi.encodeWithSelector(IState.ENTRYPOINT.selector), abi.encode(_notEntrypoint));

    // Expect revert when trying to register an invalid Entrypoint address
    vm.expectRevert(abi.encodeWithSelector(IEntrypoint.InvalidEntrypointForPool.selector));
    _entrypoint.registerPool(IERC20(_asset), IPrivacyPool(_pool), _minDeposit, _vettingFeeBPS, 500);
  }
}

/**
 * @notice Unit tests for Entrypoint pool removal functionality
 */
contract UnitRemovePool is UnitEntrypoint {
  /**
   * @notice Test that the Entrypoint removes an ETH pool
   */
  function test_RemovePoolGivenETHPoolExists(
    PoolParams memory _params,
    uint256 _scope
  )
    external
    givenCallerHasOwnerRole
    givenPoolExists(PoolParams(_params.pool, _ETH, _params.minDeposit, _params.vettingFeeBPS, 500))
  {
    _params.asset = _ETH;
    // Mock pool scope and interactions
    _mockAndExpect(_params.pool, abi.encodeWithSelector(IState.SCOPE.selector), abi.encode(_scope));

    // Expect pool removal event
    vm.expectEmit(address(_entrypoint));
    emit IEntrypoint.PoolRemoved(IPrivacyPool(_params.pool), IERC20(_params.asset), _scope);

    // Execute pool removal
    _entrypoint.removePool(IERC20(_params.asset));

    // Verify pool configuration is reset
    (IPrivacyPool _retrievedPool, uint256 _retrievedMinDeposit, uint256 _retrievedFeeBPS,) =
      _entrypoint.assetConfig(IERC20(_params.asset));
    assertEq(address(_retrievedPool), address(0), 'Pool should be removed');
    assertEq(_retrievedMinDeposit, 0, 'Minimum deposit should be reset to 0');
    assertEq(_retrievedFeeBPS, 0, 'Vetting fee should be reset to 0');
    assertEq(address(_entrypoint.scopeToPool(_scope)), address(0), 'Scope to pool mapping should be cleared');
  }

  /**
   * @notice Test that the Entrypoint removes an ERC20 pool
   */
  function test_RemovePoolGivenERC20PoolExists(
    PoolParams memory _params,
    uint256 _scope
  ) external givenCallerHasOwnerRole givenPoolExists(_params) {
    vm.assume(_params.asset != _ETH);
    // Mock pool scope and interactions
    _mockAndExpect(_params.pool, abi.encodeWithSelector(IState.SCOPE.selector), abi.encode(_scope));

    // Mock ERC20 approval reset for non-ETH assets
    _mockAndExpect(_params.asset, abi.encodeWithSelector(IERC20.approve.selector, _params.pool, 0), abi.encode(true));

    // Expect pool removal event
    vm.expectEmit(address(_entrypoint));
    emit IEntrypoint.PoolRemoved(IPrivacyPool(_params.pool), IERC20(_params.asset), _scope);

    // Execute pool removal
    _entrypoint.removePool(IERC20(_params.asset));

    // Verify pool configuration is reset
    (IPrivacyPool _retrievedPool, uint256 _retrievedMinDeposit, uint256 _retrievedFeeBPS,) =
      _entrypoint.assetConfig(IERC20(_params.asset));
    assertEq(address(_retrievedPool), address(0), 'Pool should be removed');
    assertEq(_retrievedMinDeposit, 0, 'Minimum deposit should be reset to 0');
    assertEq(_retrievedFeeBPS, 0, 'Vetting fee should be reset to 0');
    assertEq(address(_entrypoint.scopeToPool(_scope)), address(0), 'Scope to pool mapping should be cleared');
  }

  /**
   * @notice Test that the Entrypoint reverts when the pool is not found
   */
  function test_RemovePoolWhenPoolNotFound(address _asset) external givenCallerHasOwnerRole {
    // Expect revert when trying to remove non-existent pool
    vm.expectRevert(abi.encodeWithSelector(IEntrypoint.PoolNotFound.selector));
    _entrypoint.removePool(IERC20(_asset));
  }

  /**
   * @notice Test that the Entrypoint reverts when the caller lacks the owner role
   */
  function test_RemovePoolWhenCallerLacksOwnerRole(address _caller, address _asset) external {
    // Setup test with caller different from owner
    vm.assume(_caller != _OWNER);

    // Expect revert when non-owner tries to remove pool
    vm.expectRevert(
      abi.encodeWithSelector(
        IAccessControl.AccessControlUnauthorizedAccount.selector, _caller, _entrypoint.OWNER_ROLE()
      )
    );
    vm.prank(_caller);
    _entrypoint.removePool(IERC20(_asset));
  }
}

/**
 * @notice Unit tests for Entrypoint pool configuration update functionality
 */
contract UnitUpdatePoolConfiguration is UnitEntrypoint {
  /**
   * @notice Test that the Entrypoint updates the pool configuration
   */
  function test_UpdatePoolConfigurationGivenPoolExists(
    PoolParams memory _params,
    PoolParams memory _newParams
  ) external givenCallerHasOwnerRole givenPoolExists(_params) {
    // Verify initial pool configuration
    (IPrivacyPool _pool, uint256 _minDeposit, uint256 _vettingFeeBPS,) = _entrypoint.assetConfig(IERC20(_params.asset));
    assertEq(address(_pool), _params.pool, 'Retrieved pool should match input pool');
    assertEq(_minDeposit, _params.minDeposit, 'Retrieved minimum deposit should match input');
    assertEq(_vettingFeeBPS, _params.vettingFeeBPS, 'Retrieved vetting fee should match input');

    _newParams.vettingFeeBPS = bound(_newParams.vettingFeeBPS, 0, 10_000 - 1);
    _newParams.maxRelayFeeBPS = bound(_newParams.maxRelayFeeBPS, 0, 10_000 - 1);

    // Expect configuration update event
    vm.expectEmit(address(_entrypoint));
    emit IEntrypoint.PoolConfigurationUpdated(
      IPrivacyPool(_params.pool),
      IERC20(_params.asset),
      _newParams.minDeposit,
      _newParams.vettingFeeBPS,
      _newParams.maxRelayFeeBPS
    );

    // Execute configuration update
    _entrypoint.updatePoolConfiguration(
      IERC20(_params.asset), _newParams.minDeposit, _newParams.vettingFeeBPS, _newParams.maxRelayFeeBPS
    );

    // Verify updated configuration
    (IPrivacyPool _retrievedPool, uint256 _retrievedMinDeposit, uint256 _retrievedFeeBPS, uint256 _retrievedMaxRelayFee)
    = _entrypoint.assetConfig(IERC20(_params.asset));
    assertEq(address(_retrievedPool), address(_params.pool));
    assertEq(_retrievedMinDeposit, _newParams.minDeposit, 'Retrieved minimum deposit amount should match');
    assertEq(_retrievedFeeBPS, _newParams.vettingFeeBPS, 'Retrieved vetting fee BPS should match');
    assertEq(_retrievedMaxRelayFee, _newParams.maxRelayFeeBPS, 'Retrieved max relay fee BPS should match');
  }

  /**
   * @notice Test that the Entrypoint reverts when the pool is not found
   */
  function test_UpdatePoolConfigurationWhenPoolNotFound(
    address _asset,
    uint256 _minDeposit,
    uint256 _vettingFeeBPS
  ) external givenCallerHasOwnerRole {
    _vettingFeeBPS = bound(_vettingFeeBPS, 0, 10_000 - 1);
    // Expect revert when trying to update non-existent pool
    vm.expectRevert(abi.encodeWithSelector(IEntrypoint.PoolNotFound.selector));
    _entrypoint.updatePoolConfiguration(IERC20(_asset), _minDeposit, _vettingFeeBPS, 500);
  }

  /**
   * @notice Test that the Entrypoint reverts when the caller lacks the owner role
   */
  function test_UpdatePoolConfigurationWhenCallerLacksOwnerRole(
    address _caller,
    address _asset,
    uint256 _minDeposit,
    uint256 _vettingFeeBPS
  ) external {
    // Setup test with caller different from owner
    vm.assume(_caller != _OWNER);

    // Expect revert when non-owner tries to update configuration
    vm.expectRevert(
      abi.encodeWithSelector(
        IAccessControl.AccessControlUnauthorizedAccount.selector, _caller, _entrypoint.OWNER_ROLE()
      )
    );
    vm.prank(_caller);
    _entrypoint.updatePoolConfiguration(IERC20(_asset), _minDeposit, _vettingFeeBPS, 500);
  }
}

/**
 * @notice Unit tests for Entrypoint pool wind down functionality
 */
contract UnitWindDownPool is UnitEntrypoint {
  function test_WindDownPoolGivenPoolExists(PoolParams memory _params)
    external
    givenCallerHasOwnerRole
    givenPoolExists(_params)
  {
    // Mock pool wind down interaction
    _mockAndExpect(_params.pool, abi.encodeWithSelector(IPrivacyPool.windDown.selector), abi.encode(true));

    // Expect wind down event
    vm.expectEmit(address(_entrypoint));
    emit IEntrypoint.PoolWindDown(IPrivacyPool(_params.pool));

    // Execute pool wind down
    _entrypoint.windDownPool(IPrivacyPool(_params.pool));
  }

  /**
   * @notice Test that the Entrypoint reverts when the caller lacks the owner role
   */
  function test_WindDownPoolWhenCallerLacksOwnerRole(
    address _caller,
    PoolParams memory _params
  ) external givenPoolExists(_params) {
    // Setup test with caller different from owner
    vm.assume(_caller != _OWNER);

    // Expect revert when non-owner tries to wind down pool
    vm.expectRevert(
      abi.encodeWithSelector(
        IAccessControl.AccessControlUnauthorizedAccount.selector, _caller, _entrypoint.OWNER_ROLE()
      )
    );
    vm.prank(_caller);
    _entrypoint.windDownPool(IPrivacyPool(_params.pool));
  }
}

/**
 * @notice Unit tests for Entrypoint fees withdrawal functionality
 */
contract UnitWithdrawFees is UnitEntrypoint {
  /**
   * @notice Test that the Entrypoint withdraws fees for ETH
   */
  receive() external payable {}

  function test_WithdrawFeesWhenETHBalanceExists(uint256 _balance, address _recipient) external givenCallerHasOwnerRole {
    // Setup test with valid recipient and non-zero balance
    _assumeFuzzable(_recipient);
    vm.assume(_balance != 0);
    vm.deal(address(_entrypoint), _balance);

    // Record initial balances for verification
    uint256 _initialEntrypointBalance = address(_entrypoint).balance;
    uint256 _initialRecipientBalance = _recipient.balance;

    // Expect fee withdrawal event
    vm.expectEmit(address(_entrypoint));
    emit IEntrypoint.FeesWithdrawn(IERC20(_ETH), _recipient, _balance);

    // Execute fee withdrawal
    _entrypoint.withdrawFees(IERC20(_ETH), _recipient);

    // Verify balances are updated correctly
    assertEq(
      address(_entrypoint).balance,
      _initialEntrypointBalance - _balance,
      'Depositor balance should decrease by deposit amount'
    );
    assertEq(
      _recipient.balance, _initialRecipientBalance + _balance, 'Recipient balance should increase by deposit amount'
    );
  }

  /**
   * @notice Test that the Entrypoint reverts when the ETH transfer fails
   */
  function test_WithdrawFeesWhenETHTransferFails(uint256 _balance, address _recipient) external givenCallerHasOwnerRole {
    // Setup test with valid recipient and non-zero balance
    _assumeFuzzable(_recipient);
    vm.assume(_balance != 0);
    vm.deal(address(_entrypoint), _balance);

    // Deploy contract that reverts on ETH receive
    bytes memory revertingCode = hex'60006000fd';
    vm.etch(_recipient, revertingCode);

    // Expect revert when ETH transfer fails
    vm.expectRevert(abi.encodeWithSelector(IEntrypoint.NativeAssetTransferFailed.selector));
    _entrypoint.withdrawFees(IERC20(_ETH), _recipient);
  }

  /**
   * @notice Test that the Entrypoint withdraws fees for a token
   */
  function test_WithdrawFeesWhenTokenBalanceExists(
    address _asset,
    uint256 _balance,
    address _recipient
  ) external givenCallerHasOwnerRole {
    // Setup test with valid parameters
    _assumeFuzzable(_recipient);
    _assumeFuzzable(_asset);
    vm.assume(_recipient != address(_entrypoint));
    vm.assume(_balance != 0);
    vm.assume(_asset != _ETH);
    vm.deal(address(_entrypoint), _balance);

    // Mock token balance and transfer
    _mockAndExpect(
      _asset, abi.encodeWithSelector(IERC20.balanceOf.selector, address(_entrypoint)), abi.encode(_balance)
    );
    _mockAndExpect(_asset, abi.encodeWithSelector(IERC20.transfer.selector, _recipient, _balance), abi.encode(true));

    // Expect fee withdrawal event
    vm.expectEmit(address(_entrypoint));
    emit IEntrypoint.FeesWithdrawn(IERC20(_asset), _recipient, _balance);

    // Execute fee withdrawal
    _entrypoint.withdrawFees(IERC20(_asset), _recipient);
  }

  /**
   * @notice Test that the Entrypoint reverts when the caller lacks the owner role
   */
  function test_WithdrawFeesWhenCallerLacksOwnerRole(address _caller, address _asset, address _recipient) external {
    // Setup test with caller different from owner
    vm.assume(_caller != _OWNER);

    // Expect revert when non-owner tries to withdraw fees
    vm.expectRevert(
      abi.encodeWithSelector(
        IAccessControl.AccessControlUnauthorizedAccount.selector, _caller, _entrypoint.OWNER_ROLE()
      )
    );
    vm.prank(_caller);
    _entrypoint.withdrawFees(IERC20(_asset), _recipient);
  }

  /**
   * @notice Test that the Entrypoint reverts when the fee recipient is address zero for ETH
   */
  function test_WithdrawFeesWhenRecipientIsZeroForETH(uint256 _balance) external givenCallerHasOwnerRole {
    vm.assume(_balance != 0);
    vm.deal(address(_entrypoint), _balance);

    // Expect revert when recipient is address zero
    vm.expectRevert(IEntrypoint.ZeroAddress.selector);
    _entrypoint.withdrawFees(IERC20(_ETH), address(0));
  }

  /**
   * @notice Test that the Entrypoint reverts when the fee recipient is address zero for ERC20
   */
  function test_WithdrawFeesWhenRecipientIsZeroForERC20(
    address _asset,
    uint256 _balance
  ) external givenCallerHasOwnerRole {
    _assumeFuzzable(_asset);
    vm.assume(_asset != _ETH);
    vm.assume(_balance != 0);

    // Expect the call fetching the Entrypoint balance
    _mockAndExpect(
      _asset, abi.encodeWithSelector(IERC20.balanceOf.selector, address(_entrypoint)), abi.encode(_balance)
    );

    // Expect revert when recipient is address zero
    vm.expectRevert(IEntrypoint.ZeroAddress.selector);
    _entrypoint.withdrawFees(IERC20(_asset), address(0));
  }
}

/**
 * @notice Unit tests for Entrypoint view methods
 */
contract UnitViewMethods is UnitEntrypoint {
  /**
   * @notice Test that the Entrypoint returns the latest root
   */
  function test_LatestRootGivenAssociationSetsExist() external {
    // Mock association set with root value 1
    _entrypoint.mockAssociationSets(1, 'ipfs_cid_ipfs_cid_ipfs_cid_ipfs_cid_ipfs_cid_ipfs_cid');

    // Verify latest root is returned correctly
    assertEq(_entrypoint.latestRoot(), 1, 'Latest root should be 1');
  }

  /**
   * @notice Test that the Entrypoint returns the root by index
   */
  function test_RootByIndexGivenValidIndex() external {
    // Mock multiple association sets with different roots
    _entrypoint.mockAssociationSets(1, 'ipfs_cid_ipfs_cid_ipfs_cid_ipfs_cid_ipfs_cid_ipfs_cid');
    _entrypoint.mockAssociationSets(2, 'ipfs_cid_ipfs_cid_ipfs_cid_ipfs_cid_ipfs_cid_ipfs_cid');

    // Verify roots are returned correctly by index
    assertEq(_entrypoint.rootByIndex(0), 1, 'First root should be 1');
    assertEq(_entrypoint.rootByIndex(1), 2, 'Second root should be 2');
  }
}

/**
 * @notice Unit tests for upgrading the Entrypoint contract
 */
contract UnitUpgrades is UnitEntrypoint {
  /**
   * @notice Test that the Entrypoint properly upgrades to a new implementation
   */
  function test_upgradeEntrypoint(address _newImplementation, bytes calldata _data) public {
    _assumeFuzzable(_newImplementation);
    _mockAndExpect(
      _newImplementation,
      abi.encodeWithSignature('proxiableUUID()'),
      abi.encode(0x360894a13ba1a3210667c828492db98dca3e2076cc3735a920a3ca505d382bbc)
    );

    if (keccak256(_data) != keccak256('')) {
      _mockAndExpect(_newImplementation, _data, abi.encode());
    }

    vm.expectEmit(address(_entrypoint));
    emit IERC1967.Upgraded(_newImplementation);

    vm.prank(_OWNER);
    _entrypoint.upgradeToAndCall(_newImplementation, _data);
  }
}

/**
 * @notice Unit tests for the `receive` method
 */
contract UnitReceive is UnitEntrypoint {
  /**
   * @notice Test that the Entrypoint doesn't accept native asset from any other address than the native pool
   */
  function test_nativeAssetTransferToEntrypointFails(
    address _caller,
    uint256 _amount,
    PoolParams memory _params
  )
    external
    givenPoolExists(
      PoolParams({
        pool: _params.pool,
        asset: _ETH,
        minDeposit: 0,
        vettingFeeBPS: 0,
        maxRelayFeeBPS: 500 // Default to 5%
      })
    )
  {
    // Config pool
    (IPrivacyPool _nativePool,,,) = _entrypoint.assetConfig(IERC20(_ETH));

    // Filter pool address
    vm.assume(_caller != address(_nativePool));

    vm.deal(_caller, _amount);

    // Check it reverts when sending native asset
    vm.expectRevert(IEntrypoint.NativeAssetNotAccepted.selector);
    vm.prank(_caller);
    payable(address(_entrypoint)).transfer(_amount);
  }
}

/**
 * @notice Unit tests for Entrypoint's role based access configuration
 */
contract UnitAccessControl is UnitEntrypoint {
  bytes32 public constant DEFAULT_ADMIN_ROLE = 0x00;
  bytes32 public constant OWNER_ROLE = keccak256('OWNER_ROLE');
  bytes32 public constant ASP_POSTMAN = keccak256('ASP_POSTMAN');

  /**
   * @notice Test that the OWNER_ROLE can manage other roles
   */
  function test_ownerRole(address _notOwner, address _account) public {
    vm.assume(_notOwner != _OWNER);

    // Not owner can't manager OWNER_ROLE
    vm.expectRevert(
      abi.encodeWithSelector(IAccessControl.AccessControlUnauthorizedAccount.selector, _notOwner, OWNER_ROLE)
    );
    vm.prank(_notOwner);
    _entrypoint.grantRole(OWNER_ROLE, _account);

    // Not owner can't manager ASP_POSTMAN role
    vm.expectRevert(
      abi.encodeWithSelector(IAccessControl.AccessControlUnauthorizedAccount.selector, _notOwner, OWNER_ROLE)
    );
    vm.prank(_notOwner);
    _entrypoint.grantRole(ASP_POSTMAN, _account);

    // Not owner can't manager DEFAULT_ADMIN_ROLE
    vm.expectRevert(
      abi.encodeWithSelector(IAccessControl.AccessControlUnauthorizedAccount.selector, _notOwner, OWNER_ROLE)
    );
    vm.prank(_notOwner);
    _entrypoint.grantRole(DEFAULT_ADMIN_ROLE, _account);

    // Owner can manage OWNER_ROLE
    vm.prank(_OWNER);
    _entrypoint.grantRole(OWNER_ROLE, _account);
    assertTrue(_entrypoint.hasRole(OWNER_ROLE, _account), 'Account must have owner role');

    // Owner can manage ASP_POSTMAN role
    vm.prank(_OWNER);
    _entrypoint.grantRole(ASP_POSTMAN, _account);
    assertTrue(_entrypoint.hasRole(ASP_POSTMAN, _account), 'Account must have postman role');

    // Owner can manage DEFAULT_ADMIN_ROLE
    vm.prank(_OWNER);
    _entrypoint.grantRole(DEFAULT_ADMIN_ROLE, _account);
    assertTrue(_entrypoint.hasRole(DEFAULT_ADMIN_ROLE, _account), 'Account must have default admin role');
  }

  /**
   * @notice Test that the ASP_POSTMAN role can't manage other roles
   */
  function test_postmanRole(address _account) public {
    // Postman can't manage OWNER_ROLE
    vm.expectRevert(
      abi.encodeWithSelector(IAccessControl.AccessControlUnauthorizedAccount.selector, _POSTMAN, OWNER_ROLE)
    );
    vm.prank(_POSTMAN);
    _entrypoint.grantRole(OWNER_ROLE, _account);

    // Postman can't manage ASP_POSTMAN role
    vm.expectRevert(
      abi.encodeWithSelector(IAccessControl.AccessControlUnauthorizedAccount.selector, _POSTMAN, OWNER_ROLE)
    );
    vm.prank(_POSTMAN);
    _entrypoint.grantRole(ASP_POSTMAN, _account);

    // Postman can't manage DEFAULT_ADMIN_ROLE
    vm.expectRevert(
      abi.encodeWithSelector(IAccessControl.AccessControlUnauthorizedAccount.selector, _POSTMAN, OWNER_ROLE)
    );
    vm.prank(_POSTMAN);
    _entrypoint.grantRole(DEFAULT_ADMIN_ROLE, _account);
  }

  /**
   * @notice Test that the DEFAULT_ADMIN_ROLE can't manage other roles
   */
  function test_defaultAdminRole(address _defaultAdmin, address _account) public {
    vm.assume(_defaultAdmin != _OWNER);

    vm.prank(_OWNER);
    _entrypoint.grantRole(DEFAULT_ADMIN_ROLE, _defaultAdmin);

    // DEFAULT_ADMIN_ROLE can't manage OWNER_ROLE
    vm.expectRevert(
      abi.encodeWithSelector(IAccessControl.AccessControlUnauthorizedAccount.selector, _defaultAdmin, OWNER_ROLE)
    );
    vm.prank(_defaultAdmin);
    _entrypoint.grantRole(OWNER_ROLE, _account);

    // DEFAULT_ADMIN_ROLE can't manage ASP_POSTMAN
    vm.expectRevert(
      abi.encodeWithSelector(IAccessControl.AccessControlUnauthorizedAccount.selector, _defaultAdmin, OWNER_ROLE)
    );
    vm.prank(_defaultAdmin);
    _entrypoint.grantRole(ASP_POSTMAN, _account);

    // DEFAULT_ADMIN_ROLE can't manage DEFAULT_ADMIN_ROLE
    vm.expectRevert(
      abi.encodeWithSelector(IAccessControl.AccessControlUnauthorizedAccount.selector, _defaultAdmin, OWNER_ROLE)
    );
    vm.prank(_defaultAdmin);
    _entrypoint.grantRole(DEFAULT_ADMIN_ROLE, _account);
  }
}

/**
 * @notice Unit tests for checking reentrancy protection
 */
contract UnitReentrancy is UnitEntrypoint {
  /**
   * @notice Test that the Entrypoint properly upgrades to a new implementation
   * @dev If you run the test with maximum verbosity you can see in the traces that the reentrant call
   * properly reverts with `error ReentrancyGuardUpgradeable.ReentrancyGuardReentrantCall`, but since
   * the native asset transfer call from the Entrypoint is a low-level `call`, the error doesn't bubble up
   * and we assert the revert with the custom `error IEntrypoint.NativeAssetTransferFailed`.
   * It is also checked that the Entrypoint receives the reentrant `deposit` call.
   */
  function test_reentrantRelay(RelayParams memory _params, ProofLib.WithdrawProof memory _proof) external {
    // Deploy attacker contract
    Attacker _attacker = new Attacker();

    // Setup test with valid recipients and amounts
    ////////////////////////////////////////// RELAY SETUP : IGNORE ////////////////////////////////////////
    _assumeFuzzable(_params.recipient);
    _assumeFuzzable(_params.feeRecipient);
    vm.assume(_params.recipient != _params.feeRecipient);
    vm.assume(_params.amount != 0);
    _params.asset = _ETH;
    _params.pool = address(new PrivacyPoolETHForTest());
    _params.maxRelayFeeBPS = bound(_params.maxRelayFeeBPS, 0, 10_000);
    _params.feeBPS = bound(_params.feeBPS, 0, _params.maxRelayFeeBPS);
    _params.amount = bound(_params.amount, 1, 1e30);
    _proof.pubSignals[2] = _params.amount;
    bytes memory _data = abi.encode(
      IEntrypoint.RelayData({
        recipient: address(_attacker), // <---- setting the Attacker contract as recipient
        feeRecipient: _params.feeRecipient,
        relayFeeBPS: _params.feeBPS
      })
    );
    IPrivacyPool.Withdrawal memory _withdrawal =
      IPrivacyPool.Withdrawal({processooor: address(_entrypoint), data: _data});
    _entrypoint.mockScopeToPool(_params.scope, _params.pool);
    _entrypoint.mockPool(
      PoolParams({
        pool: _params.pool,
        asset: _ETH,
        minDeposit: 0,
        vettingFeeBPS: 0,
        maxRelayFeeBPS: _params.maxRelayFeeBPS
      })
    );
    _mockAndExpect(_params.pool, abi.encodeWithSelector(IState.ASSET.selector), abi.encode(_params.asset));
    deal(_params.pool, _params.amount);
    ////////////////////////////////////////// RELAY SETUP : IGNORE ////////////////////////////////////////

    // Expect the Attacker contract calling deposit on the Entrypoint
    vm.expectCall(
      address(_entrypoint), abi.encodeWithSignature('deposit(uint256)', uint256(keccak256('precommitment')))
    );

    // Revert when trying to relay
    vm.expectRevert(IEntrypoint.NativeAssetTransferFailed.selector);
    vm.prank(_params.caller);
    _entrypoint.relay(_withdrawal, _proof, _params.scope);
  }
}

/**
 * @notice Helper contract for testing reetrancy checks
 */
contract Attacker {
  fallback() external payable {
    Entrypoint(payable(msg.sender)).deposit(uint256(keccak256('precommitment')));
  }
}
