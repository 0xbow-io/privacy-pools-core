// SPDX-License-Identifier: Apache-2.0
pragma solidity 0.8.28;

/*

Made with ♥ for 0xBow by

░██╗░░░░░░░██╗░█████╗░███╗░░██╗██████╗░███████╗██████╗░██╗░░░░░░█████╗░███╗░░██╗██████╗░
░██║░░██╗░░██║██╔══██╗████╗░██║██╔══██╗██╔════╝██╔══██╗██║░░░░░██╔══██╗████╗░██║██╔══██╗
░╚██╗████╗██╔╝██║░░██║██╔██╗██║██║░░██║█████╗░░██████╔╝██║░░░░░███████║██╔██╗██║██║░░██║
░░████╔═████║░██║░░██║██║╚████║██║░░██║██╔══╝░░██╔══██╗██║░░░░░██╔══██║██║╚████║██║░░██║
░░╚██╔╝░╚██╔╝░╚█████╔╝██║░╚███║██████╔╝███████╗██║░░██║███████╗██║░░██║██║░╚███║██████╔╝
░░░╚═╝░░░╚═╝░░░╚════╝░╚═╝░░╚══╝╚═════╝░╚══════╝╚═╝░░╚═╝╚══════╝╚═╝░░╚═╝╚═╝░░╚══╝╚═════╝░

https://defi.sucks/

*/

interface IERC20Votes {
  function delegate(address delegatee) external;
}

import {IERC20, SafeERC20} from '@oz/token/ERC20/utils/SafeERC20.sol';

import {Constants} from 'contracts/lib/Constants.sol';

import {IPrivacyPoolComplex} from 'interfaces/IPrivacyPool.sol';

import {PrivacyPool} from 'contracts/PrivacyPool.sol';

/**
 * @title PrivacyPoolComplex
 * @notice ERC20 implementation of Privacy Pool.
 */
contract PrivacyPoolComplex is PrivacyPool, IPrivacyPoolComplex {
  using SafeERC20 for IERC20;

  address public delegateAddress;

  // @notice Initializes the state addresses
  constructor(
    address _entrypoint,
    address _withdrawalVerifier,
    address _ragequitVerifier,
    address _asset,
    address _delegateAddress
  ) PrivacyPool(_entrypoint, _withdrawalVerifier, _ragequitVerifier, _asset) {
    if (_asset == Constants.NATIVE_ASSET) revert NativeAssetNotSupported();

    delegateAddress = _delegateAddress;
  }

  /**
   * @notice Handle pulling an ERC20 asset
   * @param _sender The address of the user transferring the asset from
   * @param _amount The amount of asset being pulled
   * @inheritdoc PrivacyPool
   */
  function _pull(address _sender, uint256 _amount) internal override(PrivacyPool) {
    // This contract does not accept native asset
    if (msg.value != 0) revert NativeAssetNotAccepted();

    // Pull asset from sender to this contract
    IERC20(ASSET).safeTransferFrom(_sender, address(this), _amount);
  }

  /**
   * @notice Handle sending an ERC20 asset
   * @param _recipient The address of the user receiving the asset
   * @param _amount The amount of asset being sent
   * @inheritdoc PrivacyPool
   */
  function _push(address _recipient, uint256 _amount) internal override(PrivacyPool) {
    // Send asset from this contract to recipient
    IERC20(ASSET).safeTransfer(_recipient, _amount);
  }

  //Predefined delegate of this pool recieves all the vote delegation.
  function delegate() external {
    IERC20Votes(ASSET).delegate(delegateAddress);
  }
}
