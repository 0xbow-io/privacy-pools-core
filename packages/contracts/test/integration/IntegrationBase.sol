// SPDX-License-Identifier: Apache-2.0
pragma solidity 0.8.28;

import {Entrypoint, IEntrypoint} from 'contracts/Entrypoint.sol';
import {IPrivacyPool} from 'contracts/PrivacyPool.sol';

import {DeployLib} from 'contracts/lib/DeployLib.sol';

import {PrivacyPoolComplex} from 'contracts/implementations/PrivacyPoolComplex.sol';
import {PrivacyPoolSimple} from 'contracts/implementations/PrivacyPoolSimple.sol';

import {CommitmentVerifier} from 'contracts/verifiers/CommitmentVerifier.sol';
import {WithdrawalVerifier} from 'contracts/verifiers/WithdrawalVerifier.sol';

import {ERC1967Proxy} from '@oz/proxy/ERC1967/ERC1967Proxy.sol';
import {UnsafeUpgrades} from '@upgrades/Upgrades.sol';

import {IntegrationUtils} from './Utils.sol';
import {IERC20} from '@oz/interfaces/IERC20.sol';

import {ProofLib} from 'contracts/lib/ProofLib.sol';
import {InternalLeanIMT, LeanIMTData} from 'lean-imt/InternalLeanIMT.sol';

import {PoseidonT2} from 'poseidon/PoseidonT2.sol';
import {PoseidonT3} from 'poseidon/PoseidonT3.sol';
import {PoseidonT4} from 'poseidon/PoseidonT4.sol';

import {ICreateX} from 'interfaces/external/ICreateX.sol';
import {Constants} from 'test/helper/Constants.sol';

contract IntegrationBase is IntegrationUtils {
  using InternalLeanIMT for LeanIMTData;

  /*///////////////////////////////////////////////////////////////
                      STATE VARIABLES 
  //////////////////////////////////////////////////////////////*/

  uint256 internal constant _FORK_BLOCK = 18_920_905;

  // Core protocol contracts
  Entrypoint internal _entrypoint;
  PrivacyPoolSimple internal _ethPool;
  PrivacyPoolComplex internal _daiPool;

  // Groth16 Verifiers
  CommitmentVerifier internal _commitmentVerifier;
  WithdrawalVerifier internal _withdrawalVerifier;

  // CreateX Singleton
  ICreateX internal constant _CREATEX = ICreateX(0xba5Ed099633D3B313e4D5F7bdc1305d3c28ba5Ed);

  // Assets
  IERC20 internal constant _DAI = IERC20(0x6B175474E89094C44Da98b954EedeAC495271d0F);
  IERC20 internal _ETH = IERC20(Constants.NATIVE_ASSET);

  // Snark Scalar Field
  uint256 public constant SNARK_SCALAR_FIELD =
    21_888_242_871_839_275_222_246_405_745_257_275_088_548_364_400_416_034_343_698_204_186_575_808_495_617;

  // Pranked addresses
  address internal immutable _OWNER = makeAddr('OWNER');
  address internal immutable _POSTMAN = makeAddr('POSTMAN');
  address internal immutable _RELAYER = makeAddr('RELAYER');
  address internal immutable _ALICE = makeAddr('ALICE');
  address internal immutable _BOB = makeAddr('BOB');

  // Asset parameters
  uint256 internal constant _MIN_DEPOSIT = 1;
  uint256 internal constant _VETTING_FEE_BPS = 100; // 1%
  uint256 internal constant _MAX_RELAY_FEE_BPS = 100; // 1%
  uint256 internal constant _RELAY_FEE_BPS = 100; // 1%

  uint256 internal constant _DEFAULT_NULLIFIER = uint256(keccak256('NULLIFIER')) % Constants.SNARK_SCALAR_FIELD;
  uint256 internal constant _DEFAULT_SECRET = uint256(keccak256('SECRET')) % Constants.SNARK_SCALAR_FIELD;
  uint256 internal constant _DEFAULT_ASP_ROOT = uint256(keccak256('ASP_ROOT')) % Constants.SNARK_SCALAR_FIELD;
  uint256 internal constant _DEFAULT_NEW_COMMITMENT_HASH =
    uint256(keccak256('NEW_COMMITMENT_HASH')) % Constants.SNARK_SCALAR_FIELD;
  bytes4 public constant NONE = 0xb4dc0dee;

  /*///////////////////////////////////////////////////////////////
                              SETUP
  //////////////////////////////////////////////////////////////*/

  //asd
  function setUp() public virtual {
    vm.createSelectFork(vm.rpcUrl('mainnet'));

    vm.startPrank(_OWNER);

    // Deploy Groth16 ragequit verifier
    _commitmentVerifier = CommitmentVerifier(
      _CREATEX.deployCreate2(
        DeployLib.salt(_OWNER, DeployLib.RAGEQUIT_VERIFIER_SALT),
        abi.encodePacked(type(CommitmentVerifier).creationCode)
      )
    );

    // Deploy Groth16 withdrawal verifier
    _withdrawalVerifier = WithdrawalVerifier(
      _CREATEX.deployCreate2(
        DeployLib.salt(_OWNER, DeployLib.WITHDRAWAL_VERIFIER_SALT),
        abi.encodePacked(type(WithdrawalVerifier).creationCode)
      )
    );

    // Deploy Entrypoint
    address _impl = address(new Entrypoint());
    bytes memory _intializationData = abi.encodeCall(Entrypoint.initialize, (_OWNER, _POSTMAN));
    address _entrypointAddr = _CREATEX.deployCreate2(
      DeployLib.salt(_OWNER, DeployLib.ENTRYPOINT_PROXY_SALT),
      abi.encodePacked(type(ERC1967Proxy).creationCode, abi.encode(_impl, _intializationData))
    );
    _entrypoint = Entrypoint(payable(_entrypointAddr));

    // Deploy ETH pool
    _ethPool = PrivacyPoolSimple(
      _CREATEX.deployCreate2(
        DeployLib.salt(_OWNER, DeployLib.SIMPLE_POOL_SALT),
        abi.encodePacked(
          type(PrivacyPoolSimple).creationCode,
          abi.encode(address(_entrypoint), address(_withdrawalVerifier), address(_commitmentVerifier))
        )
      )
    );

    // Deploy DAI pool
    _daiPool = PrivacyPoolComplex(
      _CREATEX.deployCreate2(
        DeployLib.salt(_OWNER, DeployLib.COMPLEX_POOL_SALT),
        abi.encodePacked(
          type(PrivacyPoolComplex).creationCode,
          abi.encode(address(_entrypoint), address(_withdrawalVerifier), address(_commitmentVerifier), address(_DAI))
        )
      )
    );

    // Register ETH pool
    _entrypoint.registerPool(
      IERC20(Constants.NATIVE_ASSET),
      IPrivacyPool(address(_ethPool)),
      _MIN_DEPOSIT,
      _VETTING_FEE_BPS,
      _MAX_RELAY_FEE_BPS
    );

    // Register DAI pool
    _entrypoint.registerPool(_DAI, IPrivacyPool(address(_daiPool)), _MIN_DEPOSIT, _VETTING_FEE_BPS, _MAX_RELAY_FEE_BPS);

    vm.stopPrank();
  }

  /*///////////////////////////////////////////////////////////////
                           DEPOSIT 
  //////////////////////////////////////////////////////////////*/

  function _deposit(DepositParams memory _params) internal returns (Commitment memory _commitment) {
    // Deal the asset to the depositor
    _deal(_params.depositor, _params.asset, _params.amount);

    // If not native asset, approve Entrypoint to deposit funds
    if (_params.asset != IERC20(Constants.NATIVE_ASSET)) {
      vm.prank(_params.depositor);
      _params.asset.approve(address(_entrypoint), _params.amount);
    }

    // Define pool to deposit to
    IPrivacyPool _pool = _params.asset == IERC20(Constants.NATIVE_ASSET)
      ? IPrivacyPool(address(_ethPool))
      : IPrivacyPool(address(_daiPool));

    // Fetch current nonce
    uint256 _currentNonce = _pool.nonce();

    // Compute deposit parameters
    _commitment.asset = _params.asset;
    _commitment.nullifier = _genSecretBySeed(_params.nullifier);
    _commitment.secret = _genSecretBySeed(_params.secret);
    _commitment.label =
      uint256(keccak256(abi.encodePacked(_pool.SCOPE(), ++_currentNonce))) % Constants.SNARK_SCALAR_FIELD;
    _commitment.value = _deductFee(_params.amount, _VETTING_FEE_BPS);
    _commitment.precommitment = _hashPrecommitment(_commitment.nullifier, _commitment.secret);
    _commitment.hash = _hashCommitment(_commitment.value, _commitment.label, _commitment.precommitment);

    // Calculate Entrypoint fee
    uint256 _fee = _params.amount - _commitment.value;

    // Update mirrored trees
    _insertIntoShadowMerkleTree(_commitment.hash);
    _insertIntoShadowASPMerkleTree(_commitment.label);

    // Fetch balances before deposit
    uint256 _depositorInitialBalance = _balance(_params.depositor, _params.asset);
    uint256 _entrypointInitialBalance = _balance(address(_entrypoint), _params.asset);
    uint256 _poolInitialBalance = _balance(address(_pool), _params.asset);

    // Expect Pool event emission
    vm.expectEmit(address(_pool));
    emit IPrivacyPool.Deposited(
      _params.depositor, _commitment.hash, _commitment.label, _commitment.value, _commitment.precommitment
    );

    // Expect Entrypoint event emission
    vm.expectEmit(address(_entrypoint));
    emit IEntrypoint.Deposited(_params.depositor, _pool, _commitment.hash, _commitment.value);

    // Deposit
    vm.prank(_params.depositor);
    if (_params.asset == IERC20(Constants.NATIVE_ASSET)) {
      _entrypoint.deposit{value: _params.amount}(_commitment.precommitment);
    } else {
      _entrypoint.deposit(_params.asset, _params.amount, _commitment.precommitment);
    }

    // Check balance changes
    assertEq(
      _balance(_params.depositor, _params.asset), _depositorInitialBalance - _params.amount, 'User balance mismatch'
    );
    assertEq(
      _balance(address(_entrypoint), _params.asset), _entrypointInitialBalance + _fee, 'Entrypoint balance mismatch'
    );
    assertEq(_balance(address(_pool), _params.asset), _poolInitialBalance + _commitment.value, 'Pool balance mismatch');

    // Check deposit stored values
    address _depositor = _pool.depositors(_commitment.label);
    assertEq(_depositor, _params.depositor, 'Incorrect depositor');
  }

  /*///////////////////////////////////////////////////////////////
                      WITHDRAWAL METHODS
  //////////////////////////////////////////////////////////////*/

  function _selfWithdraw(WithdrawalParams memory _params) internal returns (Commitment memory _commitment) {
    // Define pool to deposit to
    IPrivacyPool _pool = _params.commitment.asset == IERC20(Constants.NATIVE_ASSET)
      ? IPrivacyPool(address(_ethPool))
      : IPrivacyPool(address(_daiPool));

    // Build `Withdrawal` object for direct withdrawal
    IPrivacyPool.Withdrawal memory _withdrawal = IPrivacyPool.Withdrawal({processooor: _params.recipient, data: ''});

    // Withdraw
    _commitment = _withdraw(_params.recipient, _pool, _withdrawal, _params, true);
  }

  function _withdrawThroughRelayer(WithdrawalParams memory _params) internal returns (Commitment memory _commitment) {
    // Define pool to deposit to
    IPrivacyPool _pool = _params.commitment.asset == IERC20(Constants.NATIVE_ASSET)
      ? IPrivacyPool(address(_ethPool))
      : IPrivacyPool(address(_daiPool));

    // Build `Withdrawal` object for relayed withdrawal
    IPrivacyPool.Withdrawal memory _withdrawal = IPrivacyPool.Withdrawal({
      processooor: address(_entrypoint),
      data: abi.encode(_params.recipient, _RELAYER, _VETTING_FEE_BPS)
    });

    // Withdraw
    _commitment = _withdraw(_RELAYER, _pool, _withdrawal, _params, false);
  }

  function _withdraw(
    address _caller,
    IPrivacyPool _pool,
    IPrivacyPool.Withdrawal memory _withdrawal,
    WithdrawalParams memory _params,
    bool _direct
  ) internal returns (Commitment memory _commitment) {
    // Fetch balances before withdrawal
    uint256 _recipientInitialBalance = _balance(_params.recipient, _params.commitment.asset);
    uint256 _entrypointInitialBalance = _balance(address(_entrypoint), _params.commitment.asset);
    uint256 _poolInitialBalance = _balance(address(_pool), _params.commitment.asset);

    // Compute context hash
    uint256 _context = uint256(keccak256(abi.encode(_withdrawal, _pool.SCOPE()))) % SNARK_SCALAR_FIELD;

    // Compute new commitment properties
    _commitment.value = _params.commitment.value - _params.withdrawnAmount;
    _commitment.label = _params.commitment.label;
    _commitment.nullifier = _genSecretBySeed(_params.newNullifier);
    _commitment.secret = _genSecretBySeed(_params.newSecret);
    _commitment.precommitment = _hashPrecommitment(_commitment.nullifier, _commitment.secret);
    _commitment.hash = _hashCommitment(_commitment.value, _commitment.label, _commitment.precommitment);
    _commitment.asset = _params.commitment.asset;

    // Generate withdrawal proof
    ProofLib.WithdrawProof memory _proof = _generateWithdrawalProof(
      WithdrawalProofParams({
        existingCommitment: _params.commitment.hash,
        withdrawnValue: _params.withdrawnAmount,
        context: _context,
        label: _params.commitment.label,
        existingValue: _params.commitment.value,
        existingNullifier: _params.commitment.nullifier,
        existingSecret: _params.commitment.secret,
        newNullifier: _commitment.nullifier,
        newSecret: _commitment.secret
      })
    );

    uint256 _scope = _pool.SCOPE();

    // Process withdrawal
    vm.prank(_caller);
    if (_params.revertReason != NONE) vm.expectRevert(_params.revertReason);
    if (_direct) {
      _pool.withdraw(_withdrawal, _proof);
    } else {
      _entrypoint.relay(_withdrawal, _proof, _scope);
    }

    if (_params.revertReason == NONE) {
      // Check nullifier hash has been spent
      assertTrue(_pool.nullifierHashes(_proof.pubSignals[1]), 'Existing nullifier hash must be spent');

      // Insert new commitment in mirrored state tree
      _insertIntoShadowMerkleTree(_commitment.hash);

      // Discount fees if applicable
      uint256 _withdrawnAmountAfterFees =
        _direct ? _params.withdrawnAmount : _deductFee(_params.withdrawnAmount, _VETTING_FEE_BPS);

      // Check balance changes
      assertEq(
        _balance(_params.recipient, _params.commitment.asset),
        _recipientInitialBalance + _withdrawnAmountAfterFees,
        'User balance mismatch'
      );
      assertEq(
        _balance(address(_entrypoint), _params.commitment.asset),
        _entrypointInitialBalance,
        "Entrypoint balance shouldn't change"
      );
      assertEq(
        _balance(address(_pool), _params.commitment.asset),
        _poolInitialBalance - _params.withdrawnAmount,
        'Pool balance mismatch'
      );
    }
  }

  /*///////////////////////////////////////////////////////////////
                           RAGEQUIT
  //////////////////////////////////////////////////////////////*/

  function _ragequit(address _depositor, Commitment memory _commitment) internal {
    // Define pool to ragequit from
    IPrivacyPool _pool = _commitment.asset == IERC20(Constants.NATIVE_ASSET)
      ? IPrivacyPool(address(_ethPool))
      : IPrivacyPool(address(_daiPool));

    uint256 _depositorInitialBalance = _balance(_depositor, _commitment.asset);
    uint256 _entrypointInitialBalance = _balance(address(_entrypoint), _commitment.asset);
    uint256 _poolInitialBalance = _balance(address(_pool), _commitment.asset);

    // Generate ragequit proof
    ProofLib.RagequitProof memory _proof =
      _generateRagequitProof(_commitment.value, _commitment.label, _commitment.nullifier, _commitment.secret);

    // Ragequit
    vm.prank(_depositor);
    _pool.ragequit(_proof);

    // Insert new commitment in mirrored state tree
    assertTrue(_pool.nullifierHashes(_proof.pubSignals[1]), 'Existing nullifier hash must be spent');

    // Check balance changes
    assertEq(
      _balance(_depositor, _commitment.asset), _depositorInitialBalance + _commitment.value, 'User balance mismatch'
    );
    assertEq(
      _balance(address(_entrypoint), _commitment.asset),
      _entrypointInitialBalance,
      "Entrypoint balance shouldn't change"
    );
    assertEq(
      _balance(address(_pool), _commitment.asset), _poolInitialBalance - _commitment.value, 'Pool balance mismatch'
    );
  }
}
