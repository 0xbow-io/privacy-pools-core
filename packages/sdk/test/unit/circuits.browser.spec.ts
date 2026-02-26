import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { Circuits } from "../../src/circuits/index.js";
import { FetchArtifact } from "../../src/internal.js";
import { CircuitsMock } from "../mocks/index.js";

class CircuitsMockBrowser extends CircuitsMock {
  override _browser() {
    return true;
  }
  override baseUrl: string = "http://0.0.0.0:8888";
}

describe("Circuits for browser", () => {
  afterEach(() => {
    vi.clearAllMocks();
  });

  let circuits: Circuits;

  beforeEach(() => {
    circuits = new CircuitsMockBrowser();
  });

  it("test server should 'pong' back", async () => {
    expect(
      await (await fetch("http://0.0.0.0:8888/ping")).text(),
    ).toStrictEqual("pong");
  });

  it("test server serves mock files", async () => {
    const u8s = new Uint8Array([0, 1, 2, 3]);
    expect(
      await (
        await fetch("http://0.0.0.0:8888/artifacts/withdraw.wasm")
      ).arrayBuffer(),
    ).toStrictEqual(u8s.buffer);
  });

  it("throws a FetchArtifact exception if artifact is not found at URI", async () => {
    await expect(async () => {
      return await circuits._fetchVersionedArtifact(
        "artifacts/artifact_not_here.wasm",
      );
    }).rejects.toThrowError(FetchArtifact);
  });

  it("loads artifact if correctly served", async () => {
    await expect(
      circuits._fetchVersionedArtifact("artifacts/withdraw.wasm"),
    ).resolves.toBeInstanceOf(Uint8Array);
  });
});
