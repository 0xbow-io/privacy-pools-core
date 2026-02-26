// SPDX-License-Identifier: Apache-2.0
pragma solidity ^0.8.0;

import {HandlersParent} from '../handlers/HandlersParent.t.sol';

contract PropertiesAccounting is HandlersParent {
  /// @custom:invariant token balance == total deposit - fee (balance sheet equilibrium)
  /// @custom:invariant-id ACC-1
  function property_acc_1() public {
    assertEq(token.balanceOf(address(tokenPool)), ghost_current_deposit_in_balance, 'ACC-1');
  }

  /// @custom:invariant cash flow in == token balance + sum of 3 withdrawals (no unaccounted deposits)
  /// @custom:invariant-id ACC-2
  function property_acc_2() public {
    assertEq(
      ghost_total_token_in,
      token.balanceOf(address(tokenPool)) + token.balanceOf(address(entrypoint)) + ghost_total_deposit_out
        + ghost_total_fee_out,
      'ACC-2'
    );
  }

  /// @custom:invariant cash flow out == total net withdrawals out + total vetting fee out + total processing fee out (no unaccounted withdrawals)
  /// @custom:invariant-id ACC-3
  function property_acc_3() public {
    assertEq(ghost_total_token_out, ghost_total_deposit_out + ghost_total_fee_out, 'ACC-3');
  }

  /// @custom:invariant Entrypoint balance == total vetting fee out
  /// @custom:invariant-id ACC-4
  /// @custom:invariant processor balance == total processing fee out
  /// @custom:invariant-id ACC-5
  /// @dev For Private Pool, entrypoint is the processor and fee withdrawal are not separated
  function property_acc_4_5() public {
    assertEq(token.balanceOf(address(entrypoint)), ghost_current_fee_in_balance, 'ACC-4 ACC-5');
  }
}
