// SPDX-License-Identifier: Apache-2.0
pragma solidity 0.8.28;

import {IERC20} from '@oz/interfaces/IERC20.sol';
import {SafeERC20} from '@oz/token/ERC20/utils/SafeERC20.sol';
import {BatchRelayer} from 'contracts/BatchRelayer.sol';
import {Constants} from 'contracts/lib/Constants.sol';
import {ProofLib} from 'contracts/lib/ProofLib.sol';
import {Test} from 'forge-std/Test.sol';
import {IBatchRelayer} from 'interfaces/IBatchRelayer.sol';
import {IPrivacyPool} from 'interfaces/IPrivacyPool.sol';
import {IState} from 'interfaces/IState.sol';

contract PrivacyPoolForTest {
  using SafeERC20 for IERC20;
  using ProofLib for ProofLib.WithdrawProof;

  IERC20 public immutable ASSET;

  constructor(IERC20 _asset) {
    ASSET = _asset;
  }

  function withdraw(IPrivacyPool.Withdrawal memory _withdrawal, ProofLib.WithdrawProof memory _proof) external {
    _transfer(ASSET, _withdrawal.processooor, _proof.withdrawnValue());
  }

  function _transfer(IERC20 _asset, address _recipient, uint256 _amount) internal {
    if (_recipient == address(0)) revert('Zero address');

    if (_asset == IERC20(Constants.NATIVE_ASSET)) {
      (bool _success,) = _recipient.call{value: _amount}('');
      if (!_success) revert('Native asset transfer failed');
    } else {
      _asset.safeTransfer(_recipient, _amount);
    }
  }
}

contract BatchRelayerForTest is BatchRelayer {
  constructor(uint256 _maxRelayFeeBPS) BatchRelayer(_maxRelayFeeBPS) {}

  function forTest_transfer(IERC20 _asset, address _recipient, uint256 _amount) external {
    _transfer(_asset, _recipient, _amount);
  }

  function forTest_deductFee(uint256 _amount, uint256 _relayFeeBPS) external view returns (uint256) {
    return _deductFee(_amount, _relayFeeBPS);
  }
}

contract ReceiveRevertForTest {
  // This contract always revert when sending eth
  receive() external payable {
    revert('Revert');
  }
}

contract UnitBatchRelayer is Test {
  uint256 public constant MAX_RELAY_FEE_BPS = 1000; // 10%
  IPrivacyPool public privacyPoolNative;
  BatchRelayerForTest public batchRelayer;
  ReceiveRevertForTest public receiveRevertForTest;

  function setUp() external {
    batchRelayer = new BatchRelayerForTest(MAX_RELAY_FEE_BPS);

    privacyPoolNative = IPrivacyPool(address(new PrivacyPoolForTest(IERC20(Constants.NATIVE_ASSET))));
    batchRelayer = new BatchRelayerForTest(MAX_RELAY_FEE_BPS);
    receiveRevertForTest = new ReceiveRevertForTest();
  }

  receive() external payable {}

  struct HappyPath {
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
    vm.assume(_address != address(privacyPoolNative));
    vm.assume(_address != address(batchRelayer));
    vm.assume(_address != address(receiveRevertForTest));
    vm.assume(_address != address(this));
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
    _assumeFuzzable(_happyPath.recipient);
    _assumeFuzzable(_happyPath.relayer);
    _assumeFuzzable(_happyPath.feeRecipient);
    // Foundry groups expectCalls with same calldata. This is a workaround to avoid this issue.
    vm.assume(_happyPath.recipient != _happyPath.feeRecipient);

    // Reset the total amount
    _happyPath.totalAmount = 0;

    // Save the length and bound the batch size to it
    uint256 _l = _happyPath.withdrawnAmounts.length;
    // TODO: improve this
    vm.assume(_l > 0);
    _happyPath.batchSize = uint8(bound(uint256(_happyPath.batchSize), 1, _l));

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
    BatchRelayer _batchRelayer = new BatchRelayer(_maxRelayFeeBPS);

    // It sets the max relay fee BPS
    assertEq(_batchRelayer.MAX_RELAY_FEE_BPS(), _maxRelayFeeBPS);
  }

  function test_BatchRelayWhenCallingANativeAssetPool(HappyPath memory _happyPath) external happyPath(_happyPath) {
    IPrivacyPool.Withdrawal memory _withdrawal = IPrivacyPool.Withdrawal({
      processooor: address(batchRelayer),
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
    vm.deal(address(privacyPoolNative), _happyPath.totalAmount);

    // It call withdraw() on the pool for each proof
    for (uint256 i = 0; i < _happyPath.batchSize; i++) {
      vm.expectCall(
        address(privacyPoolNative), abi.encodeWithSelector(IPrivacyPool.withdraw.selector, _withdrawal, _proofs[i])
      );
    }

    uint256 _fee = _happyPath.totalAmount * _happyPath.relayFeeBPS / 10_000;
    uint256 _afterFees = _happyPath.totalAmount - _fee;

    // It gets the asset from the pool
    vm.expectCall(address(privacyPoolNative), abi.encodeWithSelector(IState.ASSET.selector));

    // It transfers the assets to the recipient
    vm.expectCall(address(_happyPath.recipient), _afterFees, '');

    // It transfers the fees to the fee recipient
    vm.expectCall(address(_happyPath.feeRecipient), _fee, '');

    // It emits an event
    vm.expectEmit();
    emit IBatchRelayer.BatchRelayed(privacyPoolNative, _happyPath.recipient, _happyPath.feeRecipient, _afterFees, _fee);

    vm.prank(_happyPath.relayer);
    batchRelayer.batchRelay(privacyPoolNative, _withdrawal, _proofs);
  }

  function test_BatchRelayWhenCallingANon_nativeAssetPool(
    IPrivacyPool _pool,
    IERC20 _asset,
    HappyPath memory _happyPath
  ) external happyPath(_happyPath) {
    _assumeFuzzable(address(_pool));
    _assumeFuzzable(address(_asset));
    vm.assume(address(_asset) != Constants.NATIVE_ASSET);

    IPrivacyPool.Withdrawal memory _withdrawal = IPrivacyPool.Withdrawal({
      processooor: address(batchRelayer),
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

    // It call withdraw() on the pool for each proof
    for (uint256 i = 0; i < _happyPath.batchSize; i++) {
      _mockAndExpect(
        address(_pool),
        abi.encodeWithSelector(IPrivacyPool.withdraw.selector, _withdrawal, _proofs[i]),
        abi.encode(true)
      );
    }

    uint256 _fee = _happyPath.totalAmount * _happyPath.relayFeeBPS / 10_000;
    uint256 _afterFees = _happyPath.totalAmount - _fee;

    // It gets the asset from the pool
    _mockAndExpect(address(_pool), abi.encodeWithSelector(IState.ASSET.selector), abi.encode(address(_asset)));

    // It transfers the assets to the recipient
    _mockAndExpect(
      address(_asset),
      abi.encodeWithSelector(IERC20.transfer.selector, _happyPath.recipient, _afterFees),
      abi.encode(true)
    );

    // It transfers the fees to the fee recipient
    _mockAndExpect(
      address(_asset), abi.encodeWithSelector(IERC20.transfer.selector, _happyPath.feeRecipient, _fee), abi.encode(true)
    );

    // It emits an event
    vm.expectEmit();
    emit IBatchRelayer.BatchRelayed(_pool, _happyPath.recipient, _happyPath.feeRecipient, _afterFees, _fee);

    vm.prank(_happyPath.relayer);
    batchRelayer.batchRelay(_pool, _withdrawal, _proofs);
  }

  function test_BatchRelayWhenProofsArrayIsEmpty() external {
    ProofLib.WithdrawProof[] memory _proofs = new ProofLib.WithdrawProof[](0);
    IPrivacyPool.Withdrawal memory _withdrawal = IPrivacyPool.Withdrawal({processooor: address(0), data: ''});

    // It reverts with EmptyProofs
    vm.expectRevert(IBatchRelayer.EmptyProofs.selector);

    batchRelayer.batchRelay(IPrivacyPool(address(0)), _withdrawal, _proofs);
  }

  function test_BatchRelayWhenRelayFeeBPSIsGreaterThanMaxRelayFeeBPS(uint256 _relayFeeBPS) external {
    _relayFeeBPS = bound(_relayFeeBPS, MAX_RELAY_FEE_BPS + 1, type(uint256).max);

    // It reverts with InvalidRelayFeeBPS
    vm.expectRevert(IBatchRelayer.InvalidRelayFeeBPS.selector);

    batchRelayer.batchRelay(
      IPrivacyPool(address(0)),
      IPrivacyPool.Withdrawal({
        processooor: address(0),
        data: abi.encode(
          IBatchRelayer.BatchRelayData({
            recipient: address(0),
            feeRecipient: address(0),
            relayFeeBPS: _relayFeeBPS,
            batchSize: 1
          })
        )
      }),
      new ProofLib.WithdrawProof[](1)
    );
  }

  function test_BatchRelayWhenContractBalanceHasChangedAfterTheBatchRelay(
    address _relayer,
    address _feeRecipient,
    uint256 _amount
  ) external {
    _assumeFuzzable(_relayer);
    _assumeFuzzable(_feeRecipient);

    _amount = bound(_amount, 1, type(uint256).max);
    IPrivacyPool.Withdrawal memory _withdrawal = IPrivacyPool.Withdrawal({
      processooor: address(batchRelayer),
      data: abi.encode(
        IBatchRelayer.BatchRelayData({
          recipient: address(batchRelayer), // Recipient is the batch relayer to force the balance change
          feeRecipient: _feeRecipient,
          relayFeeBPS: 0,
          batchSize: 1
        })
      )
    });
    ProofLib.WithdrawProof[] memory _proofs = new ProofLib.WithdrawProof[](1);
    _proofs[0] = _createFakeProof(_amount);

    vm.deal(address(privacyPoolNative), _amount);

    // It should return successfully
    vm.prank(_relayer);
    batchRelayer.batchRelay(privacyPoolNative, _withdrawal, _proofs);
    assertEq(address(batchRelayer).balance, _amount);
  }

  function test_BatchRelayWhenBatchSizeIsDifferentThanTheNumberOfProofs(uint8 _proofsSize, uint8 _batchSize) external {
    _proofsSize = uint8(bound(_proofsSize, 1, type(uint8).max));
    vm.assume(_proofsSize != _batchSize);

    // It reverts with InvalidBatchSize
    vm.expectRevert(IBatchRelayer.InvalidBatchSize.selector);

    batchRelayer.batchRelay(
      IPrivacyPool(address(0)),
      IPrivacyPool.Withdrawal({
        processooor: address(0),
        data: abi.encode(
          IBatchRelayer.BatchRelayData({
            recipient: address(0),
            feeRecipient: address(0),
            relayFeeBPS: 0,
            batchSize: _batchSize
          })
        )
      }),
      new ProofLib.WithdrawProof[](_proofsSize)
    );
  }

  function test__transferWhenRecipientIsZero(IERC20 _asset, uint256 _amount) external {
    _assumeFuzzable(address(_asset));

    // It reverts with ZeroAddress
    vm.expectRevert(IBatchRelayer.ZeroAddress.selector);
    batchRelayer.forTest_transfer(_asset, address(0), _amount);
  }

  modifier whenAssetIsNative() {
    _;
  }

  function test__transferWhenTransferFails(uint256 _amount) external whenAssetIsNative {
    vm.deal(address(batchRelayer), _amount);

    // It reverts with NativeAssetTransferFailed
    vm.expectRevert(IBatchRelayer.NativeAssetTransferFailed.selector);
    batchRelayer.forTest_transfer(IERC20(Constants.NATIVE_ASSET), address(receiveRevertForTest), _amount);
  }

  function test__transferWhenTransferSucceeds(address _recipient, uint256 _amount) external whenAssetIsNative {
    _assumeFuzzable(_recipient);
    vm.assume(_recipient != address(0));
    vm.assume(_recipient != address(receiveRevertForTest));
    vm.deal(address(batchRelayer), _amount);

    // It transfers the amount to the recipient
    vm.expectCall(_recipient, _amount, '');

    batchRelayer.forTest_transfer(IERC20(Constants.NATIVE_ASSET), _recipient, _amount);
  }

  function test__transferWhenAssetIsNotNative(IERC20 _asset, address _recipient, uint256 _amount) external {
    vm.assume(address(_asset) != Constants.NATIVE_ASSET);
    _assumeFuzzable(address(_asset));
    _assumeFuzzable(_recipient);

    // It calls .transfer() on the asset
    _mockAndExpect(
      address(_asset), abi.encodeWithSelector(IERC20.transfer.selector, _recipient, _amount), abi.encode(true)
    );

    batchRelayer.forTest_transfer(_asset, _recipient, _amount);
  }

  function test__deductFeeWhenCalled(uint256 _amount, uint256 _feeBPS) external {
    _feeBPS = bound(_feeBPS, 0, 10_000);
    _amount = bound(_amount, 0, _feeBPS == 0 ? type(uint256).max : type(uint256).max / _feeBPS);

    // It returns the correct amount
    assertEq(batchRelayer.forTest_deductFee(_amount, _feeBPS), _amount - ((_amount * _feeBPS) / 10_000));

    assertEq(batchRelayer.forTest_deductFee(_amount, 0), _amount);
    assertEq(batchRelayer.forTest_deductFee(0, _feeBPS), 0);
    assertEq(batchRelayer.forTest_deductFee(type(uint256).max / 10_000, 10_000), 0);
  }
}
