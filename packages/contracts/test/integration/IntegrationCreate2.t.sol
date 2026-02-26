// SPDX-License-Identifier: Apache-2.0
pragma solidity 0.8.28;

import {ERC1967Proxy} from '@oz/proxy/ERC1967/ERC1967Proxy.sol';
import {DeployLib} from 'contracts/lib/DeployLib.sol';
import {Test} from 'forge-std/Test.sol';
import {ICreateX} from 'interfaces/external/ICreateX.sol';

import {Entrypoint} from 'contracts/Entrypoint.sol';
import {PrivacyPoolComplex} from 'contracts/implementations/PrivacyPoolComplex.sol';
import {PrivacyPoolSimple} from 'contracts/implementations/PrivacyPoolSimple.sol';
import {CommitmentVerifier} from 'contracts/verifiers/CommitmentVerifier.sol';
import {WithdrawalVerifier} from 'contracts/verifiers/WithdrawalVerifier.sol';

/**
 * @title IntegrationDeploy
 * @notice Integration test for verifying deterministic CREATE2 deployments across multiple chains
 * @dev This test ensures that Privacy Pool contracts are deployed to the same addresses
 * across different EVM-compatible chains (mainnet, sepolia, gnosis) using CREATE2
 */
contract IntegrationDeploy is Test {
  /**
   * @notice Structure to hold deployed contract addresses for a specific chain
   * @param commitmentVerifier Address of the CommitmentVerifier contract
   * @param withdrawalVerifier Address of the WithdrawalVerifier contract
   * @param entrypoint Address of the Entrypoint contract
   * @param nativePool Address of the PrivacyPoolSimple contract (for native assets)
   * @param tokenPool Address of the PrivacyPoolComplex contract (for ERC20 tokens)
   */
  struct Contracts {
    address commitmentVerifier;
    address withdrawalVerifier;
    address entrypoint;
    address nativePool;
    address tokenPool;
  }

  /**
   * @notice Structure to hold chain-specific configuration
   * @param id Chain ID
   * @param name Chain name (used for forking)
   * @param native Native token symbol
   * @param token Address of the ERC20 token to use for testing
   * @param tokenSymbol Symbol of the ERC20 token
   */
  struct ChainConfig {
    uint256 id;
    string name;
    string native;
    address token;
    string tokenSymbol;
  }

  /*///////////////////////////////////////////////////////////////
                      STATE VARIABLES 
  //////////////////////////////////////////////////////////////*/

  /**
   * @notice Array of chain configurations to test
   */
  ChainConfig[] internal _chains;

  /**
   * @notice Mapping from chain ID to deployed contract addresses
   */
  mapping(uint256 _chainId => Contracts _contracts) internal _contracts;

  /**
   * @notice Address used for deployment operations
   */
  address internal immutable _DEPLOYER = makeAddr('DEPLOYER');

  /**
   * @notice Mock token address used for testing
   */
  address internal _TOKEN = makeAddr('singleton_token');

  /**
   * @notice CreateX Singleton
   */
  ICreateX internal constant _CREATEX = ICreateX(0xba5Ed099633D3B313e4D5F7bdc1305d3c28ba5Ed);

  /**
   * @notice Set up test environment with chain configurations
   * @dev Initializes configurations for mainnet, sepolia, and gnosis chains
   */
  function setUp() public {
    _chains.push(ChainConfig(1, 'mainnet', 'ETH', _TOKEN, 'SYMBOL'));
    _chains.push(ChainConfig(11_155_111, 'sepolia', 'ETH', _TOKEN, 'SYMBOL'));
    _chains.push(ChainConfig(100, 'gnosis', 'xDAI', _TOKEN, 'SYMBOL'));
  }

  /**
   * @notice Test deterministic CREATE2 deployments across multiple chains
   * @dev For each chain:
   *      1. Creates a fork of the chain
   *      2. Deploys all Privacy Pool contracts using DeployLib
   *      3. Stores the deployed addresses
   *      Then verifies that all contracts are deployed to the same addresses across chains
   */
  function test_create2() public virtual {
    for (uint256 _i; _i < _chains.length; ++_i) {
      ChainConfig memory _chain = _chains[_i];

      // Fork the chain
      vm.createSelectFork(vm.rpcUrl(_chain.name));
      vm.startPrank(_DEPLOYER);

      // Deploy all contracts for this chain
      _deployContractsForChain(_chain);

      vm.stopPrank();
    }

    // Verify that contract addresses are the same across all chains
    _verifyAddressesMatch();
  }

  /**
   * @notice Deploy all contracts for a specific chain
   * @param _chain Chain configuration
   */
  function _deployContractsForChain(ChainConfig memory _chain) private {
    // Deploy verifiers
    address _commitmentVerifier = _deployCommitmentVerifier();
    address _withdrawalVerifier = _deployWithdrawalVerifier();

    // Store verifier addresses
    _contracts[_chain.id].commitmentVerifier = _commitmentVerifier;
    _contracts[_chain.id].withdrawalVerifier = _withdrawalVerifier;

    // Deploy Entrypoint
    address _entrypoint = _deployEntrypoint();
    _contracts[_chain.id].entrypoint = _entrypoint;

    // Deploy pools
    _contracts[_chain.id].nativePool = _deployNativePool(_entrypoint, _withdrawalVerifier, _commitmentVerifier);
    _contracts[_chain.id].tokenPool =
      _deployTokenPool(_entrypoint, _withdrawalVerifier, _commitmentVerifier, _chain.token);
  }

  /**
   * @notice Deploy CommitmentVerifier contract
   * @return Address of the deployed CommitmentVerifier
   */
  function _deployCommitmentVerifier() private returns (address) {
    return _CREATEX.deployCreate2(
      DeployLib.salt(_DEPLOYER, DeployLib.RAGEQUIT_VERIFIER_SALT),
      abi.encodePacked(type(CommitmentVerifier).creationCode)
    );
  }

  /**
   * @notice Deploy WithdrawalVerifier contract
   * @return Address of the deployed WithdrawalVerifier
   */
  function _deployWithdrawalVerifier() private returns (address) {
    return _CREATEX.deployCreate2(
      DeployLib.salt(_DEPLOYER, DeployLib.WITHDRAWAL_VERIFIER_SALT),
      abi.encodePacked(type(WithdrawalVerifier).creationCode)
    );
  }

  /**
   * @notice Deploy Entrypoint contract
   * @return Address of the deployed Entrypoint
   */
  function _deployEntrypoint() private returns (address) {
    address _owner = makeAddr('OWNER');
    address _postman = makeAddr('POSTMAN');
    bytes memory _intializationData = abi.encodeCall(Entrypoint.initialize, (_owner, _postman));

    address _impl =
      _CREATEX.deployCreate2(DeployLib.salt(_DEPLOYER, DeployLib.ENTRYPOINT_IMPL_SALT), type(Entrypoint).creationCode);

    return _CREATEX.deployCreate2(
      DeployLib.salt(_DEPLOYER, DeployLib.ENTRYPOINT_PROXY_SALT),
      abi.encodePacked(type(ERC1967Proxy).creationCode, abi.encode(_impl, _intializationData))
    );
  }

  /**
   * @notice Deploy PrivacyPoolSimple contract for native assets
   * @param _entrypoint Address of the Entrypoint contract
   * @param _withdrawalVerifier Address of the WithdrawalVerifier contract
   * @param _commitmentVerifier Address of the CommitmentVerifier contract
   * @return Address of the deployed PrivacyPoolSimple
   */
  function _deployNativePool(
    address _entrypoint,
    address _withdrawalVerifier,
    address _commitmentVerifier
  ) private returns (address) {
    return _CREATEX.deployCreate2(
      DeployLib.salt(_DEPLOYER, DeployLib.SIMPLE_POOL_SALT),
      abi.encodePacked(
        type(PrivacyPoolSimple).creationCode, abi.encode(_entrypoint, _withdrawalVerifier, _commitmentVerifier)
      )
    );
  }

  /**
   * @notice Deploy PrivacyPoolComplex contract for ERC20 tokens
   * @param _entrypoint Address of the Entrypoint contract
   * @param _withdrawalVerifier Address of the WithdrawalVerifier contract
   * @param _commitmentVerifier Address of the CommitmentVerifier contract
   * @param _token Address of the ERC20 token
   * @return Address of the deployed PrivacyPoolComplex
   */
  function _deployTokenPool(
    address _entrypoint,
    address _withdrawalVerifier,
    address _commitmentVerifier,
    address _token
  ) private returns (address) {
    return _CREATEX.deployCreate2(
      DeployLib.salt(_DEPLOYER, DeployLib.COMPLEX_POOL_SALT),
      abi.encodePacked(
        type(PrivacyPoolComplex).creationCode, abi.encode(_entrypoint, _withdrawalVerifier, _commitmentVerifier, _token)
      )
    );
  }

  /**
   * @notice Verify that contract addresses match across all chains
   */
  function _verifyAddressesMatch() private view {
    assertTrue(
      _contracts[1].commitmentVerifier == _contracts[11_155_111].commitmentVerifier
        && _contracts[11_155_111].commitmentVerifier == _contracts[100].commitmentVerifier,
      "Commitment verifier addresses don't match"
    );

    assertTrue(
      _contracts[1].withdrawalVerifier == _contracts[11_155_111].withdrawalVerifier
        && _contracts[11_155_111].withdrawalVerifier == _contracts[100].withdrawalVerifier,
      "Withdrawal verifier addresses don't match"
    );

    assertTrue(
      _contracts[1].entrypoint == _contracts[11_155_111].entrypoint
        && _contracts[11_155_111].entrypoint == _contracts[100].entrypoint,
      "Entrypoint addresses don't match"
    );

    assertTrue(
      _contracts[1].nativePool == _contracts[11_155_111].nativePool
        && _contracts[11_155_111].nativePool == _contracts[100].nativePool,
      "Native pool addresses don't match"
    );

    assertTrue(
      _contracts[1].tokenPool == _contracts[11_155_111].tokenPool
        && _contracts[11_155_111].tokenPool == _contracts[100].tokenPool,
      "Complex pool addresses don't match"
    );
  }
}
