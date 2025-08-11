// SPDX-License-Identifier: Apache-2.0
pragma solidity ^0.8.0;

import {HandlersParent} from '../handlers/HandlersParent.t.sol';
import {Actors} from '../helpers/Actors.sol';
import {Constants, IPrivacyPool, ProofLib} from 'contracts/PrivacyPool.sol';

import {IBatchRelayer} from 'interfaces/IBatchRelayer.sol';
import {IEntrypoint} from 'interfaces/IEntrypoint.sol';

contract PropertiesBatchWithdraw is HandlersParent {
  /// @custom:invariant batch relayer balance should never be positive
  /// @custom:invariant-id BATCH-1
  function property_batch_1() public {
    assertEq(token.balanceOf(address(batchRelayer)), 0, 'BATCH-1');
    assertEq(payable(batchRelayer).balance, 0, 'BATCH-1');
  }

  /// @custom:invariant processing fee should be paid as the fee taken on the sum of individual withdrawals, `sum(withdrawal amount)*relayer fee / 10_000`
  /// @custom:invariant-id BATCH-2
  /// @custom:invariant recipient balance should be the sum of individual withdrawals recipient balance (minus fees), `sum(withdrawal amount) - sum(withdrawal amount)*relayer fee / 10_000`
  /// @custom:invariant-id BATCH-3
  function property_batch_2_3(uint256 _seed) public {
    address _caller = address(currentActor());
    uint256 _numberOfCommitments = ghost_depositsOf[_caller].length;

    uint256 _balanceCallerBefore = token.balanceOf(_caller);
    uint256 _balanceProcessingFeeRecipientBefore = token.balanceOf(ghost_processingFeeRecipient);

    // solhint-disable-next-line
    if (_numberOfCommitments == 0) revert();

    GhostDeposit[] memory _deposits = new GhostDeposit[](_numberOfCommitments);
    _deposits = ghost_depositsOf[_caller];

    IBatchRelayer.BatchRelayData memory _data = IBatchRelayer.BatchRelayData({
      recipient: _caller,
      feeRecipient: ghost_processingFeeRecipient,
      relayFeeBPS: FEE_PROCESSING,
      batchSize: uint8(_numberOfCommitments)
    });

    IPrivacyPool.Withdrawal memory _withdrawal =
      IPrivacyPool.Withdrawal({processooor: address(batchRelayer), data: abi.encode(_data)});

    uint256 _firstNullifier = ghost_nullifiers_seed;

    ProofLib.WithdrawProof[] memory _proofs = new ProofLib.WithdrawProof[](_numberOfCommitments);
    for (uint256 i = 0; i < _numberOfCommitments; i++) {
      uint256 _context = uint256(keccak256(abi.encode(_withdrawal, tokenPool.SCOPE()))) % Constants.SNARK_SCALAR_FIELD;

      _proofs[i] = _buildProof(
        ++ghost_nullifiers_seed,
        ghost_nullifiers_seed,
        _deposits[i].depositAmount, // deposit minus vetting fee
        tokenPool.currentRoot(),
        entrypoint.latestRoot(),
        _context
      );
    }

    // Action
    (bool success, bytes memory result) = currentActor().call(
      address(batchRelayer), 0, abi.encodeCall(batchRelayer.batchRelay, (tokenPool, _withdrawal, _proofs))
    );

    // Postconditions
    if (success) {
      uint256 _batchWithdraw;
      for (uint256 i = 0; i < _numberOfCommitments; i++) {
        ghost_nullifier_used[++_firstNullifier] = true;
        ghost_allCommitments.push(_firstNullifier);
        _batchWithdraw += _deposits[i].depositAmount;
      }
      _updateGhostAccountingWithdraw(_batchWithdraw);

      uint256 _fee = _batchWithdraw * FEE_PROCESSING / 10_000;

      assertEq(token.balanceOf(address(batchRelayer)), 0, 'BATCH-1');
      assertEq(payable(batchRelayer).balance, 0, 'BATCH-1');

      assertEq(_balanceProcessingFeeRecipientBefore + _fee, token.balanceOf(ghost_processingFeeRecipient), 'BATCH-2');

      assertEq(_balanceCallerBefore + _batchWithdraw - _fee, token.balanceOf(address(currentActor())), 'BATCH-3');

      delete ghost_depositsOf[address(currentActor())];
    } else {
      assertTrue(!mockVerifier.validProof(), 'non-revert: withdraw (1)');
    }
  }
}
