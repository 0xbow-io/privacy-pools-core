/**
 * Enum representing available versions of circuit artifacts.
 */
export enum Version {
  /**
   * The latest version of the circuit artifacts.
   */
  Latest = "latest",
}

/**
 * Type representing a version string, which is a string literal derived from the Version enum.
 */
export type VersionString = `${Version}`;

/**
 * Enum representing the names of available circuits.
 */
export enum CircuitName {
  /**
   * Circuit for commitments.
   */
  Commitment = "commitment",
  /**
   * Circuit for Merkle tree operations.
   */
  MerkleTree = "merkleTree",
  /**
   * Circuit for withdrawal operations.
   */
  Withdraw = "withdraw",
}

/**
 * Type representing a circuit name string, which is a string literal derived from the CircuitName enum.
 */
export type CircuitNameString = `${CircuitName}`;

/**
 * Interface representing the artifacts associated with a circuit.
 */
export interface CircuitArtifacts {
  /**
   * The precompiled wasm file for the circuit.
   * @type {Uint8Array}
   */
  wasm: Uint8Array;
  /**
   * The verification key for the circuit.
   * @type {Uint8Array}
   */
  vkey: Uint8Array;
  /**
   * The proving key for the circuit.
   * @type {Uint8Array}
   */
  zkey: Uint8Array;
}

/**
 * Type representing the mapping of circuit names to their respective asset file paths.
 */
export type Circ2Asset = {
  [key in CircuitName]: {
    /**
     * The filename of the compiled wasm file.
     */
    wasm: string;
    /**
     * The filename of the verification key file.
     */
    vkey: string;
    /**
     * The filename of the proving key file.
     */
    zkey: string;
  };
};

/**
 * Mapping of circuit names to their respective asset file paths.
 * @const
 */
export const circuitToAsset: Circ2Asset = {
  [CircuitName.Commitment]: {
    wasm: "commitment.wasm",
    vkey: "commitment.vkey",
    zkey: "commitment.zkey",
  },
  [CircuitName.MerkleTree]: {
    wasm: "merkleTree.wasm",
    vkey: "merkleTree.vkey",
    zkey: "merkleTree.zkey",
  },
  [CircuitName.Withdraw]: {
    wasm: "withdraw.wasm",
    vkey: "withdraw.vkey",
    zkey: "withdraw.zkey",
  },
} as const;

/**
 * Type representing the mapping of circuit name strings to their associated circuit artifacts.
 */
export interface Binaries {
  commitment: CircuitArtifacts;
  withdraw: CircuitArtifacts;
  merkleTree?: CircuitArtifacts;
}

/**
 * Interface defining the methods required for managing circuits and their artifacts.
 */
export interface CircuitsInterface {
  /**
   * Downloads all artifacts for the specified version of circuits.
   * @param {VersionString} version - The version of the artifacts to download.
   * @returns {Promise<Binaries>} A promise that resolves to the binaries containing all circuit artifacts.
   * @async
   */
  downloadArtifacts(version: VersionString): Promise<Binaries>;

  /**
   * Initializes the artifacts for the specified version of circuits.
   * @param {VersionString} version - The version of the artifacts to initialize.
   * @returns {Promise<void>} A promise that resolves when initialization is complete.
   * @async
   */
  initArtifacts(version: VersionString): Promise<void>;

  /**
   * Retrieves the verification key for a specified circuit.
   * @param {CircuitNameString} circuitName - The name of the circuit.
   * @param {VersionString} [version] - The version of the artifacts (defaults to the latest).
   * @returns {Promise<Uint8Array>} A promise that resolves to the verification key.
   * @async
   */
  getVerificationKey(
    circuitName: CircuitNameString,
    version?: VersionString,
  ): Promise<Uint8Array>;

  /**
   * Retrieves the proving key for a specified circuit.
   * @param {CircuitNameString} circuitName - The name of the circuit.
   * @param {VersionString} [version] - The version of the artifacts (defaults to the latest).
   * @returns {Promise<Uint8Array>} A promise that resolves to the proving key.
   * @async
   */
  getProvingKey(
    circuitName: CircuitNameString,
    version?: VersionString,
  ): Promise<Uint8Array>;

  /**
   * Retrieves the wasm file for a specified circuit.
   * @param {CircuitNameString} circuitName - The name of the circuit.
   * @param {VersionString} [version] - The version of the artifacts (defaults to the latest).
   * @returns {Promise<Uint8Array>} A promise that resolves to the wasm file.
   * @async
   */
  getWasm(
    circuitName: CircuitNameString,
    version?: VersionString,
  ): Promise<Uint8Array>;
}
