// SPDX-License-Identifier: Apache-2.0
pragma solidity ^0.8.0;

import {IVerifier} from 'interfaces/IVerifier.sol';

contract MockVerifier is IVerifier {
  bool public validProof = true;

  function ForTest_switchProofValidity() public {
    validProof = !validProof;
  }

  // Ragequit
  function verifyProof(
    uint256[2] calldata,
    uint256[2][2] calldata,
    uint256[2] calldata,
    uint256[4] calldata
  ) public view returns (bool) {
    return validProof;
  }

  // Withdrawal
  function verifyProof(
    uint256[2] calldata,
    uint256[2][2] calldata,
    uint256[2] calldata,
    uint256[8] calldata
  ) public view returns (bool) {
    return validProof;
  }
}
