// SPDX-License-Identifier: Apache-2.0
pragma solidity 0.8.28;

import {ProofLib} from 'contracts/lib/ProofLib.sol';
import {IPrivacyPool} from 'interfaces/IPrivacyPool.sol';

interface IBatchRelayer {
  /*///////////////////////////////////////////////////////////////
                              STRUCTS
  //////////////////////////////////////////////////////////////*/

  /**
   * @notice Struct for the batch relay data
   * @param recipient The intended receiver of funds
   * @param feeRecipient The fee receiver. Chosen by the relayer, may be the same address initiating the transaction.
   * @param relayFeeBPS The fee paid to `feeRecipient`, specified in basis points
   * @param batchSize The number of withdrawals expected
   */
  struct BatchRelayData {
    address recipient;
    address feeRecipient;
    uint256 relayFeeBPS;
    uint8 batchSize;
  }

  /*///////////////////////////////////////////////////////////////
                              EVENTS
  //////////////////////////////////////////////////////////////*/

  /**
   * @notice Event emitted when a batch is relayed
   * @param _pool The pool that was withdrawn from
   * @param _recipient The recipient of the funds. May not be the relayer's address
   * @param _feeRecipient The fee recipient
   * @param _amountAfterFees The amount sent to intended recipient after fees are deducted
   * @param _fee The fee that was deducted
   */
  event BatchRelayed(
    IPrivacyPool indexed _pool,
    address indexed _recipient,
    address indexed _feeRecipient,
    uint256 _amountAfterFees,
    uint256 _fee
  );

  /*///////////////////////////////////////////////////////////////
                              ERRORS
  //////////////////////////////////////////////////////////////*/

  /**
   * @notice Error thrown when the address is zero
   */
  error ZeroAddress();

  /**
   * @notice Error thrown when the native asset transfer fails
   */
  error NativeAssetTransferFailed();

  /**
   * @notice Error thrown when the proofs array is empty
   */
  error EmptyProofs();

  /**
   * @notice Thrown when `relayFeeBPS` is greater than `MAX_RELAY_FEE_BPS`
   */
  error InvalidRelayFeeBPS();

  /**
   * @notice Error thrown when the contract balance has changed after the batch relay
   */
  error BalanceChanged();

  /**
   * @notice Error thrown when the batch size is different than the number of proofs
   */
  error InvalidBatchSize();

  /*///////////////////////////////////////////////////////////////
                              FUNCTIONS
  //////////////////////////////////////////////////////////////*/

  /// @notice Batch relays a set of withdrawals
  /// @param _pool The pool to withdraw from
  /// @param _withdrawal The withdrawal to relay (identical across all notes)
  /// @param _proofs The proofs for the withdrawals
  function batchRelay(
    IPrivacyPool _pool,
    IPrivacyPool.Withdrawal memory _withdrawal,
    ProofLib.WithdrawProof[] memory _proofs
  ) external;

  /*///////////////////////////////////////////////////////////////
                              STORAGE
  //////////////////////////////////////////////////////////////*/

  /**
   * @notice Function to get the max relay fee BPS
   * @dev set at construction time and immutable
   * @return _maxRelayFeeBPS The max relay fee BPS
   */
  function MAX_RELAY_FEE_BPS() external view returns (uint256 _maxRelayFeeBPS);
}
