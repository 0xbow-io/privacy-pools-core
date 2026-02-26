import {
  Binaries,
  CircuitArtifacts,
  VersionString,
} from "../../src/circuits/circuits.interface.js";
import { Circuits } from "../../src/circuits/index.js";

export const binariesMock: Binaries = {
  withdraw: {
    wasm: new Uint8Array([1, 2, 3]),
    vkey: new Uint8Array([4, 5, 6]),
    zkey: new Uint8Array([7, 8, 9]),
  },
  commitment: {
    wasm: new Uint8Array([19, 20, 21]),
    vkey: new Uint8Array([22, 23, 24]),
    zkey: new Uint8Array([25, 26, 27]),
  },
};

export class CircuitsMock extends Circuits {
  override _initialize(binaries: Binaries, version: VersionString) {
    super._initialize(binaries, version);
  }

  override async _handleInitialization(version: VersionString) {
    await super._handleInitialization(version);
  }

  get introspectInitialized(): boolean {
    return this.initialized;
  }

  get introspectVersion(): string {
    return this.version;
  }

  get introspectBinaries(): Binaries {
    return this.binaries;
  }
}
