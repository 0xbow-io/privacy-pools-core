import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { fs as memfs, vol } from "memfs";
import { Circuits } from "../../src/circuits/index.js";
import { FetchArtifact } from "../../src/internal.js";
import { CircuitsMock } from "../mocks/index.js";

vi.mock("fs");

const ARTIFACT_DIR = "/dist/node/artifacts";
const WASM_PATH = `${ARTIFACT_DIR}/withdraw.wasm`;

describe("Circuits for Node", () => {
  let circuits: Circuits;
  afterEach(() => {
    vi.clearAllMocks();
  });

  beforeEach(() => {
    vol.reset();
    memfs.mkdirSync(ARTIFACT_DIR, { recursive: true });
    memfs.writeFileSync(WASM_PATH, "somedata");
    circuits = new CircuitsMock({
      baseUrl: `file://${ARTIFACT_DIR}`,
      browser: false,
    });
  });

  it("virtual file exists", () => {
    expect(memfs.existsSync(WASM_PATH)).toStrictEqual(true);
    expect(memfs.existsSync("non_existent_file")).toStrictEqual(false);
  });

  it("throws a FetchArtifact exception if artifact is not found in filesystem", async () => {
    await expect(
      circuits._fetchVersionedArtifact("artifacts/artifact_not_here.wasm"),
    ).rejects.toThrowError(FetchArtifact);
  });

  it("loads artifact if it exists on filesystem", async () => {
    await expect(
      circuits._fetchVersionedArtifact("artifacts/withdraw.wasm"),
    ).resolves.toBeInstanceOf(Uint8Array);
  });
});
