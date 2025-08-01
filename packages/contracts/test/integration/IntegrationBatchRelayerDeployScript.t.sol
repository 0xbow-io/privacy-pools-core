// SPDX-License-Identifier: Apache-2.0
pragma solidity 0.8.28;

import {Test} from 'forge-std/Test.sol';
import {IBatchRelayer} from 'interfaces/IBatchRelayer.sol';
import {DeployBatchRelayer} from 'script/BatchRelayer.s.sol';

contract IntegrationBatchRelayerDeployScript is Test {
  function setUp() public {
    vm.createSelectFork(vm.rpcUrl('mainnet'));
  }

  function test_deployScript() public {
    IBatchRelayer _batchRelayer = new DeployBatchRelayer().run();

    assertEq(_batchRelayer.MAX_RELAY_FEE_BPS(), 500);
  }
}
