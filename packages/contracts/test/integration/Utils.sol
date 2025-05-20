// SPDX-License-Identifier: Apache-2.0
pragma solidity 0.8.28;

import {ProofLib} from 'contracts/lib/ProofLib.sol';
import {Constants} from 'test/helper/Constants.sol';

import {IERC20} from '@oz/interfaces/IERC20.sol';
import {Test} from 'forge-std/Test.sol';
import {InternalLeanIMT, LeanIMTData} from 'lean-imt/InternalLeanIMT.sol';

import {PoseidonT2} from 'poseidon/PoseidonT2.sol';
import {PoseidonT3} from 'poseidon/PoseidonT3.sol';
import {PoseidonT4} from 'poseidon/PoseidonT4.sol';

contract IntegrationUtils is Test {
  using InternalLeanIMT for LeanIMTData;

  /*///////////////////////////////////////////////////////////////
                             STRUCTS 
  //////////////////////////////////////////////////////////////*/

  struct Commitment {
    uint256 hash;
    uint256 label;
    uint256 value;
    uint256 precommitment;
    uint256 nullifier;
    uint256 secret;
    IERC20 asset;
  }

  struct DepositParams {
    address depositor;
    IERC20 asset;
    uint256 amount;
    string nullifier;
    string secret;
  }

  struct WithdrawalParams {
    uint256 withdrawnAmount;
    string newNullifier;
    string newSecret;
    address recipient;
    Commitment commitment;
    bytes4 revertReason;
  }

  struct WithdrawalProofParams {
    uint256 existingCommitment;
    uint256 withdrawnValue;
    uint256 context;
    uint256 label;
    uint256 existingValue;
    uint256 existingNullifier;
    uint256 existingSecret;
    uint256 newNullifier;
    uint256 newSecret;
  }

  /*///////////////////////////////////////////////////////////////
                            ERRORS
  //////////////////////////////////////////////////////////////*/

  error WithdrawalProofGenerationFailed();
  error RagequitProofGenerationFailed();
  error MerkleProofGenerationFailed();

  /*///////////////////////////////////////////////////////////////
                        MERKLE TREES
  //////////////////////////////////////////////////////////////*/

  LeanIMTData internal _shadowMerkleTree;
  uint256[] internal _merkleLeaves;
  LeanIMTData internal _shadowASPMerkleTree;
  uint256[] internal _aspLeaves;

  /*///////////////////////////////////////////////////////////////
                       PROOF GENERATION 
  //////////////////////////////////////////////////////////////*/

  function _generateRagequitProof(
    uint256 _value,
    uint256 _label,
    uint256 _nullifier,
    uint256 _secret
  ) internal returns (ProofLib.RagequitProof memory _proof) {
    // Generate real proof using the helper script
    string[] memory _inputs = new string[](5);
    _inputs[0] = vm.toString(_value);
    _inputs[1] = vm.toString(_label);
    _inputs[2] = vm.toString(_nullifier);
    _inputs[3] = vm.toString(_secret);

    // Call the ProofGenerator script using ts-node
    string[] memory _scriptArgs = new string[](2);
    _scriptArgs[0] = 'node';
    _scriptArgs[1] = 'test/helper/RagequitProofGenerator.mjs';
    bytes memory _proofData = vm.ffi(_concat(_scriptArgs, _inputs));

    if (_proofData.length == 0) {
      revert RagequitProofGenerationFailed();
    }

    // Decode the ABI-encoded proof directly
    _proof = abi.decode(_proofData, (ProofLib.RagequitProof));
  }

  function _generateWithdrawalProof(WithdrawalProofParams memory _params)
    internal
    returns (ProofLib.WithdrawProof memory _proof)
  {
    // Generate state merkle proof
    bytes memory _stateMerkleProof = _generateMerkleProof(_merkleLeaves, _params.existingCommitment);
    // Generate ASP merkle proof
    bytes memory _aspMerkleProof = _generateMerkleProof(_aspLeaves, _params.label);

    if (_aspMerkleProof.length == 0 || _stateMerkleProof.length == 0) {
      revert MerkleProofGenerationFailed();
    }

    string[] memory _inputs = new string[](12);
    _inputs[0] = vm.toString(_params.existingValue);
    _inputs[1] = vm.toString(_params.label);
    _inputs[2] = vm.toString(_params.existingNullifier);
    _inputs[3] = vm.toString(_params.existingSecret);
    _inputs[4] = vm.toString(_params.newNullifier);
    _inputs[5] = vm.toString(_params.newSecret);
    _inputs[6] = vm.toString(_params.withdrawnValue);
    _inputs[7] = vm.toString(_params.context);
    _inputs[8] = vm.toString(_stateMerkleProof);
    _inputs[9] = vm.toString(_shadowMerkleTree.depth);
    _inputs[10] = vm.toString(_aspMerkleProof);
    _inputs[11] = vm.toString(_shadowASPMerkleTree.depth);

    // Call the ProofGenerator script using node
    string[] memory _scriptArgs = new string[](2);
    _scriptArgs[0] = 'node';
    _scriptArgs[1] = 'test/helper/WithdrawalProofGenerator.mjs';
    bytes memory _proofData = vm.ffi(_concat(_scriptArgs, _inputs));

    if (_proofData.length == 0) {
      revert WithdrawalProofGenerationFailed();
    }

    _proof = abi.decode(_proofData, (ProofLib.WithdrawProof));
  }

  function _generateMerkleProof(uint256[] storage _leaves, uint256 _leaf) internal returns (bytes memory _proof) {
    uint256 _leavesAmt = _leaves.length;
    string[] memory inputs = new string[](_leavesAmt + 1);
    inputs[0] = vm.toString(_leaf);

    for (uint256 i = 0; i < _leavesAmt; i++) {
      inputs[i + 1] = vm.toString(_leaves[i]);
    }

    // Call the ProofGenerator script using node
    string[] memory scriptArgs = new string[](2);
    scriptArgs[0] = 'node';
    scriptArgs[1] = 'test/helper/MerkleProofGenerator.mjs';
    _proof = vm.ffi(_concat(scriptArgs, inputs));
  }

  function _generateMerkleProofMemory(uint256[] memory _leaves, uint256 _leaf) internal returns (bytes memory _proof) {
    uint256 _leavesAmt = _leaves.length;
    string[] memory inputs = new string[](_leavesAmt + 1);
    inputs[0] = vm.toString(_leaf);
    for (uint256 i = 0; i < _leavesAmt; i++) {
      inputs[i + 1] = vm.toString(_leaves[i]);
    }

    // Call the ProofGenerator script using node
    string[] memory scriptArgs = new string[](2);
    scriptArgs[0] = 'node';
    scriptArgs[1] = 'test/helper/MerkleProofGenerator.mjs';
    _proof = vm.ffi(_concat(scriptArgs, inputs));
  }

  /*///////////////////////////////////////////////////////////////
                             UTILS 
  //////////////////////////////////////////////////////////////*/

  function _deal(address _account, IERC20 _asset, uint256 _amount) internal {
    if (_asset == IERC20(Constants.NATIVE_ASSET)) {
      deal(_account, _amount);
    } else {
      deal(address(_asset), _account, _amount);
    }
  }

  function _balance(address _account, IERC20 _asset) internal view returns (uint256 _bal) {
    if (_asset == IERC20(Constants.NATIVE_ASSET)) {
      _bal = _account.balance;
    } else {
      _bal = _asset.balanceOf(_account);
    }
  }

  function _concat(string[] memory _arr1, string[] memory _arr2) internal pure returns (string[] memory) {
    string[] memory returnArr = new string[](_arr1.length + _arr2.length);
    uint256 i;
    for (; i < _arr1.length;) {
      returnArr[i] = _arr1[i];
      unchecked {
        ++i;
      }
    }
    uint256 j;
    for (; j < _arr2.length;) {
      returnArr[i + j] = _arr2[j];
      unchecked {
        ++j;
      }
    }
    return returnArr;
  }

  function _deductFee(uint256 _amount, uint256 _feeBPS) internal pure returns (uint256 _afterFees) {
    _afterFees = _amount - ((_amount * _feeBPS) / 10_000);
  }

  function _hashNullifier(uint256 _nullifier) internal pure returns (uint256 _nullifierHash) {
    _nullifierHash = PoseidonT2.hash([_nullifier]);
  }

  function _hashPrecommitment(uint256 _nullifier, uint256 _secret) internal pure returns (uint256 _precommitment) {
    _precommitment = PoseidonT3.hash([_nullifier, _secret]);
  }

  function _hashCommitment(
    uint256 _amount,
    uint256 _label,
    uint256 _precommitment
  ) internal pure returns (uint256 _commitmentHash) {
    _commitmentHash = PoseidonT4.hash([_amount, _label, _precommitment]);
  }

  function _genSecretBySeed(string memory _seed) internal pure returns (uint256 _secret) {
    _secret = uint256(keccak256(bytes(_seed))) % Constants.SNARK_SCALAR_FIELD;
  }

  /*///////////////////////////////////////////////////////////////
                   MERKLE TREE OPERATIONS 
  //////////////////////////////////////////////////////////////*/

  function _insertIntoShadowMerkleTree(uint256 _leaf) internal {
    _shadowMerkleTree._insert(_leaf);
    _merkleLeaves.push(_leaf);
  }

  function _insertIntoShadowASPMerkleTree(uint256 _leaf) internal {
    _shadowASPMerkleTree._insert(_leaf);
    _aspLeaves.push(_leaf);
  }
}
