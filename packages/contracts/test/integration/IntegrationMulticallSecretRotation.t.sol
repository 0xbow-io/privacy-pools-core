// SPDX-License-Identifier: Apache-2.0
pragma solidity 0.8.28;

import {IntegrationBase} from './IntegrationBase.sol';
import {InternalLeanIMT, LeanIMTData} from 'lean-imt/InternalLeanIMT.sol';

import {Multicall3} from 'contracts/lib/Multicall3.sol';
import {ProofLib} from 'contracts/lib/ProofLib.sol';
import {IPrivacyPool} from 'interfaces/IPrivacyPool.sol';

contract IntegrationMulticallSecretRotation is IntegrationBase {
  using InternalLeanIMT for LeanIMTData;



  Multicall3 internal _multicall;

  function setUp() public override {
    super.setUp();
    _multicall = new Multicall3();
  }

  /**
   * @notice Test 3 batched zero-value withdrawals (secret rotation) for 3 independent deposit notes via Multicall3
   * @dev Three separate deposits are made, then all three notes have their secrets rotated in a single
   *      multicall transaction. All proofs reference the same state root (after all deposits) since
   *      earlier roots remain valid in the 64-entry circular buffer as new commitments are inserted.
   */
  function test_batchedSecretRotationViaMulticall() public {
    // 3 separate deposits by Alice, each with unique nullifier/secret
    Commitment memory _c1 = _deposit(
      DepositParams({depositor: _ALICE, asset: _ETH, amount: 100 ether, nullifier: 'nullifier_1', secret: 'secret_1'})
    );
    Commitment memory _c2 = _deposit(
      DepositParams({depositor: _ALICE, asset: _ETH, amount: 50 ether, nullifier: 'nullifier_2', secret: 'secret_2'})
    );
    Commitment memory _c3 = _deposit(
      DepositParams({depositor: _ALICE, asset: _ETH, amount: 25 ether, nullifier: 'nullifier_3', secret: 'secret_3'})
    );

    // Push ASP root containing all 3 deposit labels
    vm.prank(_POSTMAN);
    _entrypoint.updateRoot(_shadowASPMerkleTree._root(), 'ipfs_cid_ipfs_cid_ipfs_cid_ipfs_cid_ipfs_cid_ipfs_cid');

    IPrivacyPool _pool = IPrivacyPool(address(_ethPool));
    uint256 _scope = _pool.SCOPE();

    // Build Withdrawal object with Multicall3 as processooor (it will be msg.sender to the pool)
    IPrivacyPool.Withdrawal memory _withdrawal = IPrivacyPool.Withdrawal({processooor: address(_multicall), data: ''});

    // Context is the same for all 3 calls since the Withdrawal struct doesn't change
    uint256 _context = uint256(keccak256(abi.encode(_withdrawal, _scope))) % SNARK_SCALAR_FIELD;

    // Generate all 3 zero-value withdrawal proofs against current shadow tree state (after 3 deposits).
    // All proofs reference the same state root, which remains valid on-chain as new commitments are inserted
    // because the root history circular buffer (size 64) retains it.
    Commitment[] memory _newCommitments = new Commitment[](3);
    ProofLib.WithdrawProof[] memory _proofs = new ProofLib.WithdrawProof[](3);

    (_newCommitments[0], _proofs[0]) = _computeNewCommitmentAndProof(
      _context,
      WithdrawalParams({
        withdrawnAmount: 0,
        newNullifier: 'nullifier_1_rotated',
        newSecret: 'secret_1_rotated',
        recipient: address(_multicall),
        commitment: _c1
      })
    );

    (_newCommitments[1], _proofs[1]) = _computeNewCommitmentAndProof(
      _context,
      WithdrawalParams({
        withdrawnAmount: 0,
        newNullifier: 'nullifier_2_rotated',
        newSecret: 'secret_2_rotated',
        recipient: address(_multicall),
        commitment: _c2
      })
    );

    (_newCommitments[2], _proofs[2]) = _computeNewCommitmentAndProof(
      _context,
      WithdrawalParams({
        withdrawnAmount: 0,
        newNullifier: 'nullifier_3_rotated',
        newSecret: 'secret_3_rotated',
        recipient: address(_multicall),
        commitment: _c3
      })
    );

    // Build Multicall3 calls
    Multicall3.Call3[] memory _calls = new Multicall3.Call3[](3);
    for (uint256 i = 0; i < 3; i++) {
      _calls[i] = Multicall3.Call3({
        target: address(_pool),
        allowFailure: false,
        callData: abi.encodeCall(IPrivacyPool.withdraw, (_withdrawal, _proofs[i]))
      });
    }

    // Capture state before multicall
    uint256 _poolBalanceBefore = address(_pool).balance;
    uint256 _treeSizeBefore = _pool.currentTreeSize();

    // Execute all 3 secret rotations in a single transaction
    _multicall.aggregate3(_calls);

    // Update shadow tree to stay in sync with on-chain state
    _insertIntoShadowMerkleTree(_newCommitments[0].hash);
    _insertIntoShadowMerkleTree(_newCommitments[1].hash);
    _insertIntoShadowMerkleTree(_newCommitments[2].hash);

    // Verify all 3 nullifiers have been spent
    assertTrue(_pool.nullifierHashes(_proofs[0].pubSignals[1]), 'Nullifier 1 must be spent');
    assertTrue(_pool.nullifierHashes(_proofs[1].pubSignals[1]), 'Nullifier 2 must be spent');
    assertTrue(_pool.nullifierHashes(_proofs[2].pubSignals[1]), 'Nullifier 3 must be spent');

    // Verify pool balance unchanged (zero-value withdrawals transfer nothing)
    assertEq(address(_pool).balance, _poolBalanceBefore, 'Pool balance must not change');

    // Verify 3 new commitments were inserted into the tree
    assertEq(_pool.currentTreeSize(), _treeSizeBefore + 3, 'Tree must grow by 3 leaves');

    // Verify each new commitment preserves its original deposit value and label
    assertEq(_newCommitments[0].value, _c1.value, 'Commitment 1 value must be preserved');
    assertEq(_newCommitments[1].value, _c2.value, 'Commitment 2 value must be preserved');
    assertEq(_newCommitments[2].value, _c3.value, 'Commitment 3 value must be preserved');
    assertEq(_newCommitments[0].label, _c1.label, 'Commitment 1 label must be preserved');
    assertEq(_newCommitments[1].label, _c2.label, 'Commitment 2 label must be preserved');
    assertEq(_newCommitments[2].label, _c3.label, 'Commitment 3 label must be preserved');
  }
}
