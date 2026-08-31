// SPDX-License-Identifier: Apache-2.0
pragma solidity 0.8.28;

import {IntegrationBase} from './IntegrationBase.sol';
import {IBatchRelayer} from 'interfaces/IBatchRelayer.sol';
import {InternalLeanIMT, LeanIMTData} from 'lean-imt/InternalLeanIMT.sol';

contract IntegrationBatchRelayerSuccessCases is IntegrationBase {
  using InternalLeanIMT for LeanIMTData;

  uint256 public constant FIVE_PERCENT = 500;
  Commitment internal _commitment1;
  Commitment internal _commitment2;

  function setUp() public override {
    super.setUp();

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

  function test_batchRelay() public {
    // Bob withdraws the total amount of Alice's commitment
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
      recipient: _BOB,
      commitment: _commitment2
    });
    _withdrawThroughBatchRelayer(
      _params,
      IBatchRelayer.BatchRelayData({
        recipient: _BOB,
        feeRecipient: _RELAYER,
        relayFeeBPS: FIVE_PERCENT,
        batchSize: 2,
        totalValue: _commitment1.value + _commitment2.value
      }),
      NONE
    );
  }

  function test_batchRelayOneProofZero() public {
    // Bob withdraws the total amount of Alice's second commitment and zero amount of the first commitment
    WithdrawalParams[] memory _params = new WithdrawalParams[](2);
    _params[0] = WithdrawalParams({
      withdrawnAmount: 0,
      newNullifier: 'nullifier_1a',
      newSecret: 'secret_1a',
      recipient: _BOB,
      commitment: _commitment1
    });
    _params[1] = WithdrawalParams({
      withdrawnAmount: _commitment2.value,
      newNullifier: 'nullifier_2a',
      newSecret: 'secret_2a',
      recipient: _BOB,
      commitment: _commitment2
    });
    _withdrawThroughBatchRelayer(
      _params,
      IBatchRelayer.BatchRelayData({
        recipient: _BOB,
        feeRecipient: _RELAYER,
        relayFeeBPS: FIVE_PERCENT,
        batchSize: 2,
        totalValue: _commitment2.value
      }),
      NONE
    );
  }

  function test_batchRelayFullBatchZero() public {
    // Bob withdraws zero amount of both commitments
    WithdrawalParams[] memory _params = new WithdrawalParams[](2);
    _params[0] = WithdrawalParams({
      withdrawnAmount: 0,
      newNullifier: 'nullifier_1a',
      newSecret: 'secret_1a',
      recipient: _BOB,
      commitment: _commitment1
    });
    _params[1] = WithdrawalParams({
      withdrawnAmount: 0,
      newNullifier: 'nullifier_2a',
      newSecret: 'secret_2a',
      recipient: _BOB,
      commitment: _commitment2
    });
    _withdrawThroughBatchRelayer(
      _params,
      IBatchRelayer.BatchRelayData({
        recipient: _BOB,
        feeRecipient: _RELAYER,
        relayFeeBPS: FIVE_PERCENT,
        batchSize: 2,
        totalValue: 0
      }),
      NONE
    );
  }

  /// @dev Relayer will receive a minimum of 1 wei in fees
  function test_batchRelayZeroFees() public {
    uint256 _relayerBalanceBefore = _RELAYER.balance;

    uint256 _totalValue = 10_000 / FIVE_PERCENT;

    // Bob withdraws a very small amount of the commitment, not enouth to pay for the relayer fee
    WithdrawalParams[] memory _params = new WithdrawalParams[](1);
    _params[0] = WithdrawalParams({
      withdrawnAmount: _totalValue,
      newNullifier: 'nullifier_1a',
      newSecret: 'secret_1a',
      recipient: _BOB,
      commitment: _commitment1
    });
    _withdrawThroughBatchRelayer(
      _params,
      IBatchRelayer.BatchRelayData({
        recipient: _BOB,
        feeRecipient: _RELAYER,
        relayFeeBPS: FIVE_PERCENT,
        batchSize: 1,
        totalValue: _totalValue
      }),
      NONE
    );

    assertEq(_RELAYER.balance, _relayerBalanceBefore + 1);
  }

  function test_batchRelaySingleProof() public {
    // Bob withdraws the total amount of Alice's first commitment
    WithdrawalParams[] memory _params = new WithdrawalParams[](1);
    _params[0] = WithdrawalParams({
      withdrawnAmount: _commitment1.value,
      newNullifier: 'nullifier_1a',
      newSecret: 'secret_1a',
      recipient: _BOB,
      commitment: _commitment1
    });
    _withdrawThroughBatchRelayer(
      _params,
      IBatchRelayer.BatchRelayData({
        recipient: _BOB,
        feeRecipient: _RELAYER,
        relayFeeBPS: FIVE_PERCENT,
        batchSize: 1,
        totalValue: _commitment1.value
      }),
      NONE
    );
  }

  function test_batchRelayRecipientAndFeeRecipientAreEqual() public {
    uint256 _bobBalanceBefore = _BOB.balance;

    // Bob withdraws the total amount of Alice's commitment and the fee recipient is also bob
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
      recipient: _BOB,
      commitment: _commitment2
    });
    _withdrawThroughBatchRelayer(
      address(_batchRelayer),
      _params,
      IBatchRelayer.BatchRelayData({
        recipient: _BOB,
        feeRecipient: _BOB,
        relayFeeBPS: FIVE_PERCENT,
        batchSize: 2,
        totalValue: _commitment1.value + _commitment2.value
      }),
      NONE
    );

    assertEq(_BOB.balance, _bobBalanceBefore + _commitment1.value + _commitment2.value);
  }
}
