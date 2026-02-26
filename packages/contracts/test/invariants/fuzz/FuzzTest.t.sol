// SPDX-License-Identifier: Apache-2.0
pragma solidity ^0.8.0;

import {PropertiesParent} from './properties/PropertiesParent.t.sol';
import {Constants} from 'test/helper/Constants.sol';

contract FuzzTest is PropertiesParent {
  function property_sanityCheck() public {
    assertTrue(address(entrypoint) != address(0), 'Entrypoint is not deployed');
    assertTrue(address(nativePool) != address(0), 'Native pool is not deployed');
    assertTrue(address(tokenPool) != address(0), 'Token pool is not deployed');

    assertEq(nativePool.ASSET(), address(Constants.NATIVE_ASSET), 'wrong token for native token pool');
    assertEq(tokenPool.ASSET(), address(token), 'wrong token for token pool');

    assertTrue(nativePool.SCOPE() != 0, 'Native pool scope is not set');
    assertTrue(tokenPool.SCOPE() != 0, 'Token pool scope is not set');
  }
}
