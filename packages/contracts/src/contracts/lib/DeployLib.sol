// SPDX-License-Identifier: Apache-2.0
pragma solidity 0.8.28;

/**
 * @title DeployLib
 * @dev A library for deterministic deployment of Privacy Pool contracts and related components
 * using CREATE2 via the CreateX contract.
 *
 * This library provides predefined salt values for deterministic deployments of:
 * - Entrypoint (as an UUPS proxy)
 * - Simple Privacy Pool (for native assets)
 * - Complex Privacy Pool (for ERC20 tokens)
 * - Commitment Verifier
 * - Withdrawal Verifier
 *
 * Each component can be deployed with a deterministic address based on these predefined salts.
 */
library DeployLib {
  /**
   * @dev Predefined salt values for each contract type
   * @notice These values ensure deterministic addresses across deployments
   */
  bytes11 internal constant ENTRYPOINT_IMPL_SALT = bytes11(keccak256('EntrypointImplementation_1'));
  bytes11 internal constant ENTRYPOINT_PROXY_SALT = bytes11(keccak256('EntrypointProxy_1'));
  bytes11 internal constant SIMPLE_POOL_SALT = bytes11(keccak256(abi.encodePacked('PrivacyPoolSimple_1')));
  bytes11 internal constant COMPLEX_POOL_SALT = bytes11(keccak256(abi.encodePacked('PrivacyPoolComplex_1')));
  bytes11 internal constant WITHDRAWAL_VERIFIER_SALT = bytes11(keccak256(abi.encodePacked('WithdrawalVerifier_1')));
  bytes11 internal constant RAGEQUIT_VERIFIER_SALT = bytes11(keccak256(abi.encodePacked('RagequitVerifier_1')));

  /**
   * @dev Creates a custom salt for deterministic deployments
   * @param _deployer Address of the deployer
   * @param _custom Custom salt value
   * @return _customSalt The generated salt
   */
  function salt(address _deployer, bytes11 _custom) internal pure returns (bytes32 _customSalt) {
    return bytes32(abi.encodePacked(_deployer, hex'00', _custom));
  }
}
