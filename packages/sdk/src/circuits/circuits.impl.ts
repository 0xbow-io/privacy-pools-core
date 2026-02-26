import { CircuitInitialization, FetchArtifact } from "../internal.js";
import {
  Binaries,
  CircuitArtifacts,
  CircuitName,
  CircuitNameString,
  CircuitsInterface,
  circuitToAsset,
  Version,
  VersionString,
} from "./circuits.interface.js";
import { importFetchVersionedArtifact } from "./fetchArtifacts.js";

interface CircuitOptions {
  baseUrl?: string;
  browser?: boolean;
}

/**
 * Class representing circuit management and artifact handling.
 * Implements the CircuitsInterface.
 */
export class Circuits implements CircuitsInterface {
  /**
   * Indicates whether the circuits have been initialized.
   * @type {boolean}
   * @protected
   */
  protected initialized: boolean = false;
  /**
   * The version of the circuit artifacts being used.
   * @type {VersionString}
   * @protected
   */
  protected version: VersionString = Version.Latest;
  /**
   * The binaries containing circuit artifacts such as wasm, vkey, and zkey files.
   * @type {Binaries}
   * @protected
   */
  protected binaries!: Binaries;
  /**
   * The base URL for fetching circuit artifacts.
   * @type {string}
   * @protected
   */
  protected baseUrl: string = import.meta.url;

  protected readonly browser: boolean = true;

  /**
   * Constructor to initialize the Circuits class with an optional custom base URL.
   * @param {string} [options.baseUrl] - The base URL for fetching circuit artifacts (optional).
   * @param {boolean} [options.browser] - Controls how the circuits will be loaded, using either `fetch` if true or `fs` otherwise. Defaults to true.
   */
  constructor(options?: CircuitOptions) {
    if (options?.baseUrl) {
      this.baseUrl = options.baseUrl;
    }
    if (options?.browser !== undefined) {
      this.browser = options.browser;
    }
  }

  /**
   * Determines whether the environment is a browser.
   * @returns {boolean} True if running in a browser environment, false otherwise.
   * @protected
   */
  _browser(): boolean {
    return typeof window !== "undefined";
  }

  /**
   * Initializes the circuit manager with binaries and a version.
   * @param {Binaries} binaries - The binaries containing circuit artifacts.
   * @param {VersionString} version - The version of the circuit artifacts.
   * @protected
   */
  protected _initialize(binaries: Binaries, version: VersionString) {
    this.binaries = binaries;
    this.version = version;
    this.initialized = true;
  }

  /**
   * Handles initialization of circuit artifacts, fetching them if necessary.
   * @param {VersionString} [version=Version.latest] - The version of the circuit artifacts.
   * @throws {CircuitInitialization} If an error occurs during initialization.
   * @protected
   * @async
   */
  protected async _handleInitialization(
    version: VersionString = Version.Latest,
  ) {
    if (!this.initialized || this.binaries === undefined) {
      try {
        await this.initArtifacts(version);
      } catch (e) {
        if (e instanceof FetchArtifact) {
          throw new CircuitInitialization(`${e.name}: ${e.message}`);
        } else {
          console.error(e);
          throw new CircuitInitialization(`UnknownError: ${e}`);
        }
      }
    }
  }

  /**
   * Fetches a versioned artifact from a given path.
   * @param {string} artifactPath - The path to the artifact.
   * @param {VersionString} version - The version of the artifact.
   * @returns {Promise<Uint8Array>} A promise that resolves to the artifact as a Uint8Array.
   * @throws {FetchArtifact} If the artifact cannot be fetched.
   * @protected
   * @async
   */
  async _fetchVersionedArtifact(artifactPath: string): Promise<Uint8Array> {
    const artifactUrl = new URL(artifactPath, this.baseUrl);
    const { fetchVersionedArtifact } = await importFetchVersionedArtifact(
      this.browser,
    );
    return fetchVersionedArtifact(artifactUrl);
  }

  /**
   * Downloads and returns the circuit artifacts for a specific circuit.
   * @param {CircuitNameString} circuitName - The name of the circuit.
   * @returns {Promise<CircuitArtifacts>} A promise that resolves to the circuit artifacts.
   * @protected
   * @async
   */
  async _downloadCircuitArtifacts(
    circuitName: CircuitNameString,
  ): Promise<CircuitArtifacts> {
    const assetName = circuitToAsset[circuitName];

    const [wasm, vkey, zkey] = await Promise.all([
      this._fetchVersionedArtifact(["artifacts", assetName.wasm].join("/")),
      this._fetchVersionedArtifact(["artifacts", assetName.vkey].join("/")),
      this._fetchVersionedArtifact(["artifacts", assetName.zkey].join("/")),
    ]);
    return { wasm, vkey, zkey };
  }

  /**
   * Downloads all circuit artifacts for the specified version.
   * @param {VersionString} version - The version of the artifacts.
   * @returns {Promise<Binaries>} A promise that resolves to the binaries containing all circuit artifacts.
   * @async
   */
  // prettier-ignore
  async downloadArtifacts(version: VersionString): Promise<Binaries> { // eslint-disable-line @typescript-eslint/no-unused-vars
    const [commitment, withdraw] = await Promise.all([
      this._downloadCircuitArtifacts(CircuitName.Commitment),
      this._downloadCircuitArtifacts(CircuitName.Withdraw),
    ]);
    return {
      commitment,
      withdraw,
    } as Binaries;
  }

  /**
   * Initializes the circuit artifacts for the specified version.
   * @param {VersionString} version - The version of the artifacts.
   * @returns {Promise<void>} A promise that resolves when initialization is complete.
   * @async
   */
  async initArtifacts(version: VersionString): Promise<void> {
    const binaries = await this.downloadArtifacts(version);
    this._initialize(binaries, version);
  }

  /**
   * Retrieves the verification key for a specified circuit.
   * @param {CircuitNameString} circuitName - The name of the circuit.
   * @param {VersionString} [version=Version.latest] - The version of the artifacts.
   * @returns {Promise<Uint8Array>} A promise that resolves to the verification key.
   * @async
   */
  async getVerificationKey(
    circuitName: CircuitNameString,
    version: VersionString = Version.Latest,
  ): Promise<Uint8Array> {
    await this._handleInitialization(version);
    const artifacts = this.binaries[circuitName];
    if (!artifacts) {
      throw new CircuitInitialization(`Circuit artifacts not found for ${circuitName}`);
    }
    return artifacts.vkey;
  }

  /**
   * Retrieves the proving key for a specified circuit.
   * @param {CircuitNameString} circuitName - The name of the circuit.
   * @param {VersionString} [version=Version.latest] - The version of the artifacts.
   * @returns {Promise<Uint8Array>} A promise that resolves to the proving key.
   * @async
   */
  async getProvingKey(
    circuitName: CircuitNameString,
    version: VersionString = Version.Latest,
  ): Promise<Uint8Array> {
    await this._handleInitialization(version);
    const artifacts = this.binaries[circuitName];
    if (!artifacts) {
      throw new CircuitInitialization(`Circuit artifacts not found for ${circuitName}`);
    }
    return artifacts.zkey;
  }

  /**
   * Retrieves the wasm file for a specified circuit.
   * @param {CircuitNameString} circuitName - The name of the circuit.
   * @param {VersionString} [version=Version.latest] - The version of the artifacts.
   * @returns {Promise<Uint8Array>} A promise that resolves to the wasm file.
   * @async
   */
  async getWasm(
    circuitName: CircuitNameString,
    version: VersionString = Version.Latest,
  ): Promise<Uint8Array> {
    await this._handleInitialization(version);
    const artifacts = this.binaries[circuitName];
    if (!artifacts) {
      throw new CircuitInitialization(`Circuit artifacts not found for ${circuitName}`);
    }
    return artifacts.wasm;
  }
}
