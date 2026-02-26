// SPDX-License-Identifier: Apache-2.0
pragma solidity 0.8.28;

import {ERC1967Proxy} from '@oz/proxy/ERC1967/ERC1967Proxy.sol';
import {IERC20} from '@oz/token/ERC20/ERC20.sol';
import {Script} from 'forge-std/Script.sol';
// intentionally using console for deployment logging

import {Strings} from '@oz/utils/Strings.sol';
import {stdJson} from 'forge-std/StdJson.sol';
import {Vm, VmSafe} from 'forge-std/Vm.sol';
import {console} from 'forge-std/console.sol';

import {Constants} from 'contracts/lib/Constants.sol';
import {DeployLib} from 'contracts/lib/DeployLib.sol';

import {IPrivacyPool} from 'interfaces/IPrivacyPool.sol';
import {ICreateX} from 'interfaces/external/ICreateX.sol';

import {Entrypoint} from 'contracts/Entrypoint.sol';
import {PrivacyPoolComplex} from 'contracts/implementations/PrivacyPoolComplex.sol';
import {PrivacyPoolSimple} from 'contracts/implementations/PrivacyPoolSimple.sol';
import {CommitmentVerifier} from 'contracts/verifiers/CommitmentVerifier.sol';
import {WithdrawalVerifier} from 'contracts/verifiers/WithdrawalVerifier.sol';

/*///////////////////////////////////////////////////////////////
                    BASE DEPLOY SCRIPT
//////////////////////////////////////////////////////////////*/

/**
 * @notice Abstract script to deploy the PrivacyPool protocol.
 * @dev Assets and chain specific configurations must be defined in a parent contract.
 */
abstract contract DeployProtocol is Script {
  using stdJson for string;

  // @notice Struct for Pool deployment and configuration
  struct PoolConfig {
    string symbol;
    IERC20 asset;
    uint256 minimumDepositAmount;
    uint256 vettingFeeBPS;
    uint256 maxRelayFeeBPS;
  }

  // @notice Struct for recording deployment data
  struct DeploymentData {
    string contractName;
    address contractAddress;
    address deployer;
    uint256 deploymentBlock;
    uint256 scope;
    address asset;
    bytes constructorArgs;
  }

  error ChainIdAndRPCMismatch();

  // @notice Deployed Entrypoint
  Entrypoint public entrypoint;
  // @notice Deployed Groth16 Withdrawal Verifier
  address public withdrawalVerifier;
  // @notice Deployed Groth16 Ragequit Verifier
  address public ragequitVerifier;

  // @notice Initial Entrypoint `ONWER_ROLE`
  address public owner;
  // @notice Initial Entrypoint `POSTMAN_ROLE`
  address public postman;

  address public deployer;

  // @notice CreateX Singleton
  ICreateX public constant CreateX = ICreateX(0xba5Ed099633D3B313e4D5F7bdc1305d3c28ba5Ed);

  // @notice Native asset pool configuration
  PoolConfig internal _nativePoolConfig;
  // @notice ERC20 pools configurations
  PoolConfig[] internal _tokenPoolConfigs;

  // @notice Array to store deployment data
  DeploymentData[] internal _deploymentData;

  function setUp() public virtual {
    owner = vm.envAddress('OWNER_ADDRESS');
    postman = vm.envAddress('POSTMAN_ADDRESS');

    deployer = vm.envAddress('DEPLOYER_ADDRESS');
  }

  // @dev Must be called with the `--account` flag which acts as the caller
  function run() public virtual {
    vm.startBroadcast(deployer);

    // Clear deployment data array
    delete _deploymentData;

    // Deploy verifiers
    _deployGroth16Verifiers();
    // Deploy Entrypoint
    _deployEntrypoint();

    // Deploy the native asset pool
    _deploySimplePool(_nativePoolConfig);

    // Deploy the ERC20 pools
    for (uint256 _i; _i < _tokenPoolConfigs.length; ++_i) {
      _deployComplexPool(_tokenPoolConfigs[_i]);
    }

    // Save deployment data to JSON file if in broadcast mode
    if (vm.isContext(VmSafe.ForgeContext.ScriptBroadcast)) {
      _saveDeploymentData();
    }

    vm.stopBroadcast();
  }

  function _deployGroth16Verifiers() private {
    // Deploy WithdrawalVerifier using Create2
    withdrawalVerifier = CreateX.deployCreate2(
      DeployLib.salt(deployer, DeployLib.WITHDRAWAL_VERIFIER_SALT),
      abi.encodePacked(type(WithdrawalVerifier).creationCode)
    );

    // intentionally using console for deployment feedback
    console.log('Withdrawal Verifier deployed at: %s', withdrawalVerifier);

    // Add to deployment data
    _deploymentData.push(
      DeploymentData({
        contractName: 'WithdrawalVerifier',
        contractAddress: withdrawalVerifier,
        deployer: deployer,
        deploymentBlock: block.number,
        scope: 0,
        asset: address(0),
        constructorArgs: bytes('')
      })
    );

    // Deploy CommitmentVerifier using Create2
    ragequitVerifier = CreateX.deployCreate2(
      DeployLib.salt(deployer, DeployLib.RAGEQUIT_VERIFIER_SALT),
      abi.encodePacked(type(CommitmentVerifier).creationCode)
    );

    // intentionally using console for deployment feedback
    console.log('Ragequit Verifier deployed at: %s', ragequitVerifier);

    // Add to deployment data
    _deploymentData.push(
      DeploymentData({
        contractName: 'CommitmentVerifier',
        contractAddress: ragequitVerifier,
        deployer: deployer,
        deploymentBlock: block.number,
        scope: 0,
        asset: address(0),
        constructorArgs: bytes('')
      })
    );
  }

  function _deployEntrypoint() private {
    // Deploy Entrypoint implementation
    address _impl =
      CreateX.deployCreate2(DeployLib.salt(deployer, DeployLib.ENTRYPOINT_IMPL_SALT), type(Entrypoint).creationCode);

    // Encode `initialize` call data
    bytes memory _intializationData = abi.encodeCall(Entrypoint.initialize, (owner, postman));

    // Deploy proxy and initialize
    address _entrypoint = CreateX.deployCreate2(
      DeployLib.salt(deployer, DeployLib.ENTRYPOINT_PROXY_SALT),
      abi.encodePacked(type(ERC1967Proxy).creationCode, abi.encode(_impl, _intializationData))
    );

    entrypoint = Entrypoint(payable(_entrypoint));

    // intentionally using console for deployment feedback
    console.log('Entrypoint deployed at: %s', address(entrypoint));

    // Add implementation to deployment data
    _deploymentData.push(
      DeploymentData({
        contractName: 'Entrypoint_Implementation',
        contractAddress: _impl,
        deployer: deployer,
        deploymentBlock: block.number,
        scope: 0,
        asset: address(0),
        constructorArgs: bytes('')
      })
    );

    // Encode constructor args for proxy
    bytes memory proxyArgs = abi.encode(_impl, _intializationData);

    // Add proxy to deployment data
    _deploymentData.push(
      DeploymentData({
        contractName: 'Entrypoint_Proxy',
        contractAddress: address(entrypoint),
        deployer: deployer,
        deploymentBlock: block.number,
        scope: 0,
        asset: address(0),
        constructorArgs: proxyArgs
      })
    );
  }

  function _deploySimplePool(PoolConfig memory _config) private {
    // Encode constructor args
    bytes memory constructorArgs = abi.encode(address(entrypoint), withdrawalVerifier, ragequitVerifier);

    // Deploy pool with Create2
    address _pool = CreateX.deployCreate2(
      DeployLib.salt(deployer, DeployLib.SIMPLE_POOL_SALT),
      abi.encodePacked(type(PrivacyPoolSimple).creationCode, constructorArgs)
    );

    // Register pool at entrypoint with defined configuration
    entrypoint.registerPool(
      IERC20(Constants.NATIVE_ASSET),
      IPrivacyPool(_pool),
      _config.minimumDepositAmount,
      _config.vettingFeeBPS,
      _config.maxRelayFeeBPS
    );

    // intentionally using console for deployment feedback
    console.log('%s Pool deployed at: %s', _config.symbol, _pool);

    // Get the actual scope from the deployed pool
    uint256 poolScope = IPrivacyPool(_pool).SCOPE();

    // Add to deployment data
    _deploymentData.push(
      DeploymentData({
        contractName: string.concat('PrivacyPoolSimple_', _config.symbol),
        contractAddress: _pool,
        deployer: deployer,
        deploymentBlock: block.number,
        scope: poolScope,
        asset: Constants.NATIVE_ASSET,
        constructorArgs: constructorArgs
      })
    );
  }

  function _deployComplexPool(PoolConfig memory _config) private {
    // Encode constructor args
    bytes memory constructorArgs =
      abi.encode(address(entrypoint), withdrawalVerifier, ragequitVerifier, address(_config.asset));

    // Deploy pool with Create2
    bytes11 _tokenSalt = bytes11(keccak256(abi.encodePacked(DeployLib.COMPLEX_POOL_SALT, _config.symbol)));

    address _pool = CreateX.deployCreate2(
      DeployLib.salt(deployer, _tokenSalt), abi.encodePacked(type(PrivacyPoolComplex).creationCode, constructorArgs)
    );

    // Register pool at entrypoint with defined configuration
    entrypoint.registerPool(
      _config.asset, IPrivacyPool(_pool), _config.minimumDepositAmount, _config.vettingFeeBPS, _config.maxRelayFeeBPS
    );

    // intentionally using console for deployment feedback
    console.log('%s Pool deployed at: %s', _config.symbol, _pool);

    // Get the actual scope from the deployed pool
    uint256 poolScope = IPrivacyPool(_pool).SCOPE();

    // Add to deployment data
    _deploymentData.push(
      DeploymentData({
        contractName: string.concat('PrivacyPoolComplex_', _config.symbol),
        contractAddress: _pool,
        deployer: deployer,
        deploymentBlock: block.number,
        scope: poolScope,
        asset: address(_config.asset),
        constructorArgs: constructorArgs
      })
    );
  }

  function _saveDeploymentData() private {
    // Manually create a well-formatted JSON string
    string memory jsonString = '{';

    // Add chainId
    jsonString = string.concat(jsonString, '"chainId":', vm.toString(block.chainid), ',');

    // Start contracts array
    jsonString = string.concat(jsonString, '"contracts":[');

    // Add each contract as a JSON object in the array
    for (uint256 i = 0; i < _deploymentData.length; i++) {
      // Start the contract object
      jsonString = string.concat(jsonString, '{');

      // Always include name, address, deployer, and deploymentBlock
      jsonString = string.concat(
        jsonString,
        '"name":"',
        _deploymentData[i].contractName,
        '",',
        '"address":"',
        _addressToString(_deploymentData[i].contractAddress),
        '",',
        '"deployer":"',
        _addressToString(_deploymentData[i].deployer),
        '",',
        '"deploymentBlock":',
        vm.toString(_deploymentData[i].deploymentBlock)
      );

      // Only include scope if not 0
      if (_deploymentData[i].scope != 0) {
        jsonString = string.concat(jsonString, ',', '"scope":', vm.toString(_deploymentData[i].scope));
      }

      // Only include asset if not zero address
      if (_deploymentData[i].asset != address(0)) {
        jsonString = string.concat(jsonString, ',', '"asset":"', _addressToString(_deploymentData[i].asset), '"');
      }

      // Only include constructorArgs if not empty
      if (_deploymentData[i].constructorArgs.length > 0) {
        jsonString = string.concat(
          jsonString, ',', '"constructorArgs":"', _bytesToHexString(_deploymentData[i].constructorArgs), '"'
        );
      }

      // Close the object
      jsonString = string.concat(jsonString, '}');

      // Add comma between objects, but not after the last one
      if (i < _deploymentData.length - 1) {
        jsonString = string.concat(jsonString, ',');
      }
    }

    // Close the contracts array and the main object
    jsonString = string.concat(jsonString, ']}');

    // Write the JSON string to file
    string memory fileName = string.concat('deployments/', vm.toString(block.chainid), '.json');
    vm.writeJson(jsonString, fileName);

    // intentionally using console for deployment feedback
    console.log('Deployment data saved to %s', fileName);
  }

  /**
   * @notice Helper function to convert address to string
   * @param addr The address to convert
   * @return The address as a string
   */
  function _addressToString(address addr) internal pure returns (string memory) {
    return Strings.toHexString(uint160(addr), 20);
  }

  /**
   * @notice Helper function to convert bytes to hex string
   * @param data The bytes to convert
   * @return hexString The resulting hex string
   */
  function _bytesToHexString(bytes memory data) internal pure returns (string memory) {
    bytes memory alphabet = '0123456789abcdef';
    bytes memory str = new bytes(2 + data.length * 2);
    str[0] = '0';
    str[1] = 'x';

    for (uint256 i = 0; i < data.length; i++) {
      str[2 + i * 2] = alphabet[uint8(data[i] >> 4)];
      str[2 + i * 2 + 1] = alphabet[uint8(data[i] & 0x0f)];
    }

    return string(str);
  }

  modifier chainId(uint256 _chainId) {
    if (block.chainid != _chainId) revert ChainIdAndRPCMismatch();
    _;
  }
}
