// SPDX-License-Identifier: Apache-2.0
pragma solidity 0.8.28;

import {IERC20} from '@oz/token/ERC20/ERC20.sol';
import {ERC20} from '@oz/token/ERC20/ERC20.sol';
import {Script} from 'forge-std/Script.sol';
import {console} from 'forge-std/console.sol';

import {Constants} from 'contracts/lib/Constants.sol';
import {DeployLib} from 'contracts/lib/DeployLib.sol';

import {IPrivacyPool} from 'interfaces/IPrivacyPool.sol';
import {ICreateX} from 'interfaces/external/ICreateX.sol';

import {Entrypoint} from 'contracts/Entrypoint.sol';
import {PrivacyPoolComplex} from 'contracts/implementations/PrivacyPoolComplex.sol';

/*///////////////////////////////////////////////////////////////
                   COMPLEX POOL DEPLOYMENT
//////////////////////////////////////////////////////////////*/

/**
 * @notice Script to deploy a Privacy Pool Complex.
 */
contract DeployComplexPool is Script {
  error InvalidERC20Address();
  error InvalidSymbol();
  error ConfirmationMismatch();

  // @notice Deployed Entrypoint from environment
  Entrypoint public entrypoint;
  // @notice Deployed Groth16 Withdrawal Verifier from environment
  address public withdrawalVerifier;
  // @notice Deployed Groth16 Ragequit Verifier from environment
  address public ragequitVerifier;

  // @notice Deployer address
  address public deployer;

  // @notice CreateX Singleton
  ICreateX public constant CreateX = ICreateX(0xba5Ed099633D3B313e4D5F7bdc1305d3c28ba5Ed);

  // @notice User-provided ERC20 details
  address public erc20Address;
  string public erc20Symbol;

  function setUp() public virtual {
    // Read addresses from environment
    entrypoint = Entrypoint(payable(vm.envAddress('ENTRYPOINT_ADDRESS')));
    withdrawalVerifier = vm.envAddress('WITHDRAWAL_VERIFIER_ADDRESS');
    ragequitVerifier = vm.envAddress('RAGEQUIT_VERIFIER_ADDRESS');
    deployer = vm.envAddress('DEPLOYER_ADDRESS');

    // Prompt user for ERC20 details
    _promptForERC20Details();

    // Display configuration and ask for confirmation
    _displayConfigurationAndConfirm();
  }

  function _promptForERC20Details() private {
    // Prompt for ERC20 address
    string memory _addressInput = vm.prompt('Enter ERC20 token address:');
    erc20Address = vm.parseAddress(_addressInput);

    if (erc20Address == address(0)) {
      revert InvalidERC20Address();
    }

    // Prompt for ERC20 symbol
    string memory _symbolInput = vm.prompt('Enter ERC20 token symbol:');

    if (bytes(_symbolInput).length == 0) {
      revert InvalidSymbol();
    }

    erc20Symbol = _symbolInput;
  }

  function _displayConfigurationAndConfirm() private {
    string memory _confirmation = vm.prompt(
      string.concat(
        'Deploy ERC20 Privacy Pool for ', erc20Symbol, ' on chain ', vm.toString(block.chainid), '? (yes/no):'
      )
    );

    if (keccak256(bytes(_confirmation)) != keccak256(bytes('yes'))) {
      revert ConfirmationMismatch();
    }
  }

  function run() public virtual {
    vm.startBroadcast(deployer);

    // Deploy the Privacy Pool Complex
    address pool = _deployComplexPool();

    console.log('Pool:', pool);
    console.log('Symbol:', erc20Symbol);
    console.log('Chain:', block.chainid);

    vm.stopBroadcast();
  }

  function _deployComplexPool() private returns (address) {
    // Encode constructor args
    bytes memory _constructorArgs = abi.encode(address(entrypoint), withdrawalVerifier, ragequitVerifier, erc20Address);

    // Generate salt for this specific token
    bytes11 _tokenSalt = bytes11(keccak256(abi.encodePacked(DeployLib.COMPLEX_POOL_SALT, erc20Symbol)));

    // Deploy pool with Create2
    address _pool = CreateX.deployCreate2(
      DeployLib.salt(deployer, _tokenSalt), abi.encodePacked(type(PrivacyPoolComplex).creationCode, _constructorArgs)
    );

    return _pool;
  }
}
