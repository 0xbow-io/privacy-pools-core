// SPDX-License-Identifier: Apache-2.0
pragma solidity 0.8.28;

import {IntegrationUtils} from '../integration/Utils.sol';
import {IERC1967} from '@oz/interfaces/IERC1967.sol';
import {Test} from 'forge-std/Test.sol';

import {IERC20} from '@oz/interfaces/IERC20.sol';
import {Initializable} from '@oz/proxy/utils/Initializable.sol';
import {Constants} from 'contracts/lib/Constants.sol';

import {Entrypoint, IEntrypoint} from 'contracts/Entrypoint.sol';
import {PrivacyPoolComplex} from 'contracts/implementations/PrivacyPoolComplex.sol';
import {ProofLib} from 'contracts/lib/ProofLib.sol';
import {IPrivacyPool} from 'interfaces/IPrivacyPool.sol';

contract MainnetEnvironment {
  /// @notice Current implementation address
  address public implementationV1 = 0xdD8aA0560a08E39C0b3A84BBa356Bc025AfbD4C1;
  /// @notice Entrypoint ERC1967Proxy address
  Entrypoint public proxy = Entrypoint(payable(0x6818809EefCe719E480a7526D76bD3e561526b46));

  /// @notice ETH Privacy Pool address
  IPrivacyPool public ethPool = IPrivacyPool(0xF241d57C6DebAe225c0F2e6eA1529373C9A9C9fB);

  /// @notice Owner address (SAFE multisig)
  address public owner = 0xAd7f9A19E2598b6eFE0A25C84FB1c87F81eB7159;
  /// @notice Postman address
  address public postman = 0x1f4Fe25Cf802a0605229e0Dc497aAf653E86E187;

  /// @notice Association set index at fork block
  uint256 internal _associationSetIndex = 20;

  /// @notice Ethereum Mainnet fork block
  uint256 internal constant _FORK_BLOCK = 22_495_337;
}

/**
 * @title EntrypointUpgradeIntegration
 * @notice Integration tests for upgrading the Entrypoint contract on mainnet
 * @dev This test suite verifies the upgrade process of the Entrypoint contract using UUPS proxy pattern
 * @dev Tests are run against a forked mainnet environment to ensure compatibility with production state
 */
contract EntrypointUpgradeIntegration is Test, IntegrationUtils, MainnetEnvironment {
  /// @notice Entrypoint owner role
  bytes32 internal constant _OWNER_ROLE = keccak256('OWNER_ROLE');
  /// @notice Entrypoint postman role
  bytes32 internal constant _ASP_POSTMAN = keccak256('ASP_POSTMAN');
  /// @notice Storage slot where the implementation address is located for ERC1967 Proxies
  bytes32 internal constant _IMPLEMENTATION_SLOT = 0x360894a13ba1a3210667c828492db98dca3e2076cc3735a920a3ca505d382bbc;

  bytes32 private constant _INITIALIZABLE_SLOT = 0xf0c57e16840df040f15088dc2f81fe391c3923bec73e23a9662efc9c229c6a00;

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
  address internal _relayer = makeAddr('relayer');
  address internal _recipient = makeAddr('recipient');

  /// @notice Variables for testing flows, trying to avoid stack-too-deep
  uint256 internal _value;
  uint256 internal _label;
  uint256 internal _precommitment;
  uint256 internal _nullifier;
  uint256 internal _secret;
  uint256 internal _context;
  ProofLib.WithdrawProof internal _withdrawProof;
  ProofLib.RagequitProof internal _ragequitProof;

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

  /**
   * @notice Test that the Entrypoint state and configuration is kept the same
   */
  function test_StateIsKept() public {
    // Check initialization status
    bytes32 _initializableStorage = vm.load(address(proxy), _INITIALIZABLE_SLOT);
    uint64 _initializedVersion = uint64(uint256(_initializableStorage));
    assertEq(_initializedVersion, 1, 'Proxy must be already initialized');

    // Check can't be initialized again
    vm.expectRevert(Initializable.InvalidInitialization.selector);
    vm.prank(owner);
    proxy.initialize(owner, postman);

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

  /**
   * @notice Test that the Postman can still post roots and they get properly udpated
   */
  function test_UpdateRoot() public {
    uint256 _newRoot = uint256(keccak256('some_root'));

    // Push some random root as postman
    vm.prank(postman);
    proxy.updateRoot(_newRoot, 'ipfs_cid_ipfs_cid_ipfs_cid_ipfs_cid_ipfs_cid_ipfs_cid');

    // Check lates root and latest index were updated correctly
    assertEq(proxy.latestRoot(), _newRoot, 'ASP root must have been updated');
    assertEq(proxy.rootByIndex(_associationSetIndex + 1), _newRoot, 'ASP root index must have been updated');
  }

  /**
   * @notice Test that users can deposit and the balances get updated accordingly
   */
  function test_ETHDeposit() public {
    uint256 _depositAmount = 10 ether;

    // Calculate deposited amount after configured fees
    _value = _deductFee(_depositAmount, _vettingFeeBPSFromConfig);
    uint256 _fees = _depositAmount - _value;

    // Deal user
    vm.deal(_user, _depositAmount);

    // Fetch previous balances
    uint256 _entrypointBalanceBefore = address(proxy).balance;
    uint256 _poolBalanceBefore = address(ethPool).balance;

    // Expect `deposit` call to ETH pool
    vm.expectCall(
      address(ethPool),
      _value,
      abi.encodeWithSelector(IPrivacyPool.deposit.selector, _user, _value, uint256(keccak256('precommitment')))
    );

    // Deposit
    vm.prank(_user);
    proxy.deposit{value: _depositAmount}(uint256(keccak256('precommitment')));

    // Check balances were updated correctly
    assertEq(_entrypointBalanceBefore + _fees, address(proxy).balance, 'Entrypoint balance mismatch');
    assertEq(_poolBalanceBefore + _value, address(ethPool).balance, 'Pool balance mismatch');

    // Can't reuse same precommitment
    vm.deal(_user, _depositAmount);

    vm.expectRevert(IEntrypoint.PrecommitmentAlreadyUsed.selector);
    vm.prank(_user);
    proxy.deposit{value: _depositAmount}(uint256(keccak256('precommitment')));
  }

  /**
   * @notice Test that the owner can register a new pool and wind it down
   */
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

  /**
   * @notice Test that the owner can wind down a pool and completely remove its configuration from the Entrypoint
   */
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

  /**
   * @notice Test that the owner can withdraw the collected fees from the Entrypoint
   */
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

  /**
   * @notice Test that a user can deposit and partially withdraw through a relayer
   */
  function test_DepositAndWithdrawThroughRelayer() public {
    uint256 _depositAmount = 10 ether;

    // Calculate deposited amount after configured fees
    _value = _deductFee(_depositAmount, _vettingFeeBPSFromConfig);

    // Deal user
    vm.deal(_user, _depositAmount);

    // Compute precommitment
    _precommitment = _hashPrecommitment(_genSecretBySeed('nullifier'), _genSecretBySeed('secret'));

    // Precalculate label
    uint256 _currentNonce = ethPool.nonce();
    _label = uint256(keccak256(abi.encodePacked(ethPool.SCOPE(), ++_currentNonce))) % Constants.SNARK_SCALAR_FIELD;

    // Deposit
    vm.prank(_user);
    uint256 _commitmentHash = proxy.deposit{value: _depositAmount}(_precommitment);

    // Generate the state merkle proof with the fork state tree and the new leaf (commitment hash)
    string[] memory _stateMerkleProofInputs = new string[](4);
    _stateMerkleProofInputs[0] = 'node';
    _stateMerkleProofInputs[1] = 'test/helper/MerkleProofFromFile.mjs';
    _stateMerkleProofInputs[2] = 'test/upgrades/leaves_and_roots.csv';
    _stateMerkleProofInputs[3] = vm.toString(_commitmentHash);
    bytes memory _stateMerkleProof = vm.ffi(_stateMerkleProofInputs);

    // Create a single-leaf ASP tree with only our label
    uint256[] memory _leaves = new uint256[](1);
    _leaves[0] = _label;
    bytes memory _aspMerkleProof = _generateMerkleProofMemory(_leaves, _label);

    (uint256 _aspRoot,,) = abi.decode(_aspMerkleProof, (uint256, uint256, uint256[]));

    // Push the new root including our label
    vm.prank(postman);
    proxy.updateRoot(_aspRoot, 'ipfs_cid_ipfs_cid_ipfs_cid_ipfs_cid_ipfs_cid_ipfs_cid');

    // Prepare withdrawal for relayer with encoded relay fees data
    IPrivacyPool.Withdrawal memory _withdrawal =
      IPrivacyPool.Withdrawal({processooor: address(proxy), data: abi.encode(_recipient, _relayer, 100)});

    // Compute context for proof gen
    _context = uint256(keccak256(abi.encode(_withdrawal, ethPool.SCOPE()))) % Constants.SNARK_SCALAR_FIELD;

    // Generate Withdrawal proof
    string[] memory _inputs = new string[](12);
    _inputs[0] = vm.toString(_value);
    _inputs[1] = vm.toString(_label);
    _inputs[2] = vm.toString(_genSecretBySeed('nullifier'));
    _inputs[3] = vm.toString(_genSecretBySeed('secret'));
    _inputs[4] = vm.toString(_genSecretBySeed('nullifier_2'));
    _inputs[5] = vm.toString(_genSecretBySeed('secret_2'));
    _inputs[6] = vm.toString(uint256(5 ether)); // <--- withdrawn value
    _inputs[7] = vm.toString(_context);
    _inputs[8] = vm.toString(_stateMerkleProof);
    _inputs[9] = vm.toString(uint256(11));
    _inputs[10] = vm.toString(_aspMerkleProof);
    _inputs[11] = vm.toString(uint256(11));

    string[] memory _scriptArgs = new string[](2);
    _scriptArgs[0] = 'node';
    _scriptArgs[1] = 'test/helper/WithdrawalProofGenerator.mjs';
    bytes memory _proofData = vm.ffi(_concat(_scriptArgs, _inputs));

    ProofLib.WithdrawProof memory _proof = abi.decode(_proofData, (ProofLib.WithdrawProof));

    // Fetch recipient balance before
    uint256 _recipientBalanceBefore = _recipient.balance;

    // Relay withdrawal as relayer
    vm.prank(_relayer);
    proxy.relay(_withdrawal, _proof, ethPool.SCOPE());

    // Check the balance has correctly changed
    uint256 _withdrawnAmount = _deductFee(5 ether, _maxRelayFeeBPSFromConfig);
    assertEq(_recipientBalanceBefore + _withdrawnAmount, _recipient.balance);
  }

  /**
   * @notice Test that a user can deposit and partially withdraw directly
   */
  function test_DepositAndWithdrawDirectly() public {
    uint256 _depositAmount = 10 ether;

    // Calculate deposited amount after configured fees
    _value = _deductFee(_depositAmount, _vettingFeeBPSFromConfig);

    // Deal user
    vm.deal(_user, _depositAmount);

    // Compute precommitment
    _nullifier = _genSecretBySeed('nullifier');
    _secret = _genSecretBySeed('secret');
    _precommitment = _hashPrecommitment(_nullifier, _secret);

    // Precalculate label
    uint256 _currentNonce = ethPool.nonce();
    _label = uint256(keccak256(abi.encodePacked(ethPool.SCOPE(), ++_currentNonce))) % Constants.SNARK_SCALAR_FIELD;

    // Deposit
    vm.prank(_user);
    uint256 _commitmentHash = proxy.deposit{value: _depositAmount}(_precommitment);

    // Generate the state merkle proof with the fork state tree and the new leaf (commitment hash)
    string[] memory _stateMerkleProofInputs = new string[](4);
    _stateMerkleProofInputs[0] = 'node';
    _stateMerkleProofInputs[1] = 'test/helper/MerkleProofFromFile.mjs';
    _stateMerkleProofInputs[2] = 'test/upgrades/leaves_and_roots.csv';
    _stateMerkleProofInputs[3] = vm.toString(_commitmentHash);

    bytes memory _stateMerkleProof = vm.ffi(_stateMerkleProofInputs);

    // Create a single-leaf ASP tree with only our label
    uint256[] memory _leaves = new uint256[](1);
    _leaves[0] = _label;
    bytes memory _aspMerkleProof = _generateMerkleProofMemory(_leaves, _label);

    (uint256 _aspRoot,,) = abi.decode(_aspMerkleProof, (uint256, uint256, uint256[]));

    // Push the new root including our label
    vm.prank(postman);
    proxy.updateRoot(_aspRoot, 'ipfs_cid_ipfs_cid_ipfs_cid_ipfs_cid_ipfs_cid_ipfs_cid');

    // Prepare withdrawal without fee data and `recipient` as processooor
    IPrivacyPool.Withdrawal memory _withdrawal =
      IPrivacyPool.Withdrawal({processooor: _recipient, data: abi.encode('')});

    // Calculate context for proof gen
    _context = uint256(keccak256(abi.encode(_withdrawal, ethPool.SCOPE()))) % Constants.SNARK_SCALAR_FIELD;

    string[] memory _inputs = new string[](12);
    _inputs[0] = vm.toString(_value);
    _inputs[1] = vm.toString(_label);
    _inputs[2] = vm.toString(_genSecretBySeed('nullifier'));
    _inputs[3] = vm.toString(_genSecretBySeed('secret'));
    _inputs[4] = vm.toString(_genSecretBySeed('nullifier_2'));
    _inputs[5] = vm.toString(_genSecretBySeed('secret_2'));
    _inputs[6] = vm.toString(uint256(5 ether)); // <--- withdrawn value
    _inputs[7] = vm.toString(_context);
    _inputs[8] = vm.toString(_stateMerkleProof);
    _inputs[9] = vm.toString(uint256(11));
    _inputs[10] = vm.toString(_aspMerkleProof);
    _inputs[11] = vm.toString(uint256(11));

    // Call the ProofGenerator script using node
    string[] memory _scriptArgs = new string[](2);
    _scriptArgs[0] = 'node';
    _scriptArgs[1] = 'test/helper/WithdrawalProofGenerator.mjs';
    bytes memory _proofData = vm.ffi(_concat(_scriptArgs, _inputs));

    ProofLib.WithdrawProof memory _proof = abi.decode(_proofData, (ProofLib.WithdrawProof));

    uint256 _recipientBalanceBefore = _recipient.balance;

    vm.prank(_recipient);
    ethPool.withdraw(_withdrawal, _proof);

    assertEq(_recipientBalanceBefore + 5 ether, _recipient.balance);
  }

  /**
   * @notice Test that a user can deposit, partially withdraw and ragequit
   */
  function test_DepositWithdrawAndRagequit() public {
    uint256 _depositAmount = 5 ether;

    // Calculate deposited amount after configured fees
    _value = _deductFee(_depositAmount, _vettingFeeBPSFromConfig);

    // Deal user
    vm.deal(_user, _depositAmount);

    // Compute precommitment
    _nullifier = _genSecretBySeed('nullifier');
    _secret = _genSecretBySeed('secret');
    _precommitment = _hashPrecommitment(_nullifier, _secret);

    // Precalculate label
    uint256 _currentNonce = ethPool.nonce();
    _label = uint256(keccak256(abi.encodePacked(ethPool.SCOPE(), ++_currentNonce))) % Constants.SNARK_SCALAR_FIELD;

    // Deposit
    vm.prank(_user);
    uint256 _commitmentHash = proxy.deposit{value: _depositAmount}(_precommitment);

    // Generate the state merkle proof with the fork state tree and the new leaf (commitment hash)
    string[] memory _stateMerkleProofInputs = new string[](4);
    _stateMerkleProofInputs[0] = 'node';
    _stateMerkleProofInputs[1] = 'test/helper/MerkleProofFromFile.mjs';
    _stateMerkleProofInputs[2] = 'test/upgrades/leaves_and_roots.csv';
    _stateMerkleProofInputs[3] = vm.toString(_commitmentHash);

    bytes memory _stateMerkleProof = vm.ffi(_stateMerkleProofInputs);

    // Create a single-leaf ASP tree with only our label
    uint256[] memory _leaves = new uint256[](1);
    _leaves[0] = _label;
    bytes memory _aspMerkleProof = _generateMerkleProofMemory(_leaves, _label);
    (uint256 _aspRoot,,) = abi.decode(_aspMerkleProof, (uint256, uint256, uint256[]));

    // Push new root with our label
    vm.prank(postman);
    proxy.updateRoot(_aspRoot, 'ipfs_cid_ipfs_cid_ipfs_cid_ipfs_cid_ipfs_cid_ipfs_cid');

    // Prepare direct withdrawal
    IPrivacyPool.Withdrawal memory _withdrawal =
      IPrivacyPool.Withdrawal({processooor: _recipient, data: abi.encode('')});

    // Compute context for proof gen
    _context = uint256(keccak256(abi.encode(_withdrawal, ethPool.SCOPE()))) % Constants.SNARK_SCALAR_FIELD;

    // Generate Withdrawal proof
    string[] memory _inputs = new string[](12);
    _inputs[0] = vm.toString(_value);
    _inputs[1] = vm.toString(_label);
    _inputs[2] = vm.toString(_genSecretBySeed('nullifier'));
    _inputs[3] = vm.toString(_genSecretBySeed('secret'));
    _inputs[4] = vm.toString(_genSecretBySeed('nullifier_2'));
    _inputs[5] = vm.toString(_genSecretBySeed('secret_2'));
    _inputs[6] = vm.toString(uint256(2 ether)); // <--- withdrawn value
    _inputs[7] = vm.toString(_context);
    _inputs[8] = vm.toString(_stateMerkleProof);
    _inputs[9] = vm.toString(uint256(11));
    _inputs[10] = vm.toString(_aspMerkleProof);
    _inputs[11] = vm.toString(uint256(11));

    string[] memory _scriptArgs = new string[](2);
    _scriptArgs[0] = 'node';
    _scriptArgs[1] = 'test/helper/WithdrawalProofGenerator.mjs';
    bytes memory _proofData = vm.ffi(_concat(_scriptArgs, _inputs));

    _withdrawProof = abi.decode(_proofData, (ProofLib.WithdrawProof));

    // Fetch recipient balance before withdrawal
    uint256 _recipientBalanceBefore = _recipient.balance;

    // Successfully withdraw
    vm.prank(_recipient);
    ethPool.withdraw(_withdrawal, _withdrawProof);

    // Check balance was correctly updated
    assertEq(_recipientBalanceBefore + 2 ether, _recipient.balance, 'Recipient balance mismatch');
    _value -= 2 ether;

    // Generate ragequit proof
    _ragequitProof =
      _generateRagequitProof(_value, _label, _genSecretBySeed('nullifier_2'), _genSecretBySeed('secret_2'));

    // Fetch user balance before ragequitting
    uint256 _userBalanceBefore = _user.balance;

    // Call `ragequit` as original depositor
    vm.prank(_user);
    ethPool.ragequit(_ragequitProof);

    // Check balance was correctly updated
    assertEq(_userBalanceBefore + _value, _user.balance, 'User balance mismatch');
  }

  /**
   * @notice Test that a user can deposit and completely ragequit
   */
  function test_DepositAndRagequit() public {
    uint256 _depositAmount = 2 ether;

    // Calculate deposited amount after configured fees
    _value = _deductFee(_depositAmount, _vettingFeeBPSFromConfig);

    // Deal user
    vm.deal(_user, _depositAmount);

    // Compute precommitment
    _nullifier = _genSecretBySeed('nullifier');
    _secret = _genSecretBySeed('secret');
    _precommitment = _hashPrecommitment(_nullifier, _secret);

    // Precompute label
    uint256 _currentNonce = ethPool.nonce();
    _label = uint256(keccak256(abi.encodePacked(ethPool.SCOPE(), ++_currentNonce))) % Constants.SNARK_SCALAR_FIELD;

    // Deposit
    vm.prank(_user);
    proxy.deposit{value: _depositAmount}(_precommitment);

    // Don't approve anything ASP-wise

    // Generate ragequit proof
    ProofLib.RagequitProof memory _proof = _generateRagequitProof(_value, _label, _nullifier, _secret);

    // Fetch user balance before ragequitting
    uint256 _userBalanceBefore = _user.balance;

    // Ragequit full commitment as the original depositor
    vm.prank(_user);
    ethPool.ragequit(_proof);

    // Check the balance was correctly updated
    assertEq(_userBalanceBefore + _value, _user.balance, 'User balance mismatch');
  }
}

/**
 * @dev Testing a deposit+withdrawal with the upgrade in between
 */
contract EntrypointBeforeAndAfterIntegration is Test, IntegrationUtils, MainnetEnvironment {
  uint256 internal _value;
  uint256 internal _label;
  uint256 internal _precommitment;
  uint256 internal _nullifier;
  uint256 internal _secret;
  uint256 internal _context;
  uint256 internal _vettingFeeBPS;

  address internal _user = makeAddr('user');
  address internal _recipient = makeAddr('recipient');
  bytes32 internal constant _IMPLEMENTATION_SLOT = 0x360894a13ba1a3210667c828492db98dca3e2076cc3735a920a3ca505d382bbc;

  function setUp() public {
    // Fork mainnet without upgrading
    vm.createSelectFork(vm.rpcUrl('mainnet'), _FORK_BLOCK);

    // Fetch vetting fee for value calculation
    (,, _vettingFeeBPS,) = proxy.assetConfig(IERC20(Constants.NATIVE_ASSET));
  }

  function test_DepositAndWithdrawMidUpgrade() public {
    uint256 _depositAmount = 2 ether;

    // Calculate deposited amount after configured fees
    _value = _deductFee(_depositAmount, _vettingFeeBPS);

    // Deal user
    vm.deal(_user, _depositAmount);

    // Compute precommitment
    _nullifier = _genSecretBySeed('nullifier');
    _secret = _genSecretBySeed('secret');
    _precommitment = _hashPrecommitment(_nullifier, _secret);

    // Precalculate label
    uint256 _currentNonce = ethPool.nonce();
    _label = uint256(keccak256(abi.encodePacked(ethPool.SCOPE(), ++_currentNonce))) % Constants.SNARK_SCALAR_FIELD;

    // Deposit
    vm.prank(_user);
    uint256 _commitmentHash = proxy.deposit{value: _depositAmount}(_precommitment);

    //////////////////////////////////////// CONTRACT UPRGADE : START ////////////////////////////////////////

    // Deploy new implementation
    Entrypoint _newImplementation = new Entrypoint();

    // Upgrade Entrypoint
    vm.prank(owner);
    proxy.upgradeToAndCall(address(_newImplementation), '');

    // Check the implementation was successfully updated in the proxy storage
    bytes32 _implementationAddressRaw = vm.load(address(proxy), _IMPLEMENTATION_SLOT);
    assertEq(
      address(uint160(uint256(_implementationAddressRaw))),
      address(_newImplementation),
      "Implementation addresses don't match"
    );

    ////////////////////////////////////// CONTRACT UPRGADE : END ////////////////////////////////////////

    // Generate the state merkle proof with the fork state tree and the new leaf (commitment hash)
    string[] memory _stateMerkleProofInputs = new string[](4);
    _stateMerkleProofInputs[0] = 'node';
    _stateMerkleProofInputs[1] = 'test/helper/MerkleProofFromFile.mjs';
    _stateMerkleProofInputs[2] = 'test/upgrades/leaves_and_roots.csv';
    _stateMerkleProofInputs[3] = vm.toString(_commitmentHash);

    bytes memory _stateMerkleProof = vm.ffi(_stateMerkleProofInputs);

    // Create a single-leaf ASP tree with only our label
    uint256[] memory _leaves = new uint256[](1);
    _leaves[0] = _label;
    bytes memory _aspMerkleProof = _generateMerkleProofMemory(_leaves, _label);

    (uint256 _aspRoot,,) = abi.decode(_aspMerkleProof, (uint256, uint256, uint256[]));

    // Push the new root including our label
    vm.prank(postman);
    proxy.updateRoot(_aspRoot, 'ipfs_cid_ipfs_cid_ipfs_cid_ipfs_cid_ipfs_cid_ipfs_cid');

    // Prepare withdrawal without fee data and `recipient` as processooor
    IPrivacyPool.Withdrawal memory _withdrawal =
      IPrivacyPool.Withdrawal({processooor: _recipient, data: abi.encode('')});

    // Calculate context for proof gen
    _context = uint256(keccak256(abi.encode(_withdrawal, ethPool.SCOPE()))) % Constants.SNARK_SCALAR_FIELD;

    string[] memory _inputs = new string[](12);
    _inputs[0] = vm.toString(_value);
    _inputs[1] = vm.toString(_label);
    _inputs[2] = vm.toString(_genSecretBySeed('nullifier'));
    _inputs[3] = vm.toString(_genSecretBySeed('secret'));
    _inputs[4] = vm.toString(_genSecretBySeed('nullifier_2'));
    _inputs[5] = vm.toString(_genSecretBySeed('secret_2'));
    _inputs[6] = vm.toString(uint256(1 ether)); // <--- withdrawn value
    _inputs[7] = vm.toString(_context);
    _inputs[8] = vm.toString(_stateMerkleProof);
    _inputs[9] = vm.toString(uint256(11));
    _inputs[10] = vm.toString(_aspMerkleProof);
    _inputs[11] = vm.toString(uint256(11));

    // Call the ProofGenerator script using node
    string[] memory _scriptArgs = new string[](2);
    _scriptArgs[0] = 'node';
    _scriptArgs[1] = 'test/helper/WithdrawalProofGenerator.mjs';
    bytes memory _proofData = vm.ffi(_concat(_scriptArgs, _inputs));

    ProofLib.WithdrawProof memory _proof = abi.decode(_proofData, (ProofLib.WithdrawProof));

    uint256 _recipientBalanceBefore = _recipient.balance;

    // Successfully withdraw after upgrade
    vm.prank(_recipient);
    ethPool.withdraw(_withdrawal, _proof);

    assertEq(_recipientBalanceBefore + 1 ether, _recipient.balance);
  }
}
