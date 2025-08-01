// SPDX-License-Identifier: Apache-2.0
pragma solidity 0.8.28;

import {BatchRelayer} from 'contracts/BatchRelayer.sol';
import {Script} from 'forge-std/Script.sol';
import {console} from 'forge-std/console.sol';
import {IBatchRelayer} from 'interfaces/IBatchRelayer.sol';

contract DeployBatchRelayer is Script {
  uint256 public constant MAX_RELAY_FEE_BPS = 500; // 5%

  /// @dev Must be called with the `--account` flag which acts as the caller
  function run() public returns (IBatchRelayer _batchRelayer) {
    vm.startBroadcast();
    _batchRelayer = new BatchRelayer(MAX_RELAY_FEE_BPS);
    vm.stopBroadcast();

    console.log('Batch Relayer deployed at: %s', address(_batchRelayer));
  }
}
