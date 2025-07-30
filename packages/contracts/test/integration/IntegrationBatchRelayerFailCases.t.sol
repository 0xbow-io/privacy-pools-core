// SPDX-License-Identifier: Apache-2.0
pragma solidity 0.8.28;

import {IntegrationBase} from './IntegrationBase.sol';
import {ProofLib} from 'contracts/lib/ProofLib.sol';
import {IBatchRelayer} from 'interfaces/IBatchRelayer.sol';
import {IPrivacyPool} from 'interfaces/IPrivacyPool.sol';
import {InternalLeanIMT, LeanIMTData} from 'lean-imt/InternalLeanIMT.sol';

contract IntegrationBatchRelayerFailCases is IntegrationBase {
  using InternalLeanIMT for LeanIMTData;

  uint256 public constant FIVE_PERCENT = 500;
  Commitment internal _commitment1;
  Commitment internal _commitment2;
  address internal _CARL;

  function setUp() public override {
    super.setUp();

    _CARL = makeAddr('carl');

    // Alice deposits 10 ETH
    _commitment1 = _deposit(
      DepositParams({depositor: _ALICE, asset: _ETH, amount: 10 ether, nullifier: 'nullifier_1', secret: 'secret_1'})
    );

    // Alice deposits 20 ETH
    _commitment2 = _deposit(
      DepositParams({depositor: _ALICE, asset: _ETH, amount: 20 ether, nullifier: 'nullifier_2', secret: 'secret_2'})
    );

    // Push ASP root with label included
    vm.prank(_POSTMAN);
    _entrypoint.updateRoot(_shadowASPMerkleTree._root(), 'ipfs_cid_ipfs_cid_ipfs_cid_ipfs_cid_ipfs_cid_ipfs_cid');
  }

  function test_batchRelayExtraUnrelatedWithdrawal() public {
    // Bob withdraws the total amount of Alice's commitment, but relayer includes an extra withdrawal for Carl
    WithdrawalParams[] memory _params = new WithdrawalParams[](2);
    _params[0] = WithdrawalParams({
      withdrawnAmount: _commitment1.value,
      newNullifier: 'nullifier_1a',
      newSecret: 'secret_1a',
      recipient: _BOB,
      commitment: _commitment1
    });
    _params[1] = WithdrawalParams({
      withdrawnAmount: _commitment2.value,
      newNullifier: 'nullifier_2a',
      newSecret: 'secret_2a',
      recipient: _CARL,
      commitment: _commitment2
    });
    _withdrawThroughBatchRelayer(
      address(_batchRelayer),
      _params,
      IBatchRelayer.BatchRelayData({recipient: _BOB, feeRecipient: _RELAYER, relayFeeBPS: FIVE_PERCENT, batchSize: 1}),
      IBatchRelayer.InvalidBatchSize.selector
    );
  }

  function test_batchRelayReplaceWithUnrelatedWithdrawal() public {
    ProofLib.WithdrawProof[] memory _proofs = new ProofLib.WithdrawProof[](2);

    IBatchRelayer.BatchRelayData memory _bobRelayData =
      IBatchRelayer.BatchRelayData({recipient: _BOB, feeRecipient: _RELAYER, relayFeeBPS: FIVE_PERCENT, batchSize: 2});
    IBatchRelayer.BatchRelayData memory _carlRelayData =
      IBatchRelayer.BatchRelayData({recipient: _CARL, feeRecipient: _RELAYER, relayFeeBPS: FIVE_PERCENT, batchSize: 2});

    IPrivacyPool.Withdrawal memory _bobWithdrawal =
      IPrivacyPool.Withdrawal({processooor: address(_batchRelayer), data: abi.encode(_bobRelayData)});
    IPrivacyPool.Withdrawal memory _carlWithdrawal =
      IPrivacyPool.Withdrawal({processooor: address(_batchRelayer), data: abi.encode(_carlRelayData)});

    // Carl deposits 10 ETH
    Commitment memory _commitment3 = _deposit(
      DepositParams({depositor: _CARL, asset: _ETH, amount: 10 ether, nullifier: 'nullifier_3', secret: 'secret_3'})
    );

    // Push ASP root with label included
    vm.prank(_POSTMAN);
    _entrypoint.updateRoot(_shadowASPMerkleTree._root(), 'ipfs_cid_ipfs_cid_ipfs_cid_ipfs_cid_ipfs_cid_ipfs_cid');

    // Generate proof from alice commitment
    (, _proofs[0]) = _computeNewCommitmentAndProof(
      uint256(keccak256(abi.encode(_bobWithdrawal, _ethPool.SCOPE()))) % SNARK_SCALAR_FIELD,
      WithdrawalParams({
        withdrawnAmount: 0,
        newNullifier: 'nullifier_1a',
        newSecret: 'secret_1a',
        recipient: _BOB,
        commitment: _commitment1
      })
    );

    // Generate proof from carl commitment
    (, _proofs[1]) = _computeNewCommitmentAndProof(
      uint256(keccak256(abi.encode(_carlWithdrawal, _ethPool.SCOPE()))) % SNARK_SCALAR_FIELD,
      WithdrawalParams({
        withdrawnAmount: 0,
        newNullifier: 'nullifier_3a',
        newSecret: 'secret_3a',
        recipient: _CARL,
        commitment: _commitment3
      })
    );

    // Call batch relayer with both proofs (both have different context)
    vm.prank(_RELAYER);
    vm.expectRevert(IPrivacyPool.ContextMismatch.selector);
    _batchRelayer.batchRelay(_ethPool, _bobWithdrawal, _proofs);
  }

  function test_batchRelayWrongProcessooor() public {
    // Bob withdraws the total amount of Alice's commitment, but with wrong processooor
    WithdrawalParams[] memory _params = new WithdrawalParams[](1);
    _params[0] = WithdrawalParams({
      withdrawnAmount: _commitment1.value,
      newNullifier: 'nullifier_1a',
      newSecret: 'secret_1a',
      recipient: _BOB,
      commitment: _commitment1
    });
    _withdrawThroughBatchRelayer(
      address(_entrypoint),
      _params,
      IBatchRelayer.BatchRelayData({recipient: _BOB, feeRecipient: _RELAYER, relayFeeBPS: FIVE_PERCENT, batchSize: 1}),
      IPrivacyPool.InvalidProcessooor.selector
    );
  }
}
