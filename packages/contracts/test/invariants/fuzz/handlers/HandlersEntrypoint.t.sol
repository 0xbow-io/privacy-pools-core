// SPDX-License-Identifier: Apache-2.0
pragma solidity ^0.8.0;

import {Setup, vm} from '../Setup.t.sol';
import {Constants, IPrivacyPool, IPrivacyPool, ProofLib} from 'contracts/PrivacyPool.sol';
import {IEntrypoint} from 'interfaces/IEntrypoint.sol';

contract HandlersEntrypoint is Setup {
  function handler_deposit(uint256 _amount, uint256 _precommitment) public {
    _amount = clampLt(_amount, type(uint128).max / FEE_DENOMINATOR);

    uint256 _poolBalanceBefore = token.balanceOf(address(tokenPool));
    uint256 _entrypointBalanceBefore = token.balanceOf(address(entrypoint));

    vm.assume(entrypoint.usedPrecommitments(_precommitment) == false);

    token.transfer(address(currentActor()), _amount);
    (bool success, bytes memory result) = currentActor().call(
      address(entrypoint),
      0,
      abi.encodeWithSignature('deposit(address,uint256,uint256)', token, _amount, _precommitment)
    );

    if (success) {
      // Accounting:
      uint256 _poolBalanceAfter = token.balanceOf(address(tokenPool));
      uint256 _entrypointBalanceAfter = token.balanceOf(address(entrypoint));

      ghost_current_deposit_in_balance += _poolBalanceAfter - _poolBalanceBefore;
      ghost_total_token_in += _amount;
      ghost_current_fee_in_balance += _entrypointBalanceAfter - _entrypointBalanceBefore;

      // deposit logic:
      uint256 _commitment = abi.decode(result, (uint256));
      if (_commitment == 0) assertTrue(false, 'non-zero: commitment');

      uint256 _label =
        uint256(keccak256(abi.encodePacked(tokenPool.SCOPE(), tokenPool.nonce()))) % Constants.SNARK_SCALAR_FIELD;
      ghost_depositsOf[address(currentActor())].push(
        GhostDeposit({commitment: _commitment, depositAmount: _poolBalanceAfter - _poolBalanceBefore, label: _label})
      );

      ghost_allCommitments.push(_commitment);
    } else {
      // Revert:
      // - deadpool (pun slightly assumed)
      // - amount too small
      assertTrue(tokenPool.dead() || _amount < MIN_DEPOSIT, 'non-revert: deposit');
    }
  }

  function handler_withdrawFees() public {
    uint256 _entrypointBalanceBefore = token.balanceOf(address(entrypoint));

    vm.prank(OWNER);
    try entrypoint.withdrawFees(token, OWNER) {
      uint256 _entrypointBalanceAfter = token.balanceOf(address(entrypoint));

      assertTrue(_entrypointBalanceAfter == 0, 'non-zero: entrypoint balance after withdrawFees');

      ghost_total_fee_out += _entrypointBalanceBefore;
      ghost_total_token_out += _entrypointBalanceBefore;
      ghost_current_fee_in_balance -= _entrypointBalanceBefore;
    } catch {
      assertTrue(false, 'non-revert: withdrawFees');
    }
  }

  function handler_windDown() public {
    // Don't kill an already dead pool
    if (!tokenPool.dead()) {
      vm.prank(OWNER);
      entrypoint.windDownPool(tokenPool);
    }
  }

  /////////////////////////////////////////////////////////////////////
  //                             Helpers                             //
  /////////////////////////////////////////////////////////////////////

  function _setupWithdrawal(
    address _caller,
    uint256 _nullifier
  )
    internal
    returns (
      GhostDeposit memory _deposit,
      IPrivacyPool.Withdrawal memory _withdrawal,
      ProofLib.WithdrawProof memory _proof
    )
  {
    uint256 _numberOfCommitments = ghost_depositsOf[_caller].length;

    // solhint-disable-next-line
    if (_numberOfCommitments == 0) revert();

    _deposit = ghost_depositsOf[_caller][_numberOfCommitments - 1];
    _withdrawal = _buildWithdrawal(address(entrypoint), _caller);

    uint256 _context = uint256(keccak256(abi.encode(_withdrawal, tokenPool.SCOPE()))) % Constants.SNARK_SCALAR_FIELD;

    _proof = _buildProof(
      _nullifier,
      _nullifier,
      _deposit.depositAmount, // deposit minus vetting fee
      tokenPool.currentRoot(),
      entrypoint.latestRoot(),
      _context
    );
  }

  function _setupRagequit(address _caller)
    internal
    returns (GhostDeposit memory _deposit, ProofLib.RagequitProof memory _proof)
  {
    uint256 _numberOfCommitments = ghost_depositsOf[_caller].length;

    // solhint-disable-next-line
    if (_numberOfCommitments == 0) revert();

    _deposit = ghost_depositsOf[_caller][_numberOfCommitments - 1];

    _proof =
      _buildRagequitProof(_deposit.commitment, 1, ++ghost_nullifiers_seed, _deposit.depositAmount, _deposit.label);
  }

  function _buildProof(
    uint256 _commitment,
    uint256 _nullifier,
    uint256 _deposit,
    uint256 _poolRoot,
    uint256 _aspRoot,
    uint256 _context
  ) internal returns (ProofLib.WithdrawProof memory) {
    uint256[2] memory _oneArray = [uint256(1), uint256(1)];
    uint256[2][2] memory _twoArray = [[uint256(1), uint256(1)], [uint256(1), uint256(1)]];

    // using nullifier counter for both nullifier and commitment new hash
    /**
     *        - [0] newCommitmentHash: Hash of the new commitment being created
     *        - [1] existingNullifierHash: Hash of the nullifier being spent
     *        - [2] withdrawnValue: Amount being withdrawn
     *        - [3] stateRoot: Current state root of the privacy pool
     *        - [4] stateTreeDepth: Current depth of the state tree
     *        - [5] ASPRoot: Current root of the Association Set Provider tree
     *        - [6] ASPTreeDepth: Current depth of the ASP tree
     *        - [7] context: Context value for the withdrawal operation
     */
    uint256[8] memory pubSignals =
      [_nullifier, _nullifier, _deposit, _poolRoot, _nullifier + 1, _aspRoot, _nullifier + 1, _context];

    return ProofLib.WithdrawProof({pA: _oneArray, pB: _twoArray, pC: _oneArray, pubSignals: pubSignals});
  }

  function _buildRagequitProof(
    uint256 _commitment,
    uint256 _precommitment,
    uint256 _nullifier,
    uint256 _value,
    uint256 _label
  ) internal returns (ProofLib.RagequitProof memory) {
    uint256[2] memory _oneArray = [uint256(1), uint256(1)];
    uint256[2][2] memory _twoArray = [[uint256(1), uint256(1)], [uint256(1), uint256(1)]];

    /**
     * - [0] commitmentHash: Hash of the commitment being ragequit
     *        - [1] precommitmentHash: Precommitment hash of the commitment being ragequit
     *        - [2] nullifierHash: Nullifier hash of commitment being ragequit
     *        - [3] value: Value of the commitment being ragequit
     *        - [4] label: Label of commitment
     */
    uint256[4] memory pubSignals = [_commitment, _nullifier, _value, _label];

    return ProofLib.RagequitProof({pA: _oneArray, pB: _twoArray, pC: _oneArray, pubSignals: pubSignals});
  }

  function _buildWithdrawal(address _processooor, address _recipient) internal returns (IPrivacyPool.Withdrawal memory) {
    IEntrypoint.RelayData memory _data = IEntrypoint.RelayData({
      recipient: _recipient,
      feeRecipient: ghost_processingFeeRecipient,
      relayFeeBPS: FEE_PROCESSING
    });
    return IPrivacyPool.Withdrawal({processooor: _processooor, data: abi.encode(_data)});
  }
}
