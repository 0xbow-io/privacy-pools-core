// SPDX-License-Identifier: Apache-2.0
pragma solidity 0.8.28;

import {DeployProtocol} from './BaseDeploy.s.sol';
import {IERC20} from '@oz/token/ERC20/ERC20.sol';
import {Constants} from 'contracts/lib/Constants.sol';

/*///////////////////////////////////////////////////////////////
                        TESTNETS
//////////////////////////////////////////////////////////////*/

// @notice Protocol configuration for Ethereum Sepolia
contract EthereumSepolia is DeployProtocol {
  function setUp() public override chainId(11_155_111) {
    // Native asset pool
    _nativePoolConfig = PoolConfig({
      symbol: 'ETH',
      asset: IERC20(Constants.NATIVE_ASSET),
      minimumDepositAmount: 0.001 ether,
      vettingFeeBPS: 100,
      maxRelayFeeBPS: 100
    });

    super.setUp();
  }
}

contract GnosisChiado is DeployProtocol {
  function setUp() public override chainId(10_200) {
    // Native asset pool
    _nativePoolConfig = PoolConfig({
      symbol: 'xDAI',
      asset: IERC20(Constants.NATIVE_ASSET),
      minimumDepositAmount: 100 ether, // 18 decimals -> 100 xDAI
      vettingFeeBPS: 100,
      maxRelayFeeBPS: 100
    });

    super.setUp();
  }
}

/*///////////////////////////////////////////////////////////////
                       MAINNETS
//////////////////////////////////////////////////////////////*/

// @notice Protocol configuration for Ethereum Mainnet
contract EthereumMainnet is DeployProtocol {
  function setUp() public override chainId(1) {
    // Native asset pool
    _nativePoolConfig = PoolConfig({
      symbol: 'ETH',
      asset: IERC20(Constants.NATIVE_ASSET),
      minimumDepositAmount: 0.01 ether, // ~$200
      vettingFeeBPS: 50, // 0.5%
      maxRelayFeeBPS: 100 // 1%
    });

    super.setUp();
  }
}

// @notice Protocol configuration for Gnosis
contract Gnosis is DeployProtocol {
  function setUp() public override chainId(100) {
    // Native asset pool
    _nativePoolConfig = PoolConfig({
      symbol: 'xDAI',
      asset: IERC20(Constants.NATIVE_ASSET),
      minimumDepositAmount: 0.1 ether, // 18 decimals -> 100 xDAI
      vettingFeeBPS: 100,
      maxRelayFeeBPS: 100
    });

    super.setUp();
  }
}
