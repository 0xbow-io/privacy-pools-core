// SPDX-License-Identifier: Apache-2.0
pragma solidity 0.8.28;

/*

Made with ♥ for 0xBow by

░██╗░░░░░░░██╗░█████╗░███╗░░██╗██████╗░███████╗██████╗░██╗░░░░░░█████╗░███╗░░██╗██████╗░
░██║░░██╗░░██║██╔══██╗████╗░██║██╔══██╗██╔════╝██╔══██╗██║░░░░░██╔══██╗████╗░██║██╔══██╗
░╚██╗████╗██╔╝██║░░██║██╔██╗██║██║░░██║█████╗░░██████╔╝██║░░░░░███████║██╔██╗██║██║░░██║
░░████╔═████║░██║░░██║██║╚████║██║░░██║██╔══╝░░██╔══██╗██║░░░░░██╔══██║██║╚████║██║░░██║
░░╚██╔╝░╚██╔╝░╚█████╔╝██║░╚███║██████╔╝███████╗██║░░██║███████╗██║░░██║██║░╚███║██████╔╝
░░░╚═╝░░░╚═╝░░░╚════╝░╚═╝░░╚══╝╚═════╝░╚══════╝╚═╝░░╚═╝╚══════╝╚═╝░░╚═╝╚═╝░░╚══╝╚═════╝░

https://defi.sucks/

*/

import {PoseidonT4} from 'poseidon/PoseidonT4.sol';

import {Constants} from './lib/Constants.sol';
import {ProofLib} from './lib/ProofLib.sol';

import {IPrivacyPool} from 'interfaces/IPrivacyPool.sol';

import {State} from './State.sol';

/**
 * @title PrivacyPool
 * @notice Allows publicly depositing and privately withdrawing funds.
 * @dev Withdrawals require a valid proof of being approved by an ASP.
 * @dev Deposits can be irreversibly suspended by the Entrypoint, while withdrawals can't.
 */
abstract contract PrivacyPool is State, IPrivacyPool {
  using ProofLib for ProofLib.WithdrawProof;
  using ProofLib for ProofLib.RagequitProof;

  /**
   * @notice Does a series of sanity checks on the proof public signals
   * @param _withdrawal The withdrawal data structure containing withdrawal details
   * @param _proof The withdrawal proof data structure containing proof details
   */
  modifier validWithdrawal(Withdrawal memory _withdrawal, ProofLib.WithdrawProof memory _proof) {
    // Check caller is the allowed processooor
    if (msg.sender != _withdrawal.processooor) revert InvalidProcessooor();

    // Check the context matches to ensure its integrity
    if (_proof.context() != uint256(keccak256(abi.encode(_withdrawal, SCOPE))) % Constants.SNARK_SCALAR_FIELD) {
      revert ContextMismatch();
    }

    // Check the tree depth signals are less than the max tree depth
    if (_proof.stateTreeDepth() > MAX_TREE_DEPTH || _proof.ASPTreeDepth() > MAX_TREE_DEPTH) revert InvalidTreeDepth();

    // Check the state root is known
    if (!_isKnownRoot(_proof.stateRoot())) revert UnknownStateRoot();

    // Check the ASP root is the latest
    if (_proof.ASPRoot() != ENTRYPOINT.latestRoot()) revert IncorrectASPRoot();
    _;
  }

  /**
   * @notice Initializes the contract state addresses
   * @param _entrypoint Address of the Entrypoint that operates this pool
   * @param _withdrawalVerifier Address of the Groth16 verifier for withdrawal proofs
   * @param _ragequitVerifier Address of the Groth16 verifier for ragequit proofs
   * @param _asset Address of the pool asset
   */
  constructor(
    address _entrypoint,
    address _withdrawalVerifier,
    address _ragequitVerifier,
    address _asset
  ) State(_asset, _entrypoint, _withdrawalVerifier, _ragequitVerifier) {}

  /*///////////////////////////////////////////////////////////////
                             USER METHODS 
  //////////////////////////////////////////////////////////////*/

  /// @inheritdoc IPrivacyPool
  function deposit(
    address _depositor,
    uint256 _value,
    uint256 _precommitmentHash
  ) external payable onlyEntrypoint returns (uint256 _commitment) {
    // Check deposits are enabled
    if (dead) revert PoolIsDead();

    if (_value >= type(uint128).max) revert InvalidDepositValue();

    // Compute label
    uint256 _label = uint256(keccak256(abi.encodePacked(SCOPE, ++nonce))) % Constants.SNARK_SCALAR_FIELD;
    // Store depositor
    depositors[_label] = _depositor;

    // Compute commitment hash
    _commitment = PoseidonT4.hash([_value, _label, _precommitmentHash]);

    // Insert commitment in state (revert if already present)
    _insert(_commitment);

    // Pull funds from caller
    _pull(msg.sender, _value);

    emit Deposited(_depositor, _commitment, _label, _value, _precommitmentHash);
  }

  /// @inheritdoc IPrivacyPool
  function withdraw(
    Withdrawal memory _withdrawal,
    ProofLib.WithdrawProof memory _proof
  ) external validWithdrawal(_withdrawal, _proof) {
    // Verify proof with Groth16 verifier
    if (!WITHDRAWAL_VERIFIER.verifyProof(_proof.pA, _proof.pB, _proof.pC, _proof.pubSignals)) revert InvalidProof();

    // Mark existing commitment nullifier as spent
    _spend(_proof.existingNullifierHash());

    // Insert new commitment in state
    _insert(_proof.newCommitmentHash());

    // Transfer out funds to procesooor
    _push(_withdrawal.processooor, _proof.withdrawnValue());

    emit Withdrawn(
      _withdrawal.processooor, _proof.withdrawnValue(), _proof.existingNullifierHash(), _proof.newCommitmentHash()
    );
  }

  /// @inheritdoc IPrivacyPool
  function ragequit(ProofLib.RagequitProof memory _proof) external {
    // Check if caller is original depositor
    uint256 _label = _proof.label();
    if (depositors[_label] != msg.sender) revert OnlyOriginalDepositor();

    // Verify proof with Groth16 verifier
    if (!RAGEQUIT_VERIFIER.verifyProof(_proof.pA, _proof.pB, _proof.pC, _proof.pubSignals)) revert InvalidProof();

    // Check commitment exists in state
    if (!_isInState(_proof.commitmentHash())) revert InvalidCommitment();

    // Mark existing commitment nullifier as spent
    _spend(_proof.nullifierHash());

    // Transfer out funds to ragequitter
    _push(msg.sender, _proof.value());

    emit Ragequit(msg.sender, _proof.commitmentHash(), _proof.label(), _proof.value());
  }

  /*///////////////////////////////////////////////////////////////
                             WIND DOWN
  //////////////////////////////////////////////////////////////*/

  /// @inheritdoc IPrivacyPool
  function windDown() external onlyEntrypoint {
    // Check pool is still alive
    if (dead) revert PoolIsDead();

    // Die
    dead = true;

    emit PoolDied();
  }

  /*///////////////////////////////////////////////////////////////
                          ASSET OVERRIDES
  //////////////////////////////////////////////////////////////*/

  /**
   * @notice Handle receiving an asset
   * @dev To be implemented by an asset specific contract
   * @param _sender The address of the user sending funds
   * @param _value The amount of asset being received
   */
  function _pull(address _sender, uint256 _value) internal virtual;

  /**
   * @notice Handle sending an asset
   * @dev To be implemented by an asset specific contract
   * @param _recipient The address of the user receiving funds
   * @param _value The amount of asset being sent
   */
  function _push(address _recipient, uint256 _value) internal virtual;
}
