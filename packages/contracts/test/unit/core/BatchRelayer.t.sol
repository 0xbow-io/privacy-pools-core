// SPDX-License-Identifier: Apache-2.0
pragma solidity 0.8.28;

import {BatchRelayer} from 'contracts/BatchRelayer.sol';
import {Constants} from 'contracts/lib/Constants.sol';
import {ProofLib} from 'contracts/lib/ProofLib.sol';
import {Test} from 'forge-std/Test.sol';
import {IBatchRelayer} from 'interfaces/IBatchRelayer.sol';
import {IPrivacyPool} from 'interfaces/IPrivacyPool.sol';
import {IState} from 'interfaces/IState.sol';

contract UnitBatchRelayer is Test {
  BatchRelayer public batchRelayer;
  uint256 public constant MAX_RELAY_FEE_BPS = 1000; // 10%

  function setUp() external {
    batchRelayer = new BatchRelayer(MAX_RELAY_FEE_BPS);
  }

  receive() external payable {}

  struct HappyPath {
    IPrivacyPool pool;
    address processooor;
    address recipient;
    address relayer;
    address feeRecipient;
    uint256 relayFeeBPS;
    uint8 batchSize;
    uint256[] withdrawnAmounts;
    uint256 totalAmount;
  }

  function _assumeFuzzable(address _address) internal view {
    assumeNotForgeAddress(_address);
    assumeNotZeroAddress(_address);
    assumeNotPrecompile(_address);
    vm.assume(_address != address(batchRelayer));
  }

  function _mockAndExpect(address _contract, bytes memory _call, bytes memory _return) internal {
    vm.mockCall(_contract, _call, _return);
    vm.expectCall(_contract, _call);
  }

  function _createFakeProof(uint256 _amount) internal view returns (ProofLib.WithdrawProof memory _proof) {
    uint256[2] memory _pA = [uint256(0), uint256(0)];
    uint256[2][2] memory _pB = [[uint256(0), uint256(0)], [uint256(0), uint256(0)]];
    uint256[2] memory _pC = [uint256(0), uint256(0)];
    uint256[8] memory _pubSignals =
      [uint256(0), uint256(0), _amount, uint256(0), uint256(0), uint256(0), uint256(0), uint256(0)];

    _proof = ProofLib.WithdrawProof({pA: _pA, pB: _pB, pC: _pC, pubSignals: _pubSignals});

    return _proof;
  }

  modifier happyPath(HappyPath memory _happyPath) {
    _assumeFuzzable(address(_happyPath.pool));
    _assumeFuzzable(_happyPath.processooor);
    _assumeFuzzable(_happyPath.recipient);
    _assumeFuzzable(_happyPath.relayer);
    _assumeFuzzable(_happyPath.feeRecipient);

    // Reset the total amount
    _happyPath.totalAmount = 0;

    // Save the length and bound the batch size to it
    uint256 _l = _happyPath.withdrawnAmounts.length;
    _happyPath.batchSize = uint8(bound(uint256(_happyPath.batchSize), 0, _l));

    // Cap the relay fee BPS
    _happyPath.relayFeeBPS = uint256(bound(uint256(_happyPath.relayFeeBPS), 0, MAX_RELAY_FEE_BPS));

    // Cap the total amount to avoid overflows when deducting fees
    uint256 _totalAmountMax =
      _happyPath.relayFeeBPS == 0 ? type(uint256).max / 2 : type(uint256).max / _happyPath.relayFeeBPS;
    uint256 _withdrawnAmountMax =
      _happyPath.batchSize == 0 ? _totalAmountMax / 2 : _totalAmountMax / _happyPath.batchSize;

    // Loop through the batch and sum the withdrawn amounts
    // Create a new array with the new length == batchSize
    uint256[] memory _withdrawnAmounts = new uint256[](_happyPath.batchSize);
    for (uint256 i = 0; i < _happyPath.batchSize; i++) {
      _withdrawnAmounts[i] = uint256(bound(_happyPath.withdrawnAmounts[i], 0, _withdrawnAmountMax));
      _happyPath.totalAmount += _withdrawnAmounts[i];
    }
    _happyPath.withdrawnAmounts = _withdrawnAmounts;

    _;
  }

  function test_ConstructorWhenCalled(uint256 _maxRelayFeeBPS) external {
    batchRelayer = new BatchRelayer(_maxRelayFeeBPS);

    // It sets the max relay fee BPS
    assertEq(batchRelayer.MAX_RELAY_FEE_BPS(), _maxRelayFeeBPS);
  }

  function test_BatchRelayWhenCallingAnNativeAssetPool(HappyPath memory _happyPath) external happyPath(_happyPath) {
    IPrivacyPool.Withdrawal memory _withdrawal = IPrivacyPool.Withdrawal({
      processooor: _happyPath.processooor,
      data: abi.encode(
        IBatchRelayer.BatchRelayData({
          recipient: _happyPath.recipient,
          feeRecipient: _happyPath.feeRecipient,
          relayFeeBPS: _happyPath.relayFeeBPS,
          batchSize: _happyPath.batchSize
        })
      )
    });
    ProofLib.WithdrawProof[] memory _proofs = new ProofLib.WithdrawProof[](_happyPath.batchSize);
    for (uint256 i = 0; i < _happyPath.batchSize; i++) {
      _proofs[i] = _createFakeProof(_happyPath.withdrawnAmounts[i]);
    }
    vm.deal(address(batchRelayer), _happyPath.totalAmount);

    // It gets the asset from the pool
    _mockAndExpect(
      address(_happyPath.pool), abi.encodeWithSelector(IState.ASSET.selector), abi.encode(Constants.NATIVE_ASSET)
    );

    // It call withdraw() on the pool for each proof
    for (uint256 i = 0; i < _happyPath.batchSize; i++) {
      _mockAndExpect(
        address(_happyPath.pool),
        abi.encodeWithSelector(IPrivacyPool.withdraw.selector, _withdrawal, _proofs[i]),
        abi.encode(true)
      );
    }

    uint256 _fee = _happyPath.totalAmount * _happyPath.relayFeeBPS / 10_000;
    uint256 _afterFees = _happyPath.totalAmount - _fee;

    // It emits an event
    vm.expectEmit();
    emit IBatchRelayer.BatchRelayed(_happyPath.pool, _happyPath.recipient, _afterFees, _fee);

    // It transfers the assets to the recipient
    vm.expectCall(address(_happyPath.recipient), _afterFees, '');

    // It transfers the fees to the fee recipient
    vm.expectCall(address(_happyPath.feeRecipient), _fee, '');

    vm.prank(_happyPath.relayer);
    batchRelayer.batchRelay(_happyPath.pool, _withdrawal, _proofs);
  }
}
