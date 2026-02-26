// SPDX-License-Identifier: Apache-2.0
pragma solidity ^0.8.0;

import {HandlersParent} from '../handlers/HandlersParent.t.sol';

import {Actors} from '../helpers/Actors.sol';
import {ArrayUtils} from '../helpers/FuzzUtils.sol';
import {Constants, IPrivacyPool, ProofLib} from 'contracts/PrivacyPool.sol';

import {TreeBuilder} from '../helpers/TreeBuilder.sol';

contract PropertiesPool is HandlersParent {
  using ArrayUtils for uint256;

  /// @notice This property is *not* constrained at the solidity level, but it is part of the circuit
  /// This test only challenge the accounting and the non-revert - one could pass any arbitrary amount
  /// to withdraw as the verifier is a mock.
  /// @custom:property No free withdrawals (an address can only withdraw an amount that it has deposited or has control over)
  /// @custom:property-id 1
  function property_noFreeWithdrawals(uint256 _seed) public {
    // Preconditions
    Actors _randomDepositor = pickRandomActor(_seed);

    (GhostDeposit memory _deposit, IPrivacyPool.Withdrawal memory _withdrawal, ProofLib.WithdrawProof memory _proof) =
      _setupWithdrawal(address(_randomDepositor), ++ghost_nullifiers_seed);

    uint256 _balanceProcessorFeeRecipientBefore = token.balanceOf(ghost_processingFeeRecipient);
    uint256 _balanceCurrentActorBefore = token.balanceOf(address(_randomDepositor));

    // Action
    (bool success, bytes memory result) = currentActor().call(
      address(entrypoint), 0, abi.encodeCall(entrypoint.relay, (_withdrawal, _proof, tokenPool.SCOPE()))
    );

    // Postconditions
    if (success) {
      assertEq(
        token.balanceOf(ghost_processingFeeRecipient),
        _balanceProcessorFeeRecipientBefore + _deposit.depositAmount * FEE_PROCESSING / FEE_DENOMINATOR,
        'acc: processing fee recipient wrong balance'
      );

      assertEq(
        token.balanceOf(address(_randomDepositor)),
        _balanceCurrentActorBefore + _deposit.depositAmount - _deposit.depositAmount * FEE_PROCESSING / FEE_DENOMINATOR,
        'acc: recipient wrong balance'
      );

      ghost_depositsOf[address(_randomDepositor)].pop();

      _updateGhostAccountingWithdraw(_deposit.depositAmount);
      ghost_nullifier_used[ghost_nullifiers_seed] = true;

      // we use the new nullifier as commitment hash
      ghost_allCommitments.push(ghost_nullifiers_seed);
    } else {
      // Revert:
      // - proof is invalid
      assertTrue(!mockVerifier.validProof(), 'non-revert: withdraw (1)');
    }
  }

  /// @custom:property No double spending (a nullifier can only be spent once)
  /// @custom:property-id 2
  function property_noDoubleSpending(uint256 _nullifierSeed) public {
    // Preconditions

    // some nullifiers in that range were not used as they were incremented in prop1 with a reverting proof
    uint256 _nullifier = _nullifierSeed % ghost_nullifiers_seed;

    (GhostDeposit memory _deposit, IPrivacyPool.Withdrawal memory _withdrawal, ProofLib.WithdrawProof memory _proof) =
      _setupWithdrawal(address(currentActor()), _nullifier);

    uint256 _balanceProcessorFeeRecipientBefore = token.balanceOf(ghost_processingFeeRecipient);
    uint256 _balanceCurrentActorBefore = token.balanceOf(address(currentActor()));

    // Action
    (bool success, bytes memory result) = currentActor().call(
      address(entrypoint), 0, abi.encodeCall(entrypoint.relay, (_withdrawal, _proof, tokenPool.SCOPE()))
    );

    // Post-condition
    if (success) {
      assertTrue(!ghost_nullifier_used[_nullifier], 'property 2: nullifier spent twice');
      assertEq(
        token.balanceOf(ghost_processingFeeRecipient),
        _balanceProcessorFeeRecipientBefore + _deposit.depositAmount * FEE_PROCESSING / FEE_DENOMINATOR,
        'acc: processing fee recipient wrong balance'
      );

      assertEq(
        token.balanceOf(address(currentActor())),
        _balanceCurrentActorBefore + _deposit.depositAmount - _deposit.depositAmount * FEE_PROCESSING / FEE_DENOMINATOR,
        'acc: current actor wrong balance'
      );

      ghost_depositsOf[address(currentActor())].pop();

      _updateGhostAccountingWithdraw(_deposit.depositAmount);

      ghost_nullifier_used[_nullifier] = true;

      // we used the new nullifier as commitment hash
      ghost_allCommitments.push(_nullifier);
    } else {
      // Revert:
      // - proof is invalid
      // - nullifier is already spent
      // - nullifier is not valid (ie 0)
      assertTrue(
        !mockVerifier.validProof() || ghost_nullifier_used[_nullifier] || _nullifier == 0, 'non-revert: withdraw (2)'
      );
    }
  }

  /// @custom:property Only original depositor can ragequit their deposit
  /// @custom:property-id 3
  /// @dev same as prop1, this only checks under the assumption that the proof is valid (or not if reverting),
  ///      meaning the circuit must constrain the label (avoid another sender than the original depositor) and
  ///      the nullifier (avoid multiple-spending with another nullifier) in the commitment
  function property_onlyOriginalDepositorCanRagequit(uint256 _seed) public {
    // Preconditions
    Actors _randomDepositor = pickRandomActor(_seed);

    (GhostDeposit memory _deposit, ProofLib.RagequitProof memory _proof) = _setupRagequit(address(_randomDepositor));

    uint256 _rootBefore = tokenPool.currentRoot();

    // Action
    (bool success, bytes memory result) =
      _randomDepositor.call(address(tokenPool), 0, abi.encodeCall(tokenPool.ragequit, (_proof)));

    // Post-condition
    if (success) {
      assertTrue(
        labelIsInGhostDeposits(_deposit.label, ghost_depositsOf[address(_randomDepositor)]),
        'property 3: ragequit by non-depositor'
      );

      assertEq(tokenPool.currentRoot(), _rootBefore, 'property 6: root changed after rage quit');

      ghost_depositsOf[address(_randomDepositor)].pop();

      _updateGhostAccountingRagequit(_deposit.depositAmount);

      ghost_nullifier_used[ghost_nullifiers_seed] = true;
    } else {
      // Revert:
      // - sender is not the original depositor
      // - proof is invalid
      assertTrue(
        !labelIsInGhostDeposits(_deposit.label, ghost_depositsOf[address(_randomDepositor)])
          || !mockVerifier.validProof(),
        'non-revert: ragequit (3)'
      );
    }
  }

  function property_rootContainsWithdrawDeposit() public {
    uint256 _numberOfCommitments = ghost_allCommitments.length;

    if (_numberOfCommitments == 0) return;

    uint256 _root = tokenPool.currentRoot();
    // redeploy as the current working tree is in storage, avoid reverting on leaf already existing
    TreeBuilder _treeBuilder = new TreeBuilder();

    uint256 _computedRoot = _treeBuilder.getRoot(ghost_allCommitments);
    assertEq(_computedRoot, _root, 'property 7: recomputed root mismatch');
  }

  /////////////////////////////////////////////////////////////////////
  //                             Helpers                             //
  /////////////////////////////////////////////////////////////////////

  function labelIsInGhostDeposits(uint256 _value, GhostDeposit[] memory _array) internal pure returns (bool) {
    for (uint256 i = 0; i < _array.length; i++) {
      if (_array[i].label == _value) return true;
    }
  }
}
