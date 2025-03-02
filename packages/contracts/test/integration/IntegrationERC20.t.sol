// SPDX-License-Identifier: Apache-2.0
pragma solidity 0.8.28;

import {IntegrationBase} from './IntegrationBase.sol';
import {InternalLeanIMT, LeanIMTData} from 'lean-imt/InternalLeanIMT.sol';

import {IPrivacyPool} from 'interfaces/IPrivacyPool.sol';
import {IState} from 'interfaces/IState.sol';

contract IntegrationERC20 is IntegrationBase {
  using InternalLeanIMT for LeanIMTData;

  Commitment internal _commitment;

  /**
   * @notice Test that users can make a deposit and fully withdraw its value (after fees) directly, without a relayer
   */
  function test_fullDirectWithdrawal() public {
    // Alice deposits 5000 DAI
    _commitment = _deposit(
      DepositParams({depositor: _ALICE, asset: _DAI, amount: 5000 ether, nullifier: 'nullifier_1', secret: 'secret_1'})
    );

    // Push ASP root with label included
    vm.prank(_POSTMAN);
    _entrypoint.updateRoot(_shadowASPMerkleTree._root(), bytes32('IPFS_HASH'));

    // Bob withdraws the total amount of Alice's commitment
    _selfWithdraw(
      WithdrawalParams({
        withdrawnAmount: _commitment.value,
        newNullifier: 'nullifier_2',
        newSecret: 'secret_2',
        recipient: _BOB,
        commitment: _commitment,
        revertReason: NONE
      })
    );
  }

  /**
   * @notice Test that users can make a deposit and fully withdraw its value (after fees) through a relayer
   */
  function test_fullRelayedWithdrawal() public {
    // Alice deposits 5000 DAI
    _commitment = _deposit(
      DepositParams({depositor: _ALICE, asset: _DAI, amount: 5000 ether, nullifier: 'nullifier_1', secret: 'secret_1'})
    );

    // Push ASP root with label included
    vm.prank(_POSTMAN);
    _entrypoint.updateRoot(_shadowASPMerkleTree._root(), bytes32('IPFS_HASH'));

    // Bob receives the total amount of Alice's commitment
    _withdrawThroughRelayer(
      WithdrawalParams({
        withdrawnAmount: _commitment.value,
        newNullifier: 'nullifier_2',
        newSecret: 'secret_2',
        recipient: _BOB,
        commitment: _commitment,
        revertReason: NONE
      })
    );
  }

  /**
   * @notice Test that users can make a deposit and partially withdraw, without a relayer
   */
  function test_partialDirectWithdrawal() public {
    // Alice deposits 5000 DAI
    _commitment = _deposit(
      DepositParams({depositor: _ALICE, asset: _DAI, amount: 5000 ether, nullifier: 'nullifier_1', secret: 'secret_1'})
    );

    // Push ASP root with label included
    vm.prank(_POSTMAN);
    _entrypoint.updateRoot(_shadowASPMerkleTree._root(), bytes32('IPFS_HASH'));

    // Bob withdraws 2000 DAI of Alice's commitment
    _selfWithdraw(
      WithdrawalParams({
        withdrawnAmount: 2000 ether,
        newNullifier: 'nullifier_2',
        newSecret: 'secret_2',
        recipient: _BOB,
        commitment: _commitment,
        revertReason: NONE
      })
    );
  }

  /**
   * @notice Test that users can make a deposit and do multiple partial withdrawals without a relayer
   */
  function test_multiplePartialDirectWithdrawals() public {
    // Alice deposits 5000 DAI
    _commitment = _deposit(
      DepositParams({depositor: _ALICE, asset: _DAI, amount: 5000 ether, nullifier: 'nullifier_1', secret: 'secret_1'})
    );

    // Push ASP root with label included
    vm.prank(_POSTMAN);
    _entrypoint.updateRoot(_shadowASPMerkleTree._root(), bytes32('IPFS_HASH'));

    // Withdraw 2000 DAI to Bob
    _commitment = _selfWithdraw(
      WithdrawalParams({
        withdrawnAmount: 2000 ether,
        newNullifier: 'nullifier_2',
        newSecret: 'secret_2',
        recipient: _BOB,
        commitment: _commitment,
        revertReason: NONE
      })
    );

    // Withdraw 2000 DAI to Bob
    _commitment = _selfWithdraw(
      WithdrawalParams({
        withdrawnAmount: 2000 ether,
        newNullifier: 'nullifier_3',
        newSecret: 'secret_3',
        recipient: _BOB,
        commitment: _commitment,
        revertReason: NONE
      })
    );

    // Withdraw 500 DAI to Bob
    _commitment = _selfWithdraw(
      WithdrawalParams({
        withdrawnAmount: 500 ether,
        newNullifier: 'nullifier_4',
        newSecret: 'secret_4',
        recipient: _BOB,
        commitment: _commitment,
        revertReason: NONE
      })
    );

    // Withdraw remaining balance to Bob
    _commitment = _selfWithdraw(
      WithdrawalParams({
        withdrawnAmount: _commitment.value,
        newNullifier: 'nullifier_5',
        newSecret: 'secret_5',
        recipient: _BOB,
        commitment: _commitment,
        revertReason: NONE
      })
    );
  }

  /**
   * @notice Test that users can make a deposit and do a partial withdrawal through a relayer
   */
  function test_partialRelayedWithdrawal() public {
    // Alice deposits 5000 DAI
    _commitment = _deposit(
      DepositParams({depositor: _ALICE, asset: _DAI, amount: 5000 ether, nullifier: 'nullifier_1', secret: 'secret_1'})
    );

    // Push ASP root with label included
    vm.prank(_POSTMAN);
    _entrypoint.updateRoot(_shadowASPMerkleTree._root(), bytes32('IPFS_HASH'));

    // Bob receives half of Alice's commitment
    _withdrawThroughRelayer(
      WithdrawalParams({
        withdrawnAmount: 2500 ether,
        newNullifier: 'nullifier_2',
        newSecret: 'secret_2',
        recipient: _BOB,
        commitment: _commitment,
        revertReason: NONE
      })
    );
  }

  /**
   * @notice Test that users can make a deposit and do multiple partial withdrawals through a relayer
   */
  function test_multiplePartialRelayedWithdrawals() public {
    // Alice deposits 5000 DAI
    _commitment = _deposit(
      DepositParams({depositor: _ALICE, asset: _DAI, amount: 5000 ether, nullifier: 'nullifier_1', secret: 'secret_1'})
    );

    // Push ASP root with label included
    vm.prank(_POSTMAN);
    _entrypoint.updateRoot(_shadowASPMerkleTree._root(), bytes32('IPFS_HASH'));

    // Withdraw 2000 DAI to Bob
    _commitment = _withdrawThroughRelayer(
      WithdrawalParams({
        withdrawnAmount: 2000 ether,
        newNullifier: 'nullifier_2',
        newSecret: 'secret_2',
        recipient: _BOB,
        commitment: _commitment,
        revertReason: NONE
      })
    );

    // Withdraw 2000 DAI to Bob
    _commitment = _withdrawThroughRelayer(
      WithdrawalParams({
        withdrawnAmount: 2000 ether,
        newNullifier: 'nullifier_3',
        newSecret: 'secret_3',
        recipient: _BOB,
        commitment: _commitment,
        revertReason: NONE
      })
    );

    // Withdraw 500 DAI to Bob
    _commitment = _withdrawThroughRelayer(
      WithdrawalParams({
        withdrawnAmount: 500 ether,
        newNullifier: 'nullifier_4',
        newSecret: 'secret_4',
        recipient: _BOB,
        commitment: _commitment,
        revertReason: NONE
      })
    );

    // Withdraw remaining balance to Bob
    _commitment = _withdrawThroughRelayer(
      WithdrawalParams({
        withdrawnAmount: _commitment.value,
        newNullifier: 'nullifier_5',
        newSecret: 'secret_5',
        recipient: _BOB,
        commitment: _commitment,
        revertReason: NONE
      })
    );
  }

  /**
   * @notice Test that users can ragequit a commitment when their label is not in the ASP tree
   */
  function test_ragequit() public {
    // Alice deposits 5000 DAI
    _commitment = _deposit(
      DepositParams({depositor: _ALICE, asset: _DAI, amount: 5000 ether, nullifier: 'nullifier_1', secret: 'secret_1'})
    );

    // Push ASP root without label
    vm.prank(_POSTMAN);
    _entrypoint.updateRoot(uint256(keccak256('some_root')) % SNARK_SCALAR_FIELD, bytes32('IPFS_HASH'));

    // Fail to withdraw
    _withdrawThroughRelayer(
      WithdrawalParams({
        withdrawnAmount: 3000 ether,
        newNullifier: 'nullifier_2',
        newSecret: 'secret_2',
        recipient: _BOB,
        commitment: _commitment,
        revertReason: IPrivacyPool.IncorrectASPRoot.selector
      })
    );

    // Ragequit full amount
    _ragequit(_ALICE, _commitment);
  }

  /**
   * @notice Test that users can get approved by the ASP, make a partial withdrawal, and if removed from the ASP set, they can only ragequit
   */
  function test_aspRemoval() public {
    // Alice deposits 5000 DAI
    _commitment = _deposit(
      DepositParams({depositor: _ALICE, asset: _DAI, amount: 5000 ether, nullifier: 'nullifier_1', secret: 'secret_1'})
    );

    // Push ASP root with label included
    vm.prank(_POSTMAN);
    _entrypoint.updateRoot(_shadowASPMerkleTree._root(), bytes32('IPFS_HASH'));

    // Withdraw 4000 DAI through relayer
    _commitment = _withdrawThroughRelayer(
      WithdrawalParams({
        withdrawnAmount: 4000 ether,
        newNullifier: 'nullifier_2',
        newSecret: 'secret_2',
        recipient: _BOB,
        commitment: _commitment,
        revertReason: NONE
      })
    );

    // Remove label from ASP
    vm.prank(_POSTMAN);
    _entrypoint.updateRoot(uint256(keccak256('some_root')) % SNARK_SCALAR_FIELD, bytes32('IPFS_HASH'));

    // Fail to withdraw
    _withdrawThroughRelayer(
      WithdrawalParams({
        withdrawnAmount: 500 ether,
        newNullifier: 'nullifier_3',
        newSecret: 'secret_3',
        recipient: _BOB,
        commitment: _commitment,
        revertReason: IPrivacyPool.IncorrectASPRoot.selector
      })
    );

    // Ragequit
    _ragequit(_ALICE, _commitment);
  }

  /**
   * @notice Test that users can't spend a commitment more than once
   */
  function test_failWhenCommitmentAlreadySpent() public {
    // Alice deposits 5000 DAI
    _commitment = _deposit(
      DepositParams({depositor: _ALICE, asset: _DAI, amount: 5000 ether, nullifier: 'nullifier_1', secret: 'secret_1'})
    );

    // Push ASP root with label included
    vm.prank(_POSTMAN);
    _entrypoint.updateRoot(_shadowASPMerkleTree._root(), bytes32('IPFS_HASH'));

    // Fully spend child commitment
    _selfWithdraw(
      WithdrawalParams({
        withdrawnAmount: _commitment.value,
        newNullifier: 'nullifier_2',
        newSecret: 'secret_2',
        recipient: _BOB,
        commitment: _commitment,
        revertReason: NONE
      })
    );

    // Fail to spend same commitment that was just spent
    _selfWithdraw(
      WithdrawalParams({
        withdrawnAmount: _commitment.value,
        newNullifier: 'nullifier_2',
        newSecret: 'secret_2',
        recipient: _BOB,
        commitment: _commitment,
        revertReason: IState.NullifierAlreadySpent.selector
      })
    );
  }

  /**
   * @notice Test that spent commitments can not be ragequitted (and spent again)
   */
  function test_failWhenTryingToSpendRagequitCommitment() public {
    // Alice deposits 5000 DAI
    _commitment = _deposit(
      DepositParams({depositor: _ALICE, asset: _DAI, amount: 5000 ether, nullifier: 'nullifier_1', secret: 'secret_1'})
    );

    // Ragequit full amount
    _ragequit(_ALICE, _commitment);

    // Push ASP root with label included
    vm.prank(_POSTMAN);
    _entrypoint.updateRoot(_shadowASPMerkleTree._root(), bytes32('IPFS_HASH'));

    // Fail to withdraw commitment that was already ragequitted
    _selfWithdraw(
      WithdrawalParams({
        withdrawnAmount: _commitment.value,
        newNullifier: 'nullifier_2',
        newSecret: 'secret_2',
        recipient: _BOB,
        commitment: _commitment,
        revertReason: IState.NullifierAlreadySpent.selector
      })
    );
  }
}
