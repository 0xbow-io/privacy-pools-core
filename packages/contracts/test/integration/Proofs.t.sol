// SPDX-License-Identifier: Apache-2.0
pragma solidity 0.8.28;

import {IntegrationBase} from './IntegrationBase.sol';

import {ProofLib} from 'contracts/lib/ProofLib.sol';
import {InternalLeanIMT, LeanIMTData} from 'lean-imt/InternalLeanIMT.sol';

import {IPrivacyPool} from 'interfaces/IPrivacyPool.sol';

contract IntegrationProofs is IntegrationBase {
  using InternalLeanIMT for LeanIMTData;

  Commitment internal _commitment;
  IPrivacyPool.Withdrawal internal _withdrawal;
  uint256 internal _context;

  function setUp() public override {
    super.setUp();

    // Alice deposits 100 ETH
    _commitment = _deposit(
      DepositParams({depositor: _ALICE, asset: _ETH, amount: 100 ether, nullifier: 'nullifier_1', secret: 'secret_1'})
    );

    // Push ASP root with label included
    vm.prank(_POSTMAN);
    _entrypoint.updateRoot(_shadowASPMerkleTree._root(), 'ipfs_cid_ipfs_cid_ipfs_cid_ipfs_cid_ipfs_cid_ipfs_cid');

    _withdrawal = IPrivacyPool.Withdrawal({processooor: _BOB, data: abi.encode(_BOB, address(0), 0)});

    _context = uint256(keccak256(abi.encode(_withdrawal, _ethPool.SCOPE()))) % SNARK_SCALAR_FIELD;
  }

  /// forge-config: default.allow_internal_expect_revert = true
  function test_failToGenerateProof_whenCommitmentHashMismatches() public {
    // Try to withdraw more value than commitment
    vm.expectRevert(MerkleProofGenerationFailed.selector);
    _generateWithdrawalProof(
      WithdrawalProofParams({
        existingCommitment: _commitment.hash - 1, // Mismatching existing commitment hash
        withdrawnValue: _commitment.value,
        context: _context,
        label: _commitment.label,
        existingValue: _commitment.value,
        existingNullifier: _commitment.nullifier,
        existingSecret: _commitment.secret,
        newNullifier: _genSecretBySeed('nullifier_2'),
        newSecret: _genSecretBySeed('secret_2')
      })
    );
  }

  /// forge-config: default.allow_internal_expect_revert = true
  function test_failToGenerateProof_whenInvalidWithdrawnValue() public {
    // Try to withdraw more value than commitment
    vm.expectRevert(WithdrawalProofGenerationFailed.selector);
    _generateWithdrawalProof(
      WithdrawalProofParams({
        existingCommitment: _commitment.hash,
        withdrawnValue: _commitment.value + 1, // Greater withdrawn value that existing value
        context: _context,
        label: _commitment.label,
        existingValue: _commitment.value,
        existingNullifier: _commitment.nullifier,
        existingSecret: _commitment.secret,
        newNullifier: _genSecretBySeed('nullifier_2'),
        newSecret: _genSecretBySeed('secret_2')
      })
    );
  }

  /// forge-config: default.allow_internal_expect_revert = true
  function test_failToGenerateProof_whenLabelMismatches() public {
    // Try to withdraw more value than commitment
    vm.expectRevert(MerkleProofGenerationFailed.selector);
    _generateWithdrawalProof(
      WithdrawalProofParams({
        existingCommitment: _commitment.hash,
        withdrawnValue: _commitment.value,
        context: _context,
        label: _commitment.label - 1,
        existingValue: _commitment.value,
        existingNullifier: _commitment.nullifier,
        existingSecret: _commitment.secret,
        newNullifier: _genSecretBySeed('nullifier_2'),
        newSecret: _genSecretBySeed('secret_2')
      })
    );
  }

  /// forge-config: default.allow_internal_expect_revert = true
  function test_failToGenerateProof_whenWithdrawnValueGreaterThanCommitment() public {
    // Try to witdhraw with an invalid commitment value
    vm.expectRevert(WithdrawalProofGenerationFailed.selector);
    _generateWithdrawalProof(
      WithdrawalProofParams({
        existingCommitment: _commitment.hash,
        withdrawnValue: _commitment.value,
        context: _context,
        label: _commitment.label,
        existingValue: _commitment.value + 1, // Greater existing value than actual
        existingNullifier: _commitment.nullifier,
        existingSecret: _commitment.secret,
        newNullifier: _genSecretBySeed('nullifier_2'),
        newSecret: _genSecretBySeed('secret_2')
      })
    );
  }

  /// forge-config: default.allow_internal_expect_revert = true
  function test_failToGenerateProof_whenExistingNullifierMismatches() public {
    // Try to witdhraw with an invalid commitment value
    vm.expectRevert(WithdrawalProofGenerationFailed.selector);
    _generateWithdrawalProof(
      WithdrawalProofParams({
        existingCommitment: _commitment.hash,
        withdrawnValue: _commitment.value,
        context: _context,
        label: _commitment.label,
        existingValue: _commitment.value,
        existingNullifier: _commitment.nullifier - 1, // Different existing nullifier
        existingSecret: _commitment.secret,
        newNullifier: _genSecretBySeed('nullifier_2'),
        newSecret: _genSecretBySeed('secret_2')
      })
    );
  }

  /// forge-config: default.allow_internal_expect_revert = true
  function test_failToGenerateProof_whenExistingSecretMismatches() public {
    // Try to witdhraw with an invalid commitment value
    vm.expectRevert(WithdrawalProofGenerationFailed.selector);
    _generateWithdrawalProof(
      WithdrawalProofParams({
        existingCommitment: _commitment.hash,
        withdrawnValue: _commitment.value,
        context: _context,
        label: _commitment.label,
        existingValue: _commitment.value,
        existingNullifier: _commitment.nullifier,
        existingSecret: _commitment.secret - 1, // Different existing secret
        newNullifier: _genSecretBySeed('nullifier_2'),
        newSecret: _genSecretBySeed('secret_2')
      })
    );
  }

  /// forge-config: default.allow_internal_expect_revert = true
  function test_failToGenerateProof_whenReusingNullifier() public {
    // Try to witdhraw with an invalid commitment value
    vm.expectRevert(WithdrawalProofGenerationFailed.selector);
    _generateWithdrawalProof(
      WithdrawalProofParams({
        existingCommitment: _commitment.hash,
        withdrawnValue: _commitment.value,
        context: _context,
        label: _commitment.label,
        existingValue: _commitment.value,
        existingNullifier: _commitment.nullifier,
        existingSecret: _commitment.secret,
        newNullifier: _genSecretBySeed('nullifier_1'), // same nullifier as spending commitment
        newSecret: _genSecretBySeed('secret_2')
      })
    );
  }

  function test_failToWithdraw_whenPublicSignalMismatch() public {
    // Generate a valid proof
    ProofLib.WithdrawProof memory _proof = _generateWithdrawalProof(
      WithdrawalProofParams({
        existingCommitment: _commitment.hash,
        withdrawnValue: _commitment.value,
        context: _context,
        label: _commitment.label,
        existingValue: _commitment.value,
        existingNullifier: _commitment.nullifier,
        existingSecret: _commitment.secret,
        newNullifier: _genSecretBySeed('nullifier_2'),
        newSecret: _genSecretBySeed('secret_2')
      })
    );

    /*///////////////////////////////////////////////////////////////
                          NEW COMMITMENT HASH
    //////////////////////////////////////////////////////////////*/

    // Change the new commitment hash
    _proof.pubSignals[0] = _proof.pubSignals[0] + 1;

    vm.expectRevert(IPrivacyPool.InvalidProof.selector);
    vm.prank(_BOB);
    _ethPool.withdraw(_withdrawal, _proof);

    // Reset
    _proof.pubSignals[0] = _proof.pubSignals[0] - 1;

    /*///////////////////////////////////////////////////////////////
                      EXISTING NULLIFIER HASH
    //////////////////////////////////////////////////////////////*/

    // Change the existing commitment hash
    _proof.pubSignals[1] = _proof.pubSignals[1] + 1;

    vm.expectRevert(IPrivacyPool.InvalidProof.selector);
    vm.prank(_BOB);
    _ethPool.withdraw(_withdrawal, _proof);

    // Reset
    _proof.pubSignals[1] = _proof.pubSignals[1] - 1;

    /*///////////////////////////////////////////////////////////////
                         WITHDRAWN VALUE
    //////////////////////////////////////////////////////////////*/

    // Change the withdrawn value
    _proof.pubSignals[2] = _proof.pubSignals[2] + 1;

    vm.expectRevert(IPrivacyPool.InvalidProof.selector);
    vm.prank(_BOB);
    _ethPool.withdraw(_withdrawal, _proof);

    // Reset
    _proof.pubSignals[2] = _proof.pubSignals[2] - 1;

    /*///////////////////////////////////////////////////////////////
                           STATE ROOT
    //////////////////////////////////////////////////////////////*/

    // Change the state root value
    _proof.pubSignals[3] = _proof.pubSignals[3] + 1;

    vm.expectRevert(IPrivacyPool.UnknownStateRoot.selector);
    vm.prank(_BOB);
    _ethPool.withdraw(_withdrawal, _proof);

    // Reset
    _proof.pubSignals[3] = _proof.pubSignals[3] - 1;

    /*///////////////////////////////////////////////////////////////
                          STATE TREE DEPTH
    //////////////////////////////////////////////////////////////*/

    // Change the state tree depth value
    _proof.pubSignals[4] = _proof.pubSignals[4] + 1;

    vm.expectRevert(IPrivacyPool.InvalidProof.selector);
    vm.prank(_BOB);
    _ethPool.withdraw(_withdrawal, _proof);

    // Reset
    _proof.pubSignals[4] = _proof.pubSignals[4] - 1;

    /*///////////////////////////////////////////////////////////////
                             ASP ROOT
    //////////////////////////////////////////////////////////////*/

    // Change the asp root value
    _proof.pubSignals[5] = _proof.pubSignals[5] + 1;

    vm.expectRevert(IPrivacyPool.IncorrectASPRoot.selector);
    vm.prank(_BOB);
    _ethPool.withdraw(_withdrawal, _proof);

    // Reset
    _proof.pubSignals[5] = _proof.pubSignals[5] - 1;

    /*///////////////////////////////////////////////////////////////
                         ASP TREE DEPTH
    //////////////////////////////////////////////////////////////*/

    // Change the asp tree depth value
    _proof.pubSignals[6] = _proof.pubSignals[6] + 1;

    vm.expectRevert(IPrivacyPool.InvalidProof.selector);
    vm.prank(_BOB);
    _ethPool.withdraw(_withdrawal, _proof);

    // Reset
    _proof.pubSignals[6] = _proof.pubSignals[6] - 1;

    /*///////////////////////////////////////////////////////////////
                          CONTEXT
    //////////////////////////////////////////////////////////////*/

    // Change the context value
    _proof.pubSignals[7] = _proof.pubSignals[7] + 1;

    vm.expectRevert(IPrivacyPool.ContextMismatch.selector);
    vm.prank(_BOB);
    _ethPool.withdraw(_withdrawal, _proof);
  }
}
