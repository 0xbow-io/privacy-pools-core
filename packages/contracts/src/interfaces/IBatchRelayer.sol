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
   * @param recipient The final receiver of funds
   * @param feeRecipient The fee receiver
   * @param relayFeeBPS The relay fee in basis points
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
   * @param _withdrawal The withdrawal that was relayed
   * @param _proofs The proofs that were used
   */
  event BatchRelayed(
    IPrivacyPool indexed _pool, IPrivacyPool.Withdrawal indexed _withdrawal, ProofLib.WithdrawProof[] indexed _proofs
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
}
