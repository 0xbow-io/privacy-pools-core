// SPDX-License-Identifier: MIT
pragma solidity 0.8.28;

import {IntegrationBase} from '../IntegrationBase.sol';
import {IEntrypoint} from 'contracts/Entrypoint.sol';
import {IPrivacyPool} from 'contracts/PrivacyPool.sol';

import {ProofLib} from 'contracts/lib/ProofLib.sol';
import {IVerifier} from 'interfaces/IVerifier.sol';

import {IERC20} from '@oz/interfaces/IERC20.sol';

contract IntegrationERC20DepositPartialRelayedWithdrawal is IntegrationBase {
  function test_ERC20DepositPartialRelayedWithdrawal() public {
    /*///////////////////////////////////////////////////////////////
                                 DEPOSIT
    //////////////////////////////////////////////////////////////*/

    // Generate deposit params
    DepositParams memory _params = _generateDefaultDepositParams(100 ether, _VETTING_FEE_BPS, _daiPool);
    deal(address(_DAI), _ALICE, _params.amount);

    // Approve entrypoint
    vm.startPrank(_ALICE);
    _DAI.approve(address(_entrypoint), _params.amount);

    // Expect deposit event from privacy pool
    vm.expectEmit(address(_daiPool));
    emit IPrivacyPool.Deposited(_ALICE, _params.commitment, _params.label, _params.amountAfterFee, _params.commitment);

    // Expect deposit event from entrypoint
    vm.expectEmit(address(_entrypoint));
    emit IEntrypoint.Deposited(_ALICE, _daiPool, _params.commitment, _params.amountAfterFee);

    // Assert balances
    uint256 _aliceInitialBalance = _DAI.balanceOf(_ALICE);
    uint256 _entrypointInitialBalance = _DAI.balanceOf(address(_entrypoint));
    uint256 _daiPoolInitialBalance = _DAI.balanceOf(address(_daiPool));
    uint256 _relayerInitialBalance = _DAI.balanceOf(_RELAYER);

    // Add the commitment to the shadow merkle tree
    _insertIntoShadowMerkleTree(_params.commitment);

    // Deposit DAI
    _entrypoint.deposit(_DAI, _params.amount, _params.precommitment);
    vm.stopPrank();

    // Assert balances
    assertEq(_DAI.balanceOf(_ALICE), _aliceInitialBalance - _params.amount, 'Alice balance mismatch');
    assertEq(
      _DAI.balanceOf(address(_entrypoint)), _entrypointInitialBalance + _params.fee, 'Entrypoint balance mismatch'
    );
    assertEq(
      _DAI.balanceOf(address(_daiPool)), _daiPoolInitialBalance + _params.amountAfterFee, 'EthPool balance mismatch'
    );

    /*///////////////////////////////////////////////////////////////
                                 WITHDRAW
    //////////////////////////////////////////////////////////////*/

    // Withdraw half of the deposit
    uint256 _withdrawnValue = _params.amountAfterFee / 2;

    // Insert leaf into shadow asp merkle tree
    _insertIntoShadowASPMerkleTree(_DEFAULT_ASP_ROOT);

    // Generate withdrawal params
    (IPrivacyPool.Withdrawal memory _withdrawal, ProofLib.Proof memory _proof) = _generateWithdrawalParams(
      WithdrawalParams({
        processor: address(_entrypoint),
        recipient: _ALICE,
        feeRecipient: _RELAYER,
        feeBps: _RELAY_FEE_BPS,
        scope: _params.scope,
        withdrawnValue: _withdrawnValue,
        nullifier: _params.nullifier
      })
    );

    // Deduct relay fee
    uint256 _receivedAmount = _deductFee(_withdrawnValue, _RELAY_FEE_BPS);

    // Push ASP root
    vm.prank(_POSTMAN);
    // pubSignals[3] is the ASPRoot
    _entrypoint.updateRoot(_proof.pubSignals[3], bytes32('IPFS_HASH'));

    // TODO: remove once we have a verifier
    vm.mockCall(address(_VERIFIER), abi.encodeWithSelector(IVerifier.verifyProof.selector, _proof), abi.encode(true));

    // Expect withdrawal event from privacy pool
    vm.expectEmit(address(_daiPool));
    // pubSignals[6] is the existingNullifierHash
    emit IPrivacyPool.Withdrawn(address(_entrypoint), _withdrawnValue, _proof.pubSignals[6], _proof.pubSignals[7]);

    // Expect withdrawal event from entrypoint
    vm.expectEmit(address(_entrypoint));
    emit IEntrypoint.WithdrawalRelayed(_RELAYER, _ALICE, _DAI, _withdrawnValue, _withdrawnValue - _receivedAmount);

    // Withdraw DAI
    vm.prank(_RELAYER);
    _entrypoint.relay(_withdrawal, _proof);

    // Assert balances
    assertEq(_DAI.balanceOf(_ALICE), _aliceInitialBalance - _params.amount + _receivedAmount, 'Alice balance mismatch');
    assertEq(
      _DAI.balanceOf(address(_entrypoint)), _entrypointInitialBalance + _params.fee, 'Entrypoint balance mismatch'
    );
    assertEq(_DAI.balanceOf(address(_daiPool)), _daiPoolInitialBalance + _withdrawnValue, 'EthPool balance mismatch');
    assertEq(
      _DAI.balanceOf(_RELAYER), _relayerInitialBalance + _withdrawnValue - _receivedAmount, 'Relayer balance mismatch'
    );
  }
}
