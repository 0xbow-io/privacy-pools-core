// SPDX-License-Identifier: Apache-2.0
pragma solidity ^0.8.0;

import {HandlersEntrypoint} from './HandlersEntrypoint.t.sol';

contract HandlersParent is HandlersEntrypoint {
  function handler_mockVerifier_switchProofValidity() public {
    mockVerifier.ForTest_switchProofValidity();
  }
}
