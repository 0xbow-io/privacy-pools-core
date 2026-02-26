// SPDX-License-Identifier: Apache-2.0
pragma solidity ^0.8.0;

import {InternalLeanIMT, LeanIMTData} from 'lean-imt/InternalLeanIMT.sol';

contract TreeBuilder {
  using InternalLeanIMT for LeanIMTData;

  LeanIMTData _merkleTree;

  function depth() public view returns (uint256 _depth) {
    _depth = _merkleTree.depth;
  }

  function root() public view returns (uint256 _root) {
    _root = _merkleTree._root();
  }

  function getRoot(uint256[] calldata _leafs) public returns (uint256 _root) {
    _merkleTree._insertMany(_leafs);

    _root = _merkleTree._root();

    delete _merkleTree;
  }

  function insertMany(uint256[] calldata _leafs) public {
    _merkleTree._insertMany(_leafs);
  }

  function generateProof(
    uint256[] memory _leaves,
    uint256 _index
  ) public returns (uint256[] memory _siblings, uint256 _leaf) {
    // root if only one leaf is the leaf itself (not hashed in a limt)
    if (_leaves.length == 1) return (_siblings, _leaves[0]);

    for (uint256 i = 0; i < _merkleTree.depth;) {
      if (_index % 2 == 0) {
        // collect right
        _siblings[i] = _leaves[_index + 1];
        i++;
      } else {
        // collect left if not empty
        if (_leaves[_index - 1] != 0) {
          _siblings[i] = _leaves[_index - 1];
          i++;
        }
      }

      _index = _index / 2;
    }
  }
}
