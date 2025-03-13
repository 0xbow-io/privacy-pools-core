// SPDX-License-Identifier: Apache-2.0
pragma solidity ^0.8.0;

contract GhostStorage {
  uint256 constant FEE_DENOMINATOR = 10_000;
  uint256 constant FEE_VETTING = 101;
  uint256 constant MAX_RELAY_FEE = 150;
  uint256 constant FEE_PROCESSING = 103;
  /////////////////////////////////////////////////////////////////////
  //                     Ghost deposit tracking                     //
  /////////////////////////////////////////////////////////////////////

  struct GhostDeposit {
    uint256 commitment;
    uint256 depositAmount;
    uint256 label;
  }

  mapping(address actor => GhostDeposit[] deposits) internal ghost_depositsOf;

  // Tracked in parallel, as ordering matters when recomputing the root
  uint256[] internal ghost_allCommitments;

  mapping(uint256 nullifier => bool used) internal ghost_nullifier_used;
  uint256 internal ghost_nullifiers_seed;

  /////////////////////////////////////////////////////////////////////
  //                        Ghost accounting                         //
  /////////////////////////////////////////////////////////////////////

  /// @dev the total amount of token which has ever been deposited
  uint256 internal ghost_total_token_in;

  /// @dev the total amount of token which has ever been withdrawn
  uint256 internal ghost_total_token_out;

  /// @dev the total amount of net (excl vetting fee) deposit currently in pool
  uint256 internal ghost_current_deposit_in_balance;

  /// @dev the total amount of fee currently in the entrypoint
  uint256 internal ghost_current_fee_in_balance;

  /// @dev the total amount which has been withdrawn
  uint256 internal ghost_total_deposit_out;

  /// @dev the total amount of fee already withdrawn
  uint256 internal ghost_total_fee_out;

  address internal ghost_processingFeeRecipient = address(0xfeefeefeefee);

  /////////////////////////////////////////////////////////////////////
  //                             Helpers                             //
  /////////////////////////////////////////////////////////////////////

  function ghost_total_fee() internal view returns (uint256) {
    return ghost_total_fee_out + ghost_current_fee_in_balance;
  }

  function _updateGhostAccountingWithdraw(uint256 _amount) internal {
    ghost_total_token_out += _amount;
    ghost_total_deposit_out += _amount - _amount * FEE_PROCESSING / FEE_DENOMINATOR;
    ghost_total_fee_out += _amount * FEE_PROCESSING / FEE_DENOMINATOR; // Direct transfer to ghost_processingFeeRecipient

    ghost_current_deposit_in_balance -= _amount;
  }

  function _updateGhostAccountingRagequit(uint256 _amount) internal {
    ghost_total_token_out += _amount;
    ghost_total_deposit_out += _amount; // no fee
    ghost_current_deposit_in_balance -= _amount;
  }
}
