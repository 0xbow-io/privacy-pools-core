// SPDX-License-Identifier: Apache-2.0
pragma solidity ^0.8.0;

import {vm} from './FuzzUtils.sol';
import {PropertiesLibString} from './FuzzUtils.sol';

contract Actors {
  event LogString(string);

  function call(address _target, uint256 _value, bytes memory _data) public returns (bool success, bytes memory result) {
    emit LogString(
      string.concat(
        'calling 0x',
        PropertiesLibString.toString(_target),
        ' using the actor 0x',
        PropertiesLibString.toString(address(this))
      )
    );
    (success, result) = _target.call{value: _value}(_data);
  }
}

contract HandlerActors {
  Actors[] internal actors;

  function currentActor() internal view returns (Actors) {
    return actors[uint256(uint160(msg.sender)) % actors.length];
  }

  function pickRandomActor(uint256 _seed) internal view returns (Actors) {
    return actors[_seed % (actors.length - 1)];
  }

  function createNewActors(uint256 _amount) internal {
    for (uint256 i = 0; i < _amount; i++) {
      actors.push(new Actors());
      vm.deal(address(actors[actors.length - 1]), 100_000 ether);
    }
  }
}
