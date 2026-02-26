// SPDX-License-Identifier: Apache-2.0
pragma solidity ^0.8.0;

import {PoseidonT3} from 'poseidon/PoseidonT3.sol';
import {PoseidonT4} from 'poseidon/PoseidonT4.sol';

import '../external/Iden3PoseidonBytecodes.sol';

/// @notice This test checks the equivalence of the Poseidon hash function implementations used in
/// PrivacyPool and the IMT library with the Iden3 implementation
contract PropertiesPoseidon is Iden3PoseidonBytecodes {
  IPoseidon2 _idenPoseidon2 = IPoseidon2(address(1234));
  IPoseidon3 _idenPoseidon3 = IPoseidon3(address(5679));

  constructor() {
    address _t2;
    address _t3;
    bytes memory t2_bytecode = POSEIDON_T2_BYTECODE;
    bytes memory t3_bytecode = POSEIDON_T3_BYTECODE;
    uint256 t2_length = t2_bytecode.length;
    uint256 t3_length = t3_bytecode.length;

    assembly {
      _t2 := create(0, add(t2_bytecode, 32), t2_length)
      _t3 := create(0, add(t3_bytecode, 32), t3_length)

      // Verify deployment was successful
      if iszero(_t2) { revert(0, 0) }
      if iszero(_t3) { revert(0, 0) }
    }

    _idenPoseidon2 = IPoseidon2(_t2);
    _idenPoseidon3 = IPoseidon3(_t3);
  }

  function property_poseidon_t3_equivalence(uint256 a, uint256 b) public {
    uint256 _t3 = PoseidonT3.hash([a, b]);
    uint256 _t3_2 = _idenPoseidon2.poseidon([a, b]);
    assert(_t3 == _t3_2);
  }

  function property_poseidon_t4_equivalence(uint256 a, uint256 b, uint256 c) public {
    uint256 _t4 = PoseidonT4.hash([a, b, c]);
    uint256 _t4_2 = _idenPoseidon3.poseidon([a, b, c]);
    assert(_t4 == _t4_2);
  }
}

interface IPoseidon2 {
  function poseidon(uint256[2] calldata el) external pure returns (uint256);
}

interface IPoseidon3 {
  function poseidon(uint256[3] calldata el) external pure returns (uint256);
}
