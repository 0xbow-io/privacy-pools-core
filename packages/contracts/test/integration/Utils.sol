// SPDX-License-Identifier: Apache-2.0
pragma solidity 0.8.28;

import {PoseidonT2} from 'poseidon/PoseidonT2.sol';
import {PoseidonT3} from 'poseidon/PoseidonT3.sol';
import {PoseidonT4} from 'poseidon/PoseidonT4.sol';

import {Constants} from 'test/helper/Constants.sol';

contract IntegrationUtils {
  function _concat(string[] memory _arr1, string[] memory _arr2) internal pure returns (string[] memory) {
    string[] memory returnArr = new string[](_arr1.length + _arr2.length);
    uint256 i;
    for (; i < _arr1.length;) {
      returnArr[i] = _arr1[i];
      unchecked {
        ++i;
      }
    }
    uint256 j;
    for (; j < _arr2.length;) {
      returnArr[i + j] = _arr2[j];
      unchecked {
        ++j;
      }
    }
    return returnArr;
  }

  function _deductFee(uint256 _amount, uint256 _feeBPS) internal pure returns (uint256 _afterFees) {
    _afterFees = _amount - ((_amount * _feeBPS) / 10_000);
  }

  function _hashNullifier(uint256 _nullifier) internal pure returns (uint256 _nullifierHash) {
    _nullifierHash = PoseidonT2.hash([_nullifier]);
  }

  function _hashPrecommitment(uint256 _nullifier, uint256 _secret) internal pure returns (uint256 _precommitment) {
    _precommitment = PoseidonT3.hash([_nullifier, _secret]);
  }

  function _hashCommitment(
    uint256 _amount,
    uint256 _label,
    uint256 _precommitment
  ) internal pure returns (uint256 _commitmentHash) {
    _commitmentHash = PoseidonT4.hash([_amount, _label, _precommitment]);
  }

  function _genSecretBySeed(string memory _seed) internal pure returns (uint256 _secret) {
    _secret = uint256(keccak256(bytes(_seed))) % Constants.SNARK_SCALAR_FIELD;
  }
}
