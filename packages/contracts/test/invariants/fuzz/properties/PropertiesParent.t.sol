// SPDX-License-Identifier: Apache-2.0
pragma solidity ^0.8.0;

import {Actors} from '../helpers/Actors.sol';
import {PropertiesAccounting} from './PropertiesAccounting.t.sol';
import {PropertiesPool} from './PropertiesPool.t.sol';
import {PropertiesPoseidon} from './PropertiesPoseidon.t.sol';
import {ProofLib} from 'contracts/PrivacyPool.sol';

contract PropertiesParent is PropertiesAccounting, PropertiesPool, PropertiesPoseidon {
  function property_protocolWindDown() public {
    // Force only valid proofs
    if (!mockVerifier.validProof()) this.handler_mockVerifier_switchProofValidity();

    // Initiate wind down
    this.handler_windDown();

    for (uint256 i = 0; i < actors.length; i++) {
      uint256 _numberOfCommitments = ghost_depositsOf[address(actors[i])].length; // we pop in the property
      for (uint256 j = 0; j < _numberOfCommitments; j++) {
        this.property_onlyOriginalDepositorCanRagequit(i);
      }
    }

    this.handler_withdrawFees();

    assertEq(token.balanceOf(address(tokenPool)), 0, 'Shutdown: pool non empty');
    assertEq(token.balanceOf(address(entrypoint)), 0, 'Shutdown: fee non emptied');
  }
}
