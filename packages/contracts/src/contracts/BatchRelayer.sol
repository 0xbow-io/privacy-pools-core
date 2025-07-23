// SPDX-License-Identifier: Apache-2.0
pragma solidity 0.8.28;

import {IERC20} from '@oz/interfaces/IERC20.sol';
import {SafeERC20} from '@oz/token/ERC20/utils/SafeERC20.sol';
import {Constants} from 'contracts/lib/Constants.sol';
import {ProofLib} from 'contracts/lib/ProofLib.sol';
import {IBatchRelayer} from 'interfaces/IBatchRelayer.sol';
import {IPrivacyPool} from 'interfaces/IPrivacyPool.sol';

contract BatchRelayer is IBatchRelayer {
  using SafeERC20 for IERC20;
  using ProofLib for ProofLib.WithdrawProof;

  /// @inheritdoc IBatchRelayer
  uint256 public immutable MAX_RELAY_FEE_BPS;

  constructor(uint256 _maxRelayFeeBPS) {
    MAX_RELAY_FEE_BPS = _maxRelayFeeBPS;
  }

  receive() external payable {}

  /// @inheritdoc IBatchRelayer
  function batchRelay(
    IPrivacyPool _pool,
    IPrivacyPool.Withdrawal memory _withdrawal,
    ProofLib.WithdrawProof[] memory _proofs
  ) external {
    BatchRelayData memory _data = abi.decode(_withdrawal.data, (BatchRelayData));

    IERC20 _asset = IERC20(_pool.ASSET());

    // Loop and withdraw each proof
    uint256 _withdrawnAmount;
    for (uint256 i = 0; i < _proofs.length; i++) {
      _pool.withdraw(_withdrawal, _proofs[i]);
      _withdrawnAmount += _proofs[i].withdrawnValue();
    }

    // Deduct fees
    uint256 _amountAfterFees = _deductFee(_withdrawnAmount, _data.relayFeeBPS);
    uint256 _feeAmount = _withdrawnAmount - _amountAfterFees;

    // Transfer withdrawn funds to recipient
    _transfer(_asset, _data.recipient, _amountAfterFees);
    // Transfer fees to fee recipient
    _transfer(_asset, _data.feeRecipient, _feeAmount);

    emit BatchRelayed(_pool, _data.recipient, _amountAfterFees, _feeAmount);
  }

  /**
   * @notice Transfer out an asset to a recipient
   * @param _asset The asset to send
   * @param _recipient The recipient address
   * @param _amount The amount to send
   */
  function _transfer(IERC20 _asset, address _recipient, uint256 _amount) internal {
    if (_recipient == address(0)) revert ZeroAddress();

    if (_asset == IERC20(Constants.NATIVE_ASSET)) {
      (bool _success,) = _recipient.call{value: _amount}('');
      if (!_success) revert NativeAssetTransferFailed();
    } else {
      _asset.safeTransfer(_recipient, _amount);
    }
  }

  /**
   * @notice Deduct fees from an amount
   * @param _amount The amount before fees
   * @param _feeBPS The fee in basis points
   * @return _afterFees The amount after fees are deducted
   */
  function _deductFee(uint256 _amount, uint256 _feeBPS) internal pure returns (uint256 _afterFees) {
    _afterFees = _amount - ((_amount * _feeBPS) / 10_000);
  }
}
