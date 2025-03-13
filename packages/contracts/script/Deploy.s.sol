// SPDX-License-Identifier: Apache-2.0

pragma solidity 0.8.28;

import {ERC20, IERC20} from '@oz/token/ERC20/ERC20.sol';
import {UnsafeUpgrades} from '@upgrades/Upgrades.sol';
import {Script} from 'forge-std/Script.sol';
import {console} from 'forge-std/console.sol';

import {Constants} from 'contracts/lib/Constants.sol';

import {IPrivacyPool} from 'interfaces/IPrivacyPool.sol';

import {Entrypoint} from 'contracts/Entrypoint.sol';
import {PrivacyPoolComplex} from 'contracts/implementations/PrivacyPoolComplex.sol';
import {PrivacyPoolSimple} from 'contracts/implementations/PrivacyPoolSimple.sol';
import {CommitmentVerifier} from 'contracts/verifiers/CommitmentVerifier.sol';
import {WithdrawalVerifier} from 'contracts/verifiers/WithdrawalVerifier.sol';

/*///////////////////////////////////////////////////////////////
                      TEST TOKEN
//////////////////////////////////////////////////////////////*/

contract TestToken is ERC20 {
  constructor() ERC20('Test Token', 'TST') {
    _mint(msg.sender, 1_000_000 * 10 ** decimals());
  }
}

/*///////////////////////////////////////////////////////////////
                    BASE DEPLOY SCRIPT
//////////////////////////////////////////////////////////////*/

/**
 * @notice Abstract script to deploy the PrivacyPool protocol.
 * @dev Assets and chain specific configurations must be defined in a parent contract.
 */
abstract contract DeployProtocol is Script {
  // @notice Struct for Pool deployment and configuration
  struct PoolConfig {
    string symbol;
    IERC20 asset;
    uint256 minimumDepositAmount;
    uint256 vettingFeeBPS;
    uint256 maxRelayFeeBPS;
  }

  // @notice Deployed Entrypoint
  Entrypoint public entrypoint;
  // @notice Deployed Groth16 Withdrawal Verifier
  WithdrawalVerifier public withdrawalVerifier;
  // @notice Deployed Groth16 Ragequit Verifier
  CommitmentVerifier public ragequitVerifier;

  // @notice Initial Entrypoint `ONWER_ROLE`
  address public owner;
  // @notice Initial Entrypoint `POSTMAN_ROLE`
  address public postman;

  // @notice Native asset pool configuration
  PoolConfig internal _simpleConfig;
  // @notice ERC20 pools configurations
  PoolConfig[] internal _poolConfigs;

  function setUp() public virtual {
    owner = vm.envAddress('OWNER_ADDRESS');
    postman = vm.envAddress('POSTMAN_ADDRESS');
  }

  // @dev Must be called with the `--account` flag which acts as the caller
  function run() public virtual {
    vm.startBroadcast();

    // Deploy verifiers
    _deployGroth16Verifiers();
    // Deploy Entrypoint
    _deployEntrypoint();

    // Deploy the native asset pool
    _deploySimplePool(
      _simpleConfig.symbol,
      _simpleConfig.minimumDepositAmount,
      _simpleConfig.vettingFeeBPS,
      _simpleConfig.maxRelayFeeBPS
    );

    // Deploy the ERC20 pools
    // for (uint256 _i; _i < _poolConfigs.length; ++_i) {
    //   PoolConfig memory _config = _poolConfigs[_i];
    //   _deployComplexPool(_config.symbol, _config.asset, _config.minimumDepositAmount, _config.vettingFeeBPS, _config.maxRelayFeeBPS);
    // }

    vm.stopBroadcast();
  }

  function _deployGroth16Verifiers() private {
    withdrawalVerifier = new WithdrawalVerifier();
    ragequitVerifier = new CommitmentVerifier();

    console.log('Withdrawal Verifier deployed at: %s', address(withdrawalVerifier));
    console.log('Ragequit Verifier deployed at: %s', address(ragequitVerifier));
  }

  function _deployEntrypoint() private {
    // Deploy implementation
    address _impl = address(new Entrypoint());

    // Deploy and initialize proxy
    entrypoint = Entrypoint(
      payable(UnsafeUpgrades.deployUUPSProxy(_impl, abi.encodeCall(Entrypoint.initialize, (owner, postman))))
    );

    console.log('Entrypoint deployed at: %s', address(entrypoint));
  }

  function _deploySimplePool(
    string memory _symbol,
    uint256 _minimumDepositAmount,
    uint256 _vettingFeeBPS,
    uint256 _maxRelayFeeBPS
  ) private {
    // Deploy pool
    IPrivacyPool _pool = IPrivacyPool(
      address(new PrivacyPoolSimple(address(entrypoint), address(withdrawalVerifier), address(ragequitVerifier)))
    );

    // Register pool at entrypoint with defined configuration
    entrypoint.registerPool(
      IERC20(Constants.NATIVE_ASSET), _pool, _minimumDepositAmount, _vettingFeeBPS, _maxRelayFeeBPS
    );

    console.log('%s Pool deployed at: %s', _symbol, address(_pool));
  }

  function _deployComplexPool(
    string memory _symbol,
    IERC20 _asset,
    uint256 _minimumDepositAmount,
    uint256 _vettingFeeBPS,
    uint256 _maxRelayFeeBPS
  ) private {
    // Deploy pool
    IPrivacyPool _pool = IPrivacyPool(
      address(
        new PrivacyPoolComplex(
          address(entrypoint), address(withdrawalVerifier), address(ragequitVerifier), address(_asset)
        )
      )
    );

    // Register pool at entrypoint with defined configuration
    entrypoint.registerPool(_asset, _pool, _minimumDepositAmount, _vettingFeeBPS, _maxRelayFeeBPS);

    console.log('%s Pool deployed at: %s', _symbol, address(_pool));
  }

  function _deployTestToken() internal returns (IERC20 _asset) {
    _asset = IERC20(address(new TestToken()));
    console.log('TestToken deployed at: %s', address(_asset));
  }
}

/*///////////////////////////////////////////////////////////////
                     ETHEREUM SEPOLIA 
//////////////////////////////////////////////////////////////*/

// @notice Protocol configuration for Ethereum Sepolia
contract EthereumSepolia is DeployProtocol {
  function setUp() public override {
    // Native asset pool
    _simpleConfig = PoolConfig({
      symbol: 'ETH',
      asset: IERC20(Constants.NATIVE_ASSET),
      minimumDepositAmount: 0.001 ether,
      vettingFeeBPS: 100,
      maxRelayFeeBPS: 100
    });

    super.setUp();
  }

  // Overriding `run` to deploy TestToken before deploying the protocol
  function run() public override {
    vm.startBroadcast();

    // TestToken
    // _poolConfigs.push(
    //   PoolConfig({symbol: 'TST', asset: _deployTestToken(), minimumDepositAmount: 100 ether, vettingFeeBPS: 100}) // 1%
    // );

    vm.stopBroadcast();

    super.run();
  }
}

/*///////////////////////////////////////////////////////////////
                     ETHEREUM MAINNET
//////////////////////////////////////////////////////////////*/

// @notice Protocol configuration for Ethereum Mainnet
// TODO: update with actual mainnet configuration
contract EthereumMainnet is DeployProtocol {
  function setUp() public override {
    // Native asset pool
    _simpleConfig = PoolConfig({
      symbol: 'ETH',
      asset: IERC20(Constants.NATIVE_ASSET),
      minimumDepositAmount: 0.001 ether,
      vettingFeeBPS: 100,
      maxRelayFeeBPS: 100
    });

    // USDT
    _poolConfigs.push(
      PoolConfig({
        symbol: 'USDT',
        asset: IERC20(address(0)),
        minimumDepositAmount: 100 ether,
        vettingFeeBPS: 100,
        maxRelayFeeBPS: 100
      })
    );

    // USDC
    _poolConfigs.push(
      PoolConfig({
        symbol: 'USDC',
        asset: IERC20(address(0)),
        minimumDepositAmount: 100 ether,
        vettingFeeBPS: 100,
        maxRelayFeeBPS: 100
      })
    );

    super.setUp();
  }
}
