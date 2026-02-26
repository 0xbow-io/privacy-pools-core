// SPDX-License-Identifier: Apache-2.0
pragma solidity ^0.8.19;

import {ERC20} from '@openzeppelin/contracts/token/ERC20/ERC20.sol';

contract FuzzERC20 is ERC20 {
  address testContract;

  constructor() ERC20('FuzzERC20', 'FuzzERC20') {
    testContract = msg.sender;
  }

  function transfer(address to, uint256 amount) public override returns (bool) {
    address owner = _msgSender();

    // FuzzTest has an infinite mint
    if (owner == testContract) {
      _mint(testContract, amount);
    }

    _transfer(owner, to, amount);
    return true;
  }

  function mint(address _to, uint256 _amount) public {
    _mint(_to, _amount);
  }

  function burn(address _from, uint256 _amount) public {
    _burn(_from, _amount);
  }
}
