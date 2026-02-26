// SPDX-License-Identifier: Apache-2.0
pragma solidity 0.8.28;

import {ProofLib} from '../contracts/lib/ProofLib.sol';
import {IState} from 'interfaces/IState.sol';

/**
 * @title IPrivacyPool
 * @notice Interface for the PrivacyPool contract
 */
interface IPrivacyPool is IState {
  /*///////////////////////////////////////////////////////////////
                              STRUCTS
  //////////////////////////////////////////////////////////////*/

  /**
   * @notice Struct for the withdrawal request
   * @dev The integrity of this data is ensured by the `context` signal in the proof
   * @param processooor The allowed address to process the withdrawal
   * @param data Encoded arbitrary data used by the Entrypoint
   */
  struct Withdrawal {
    address processooor;
    bytes data;
  }

  /*///////////////////////////////////////////////////////////////
                              EVENTS
  //////////////////////////////////////////////////////////////*/

  /**
   * @notice Emitted when making a user deposit
   * @param _depositor The address of the depositor
   * @param _commitment The commitment hash
   * @param _label The deposit generated label
   * @param _value The deposited amount
   * @param _precommitmentHash The deposit precommitment hash
   */
  event Deposited(
    address indexed _depositor, uint256 _commitment, uint256 _label, uint256 _value, uint256 _precommitmentHash
  );

  /**
   * @notice Emitted when processing a withdrawal
   * @param _processooor The address which processed the withdrawal
   * @param _value The withdrawn amount
   * @param _spentNullifier The spent nullifier
   * @param _newCommitment The new commitment hash
   */
  event Withdrawn(address indexed _processooor, uint256 _value, uint256 _spentNullifier, uint256 _newCommitment);

  /**
   * @notice Emitted when ragequitting a commitment
   * @param _ragequitter The address who ragequit
   * @param _commitment The ragequit commitment
   * @param _label The commitment label
   * @param _value The ragequit amount
   */
  event Ragequit(address indexed _ragequitter, uint256 _commitment, uint256 _label, uint256 _value);

  /**
   * @notice Emitted irreversibly suspending deposits
   */
  event PoolDied();

  /*///////////////////////////////////////////////////////////////
                              ERRORS
  //////////////////////////////////////////////////////////////*/

  /**
   * @notice Thrown when failing to verify a withdrawal proof through the Groth16 verifier
   */
  error InvalidProof();

  /**
   * @notice Thrown when trying to spend a commitment that does not exist in the state
   */
  error InvalidCommitment();

  /**
   * @notice Thrown when calling `withdraw` while not being the allowed processooor
   */
  error InvalidProcessooor();

  /**
   * @notice Thrown when calling `withdraw` with a ASP or state tree depth greater or equal than the max tree depth
   */
  error InvalidTreeDepth();

  /**
   * @notice Thrown when trying to deposit an amount higher than 2**128
   */
  error InvalidDepositValue();

  /**
   * @notice Thrown when providing an invalid scope for this pool
   */
  error ScopeMismatch();

  /**
   * @notice Thrown when providing an invalid context for the pool and withdrawal
   */
  error ContextMismatch();

  /**
   * @notice Thrown when providing an unknown or outdated state root
   */
  error UnknownStateRoot();

  /**
   * @notice Thrown when providing an unknown or outdated ASP root
   */
  error IncorrectASPRoot();

  /**
   * @notice Thrown when trying to ragequit while not being the original depositor
   */
  error OnlyOriginalDepositor();

  /*///////////////////////////////////////////////////////////////
                              LOGIC
  //////////////////////////////////////////////////////////////*/

  /**
   * @notice Deposit funds into the Privacy Pool
   * @dev Only callable by the Entrypoint
   * @param _depositor The depositor address
   * @param _value The value being deposited
   * @param _precommitment The precommitment hash
   * @return _commitment The commitment hash
   */
  function deposit(
    address _depositor,
    uint256 _value,
    uint256 _precommitment
  ) external payable returns (uint256 _commitment);

  /**
   * @notice Privately withdraw funds by spending an existing commitment
   * @param _w The `Withdrawal` struct
   * @param _p The `WithdrawProof` struct
   */
  function withdraw(Withdrawal memory _w, ProofLib.WithdrawProof memory _p) external;

  /**
   * @notice Publicly withdraw funds to original depositor without exposing secrets
   * @dev Only callable by the original depositor
   * @param _p the `RagequitProof` struct
   */
  function ragequit(ProofLib.RagequitProof memory _p) external;

  /**
   * @notice Irreversibly suspends deposits
   * @dev Withdrawals can never be disabled
   * @dev Only callable by the Entrypoint
   */
  function windDown() external;
}

/**
 * @title IPrivacyPoolSimple
 * @notice Interface for the PrivacyPool native asset implementation
 */
interface IPrivacyPoolSimple is IPrivacyPool {
  /*///////////////////////////////////////////////////////////////
                              ERRORS
  //////////////////////////////////////////////////////////////*/

  /**
   * @notice Thrown when sending less amount of native asset than required
   */
  error InsufficientValue();

  /**
   * @notice Thrown when failing to send native asset to an account
   */
  error FailedToSendNativeAsset();
}

/**
 * @title IPrivacyPoolComplex
 * @notice Interface for the PrivacyPool ERC20 implementation
 */
interface IPrivacyPoolComplex is IPrivacyPool {
  /*///////////////////////////////////////////////////////////////
                              ERRORS
  //////////////////////////////////////////////////////////////*/

  /**
   * @notice Thrown when sending sending any amount of native asset
   */
  error NativeAssetNotAccepted();

  /**
   * @notice Thrown when trying to set up a complex pool with the native asset
   */
  error NativeAssetNotSupported();
}
