import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { CircuitName } from "../../src/circuits/circuits.interface.js";
import { CircuitInitialization, FetchArtifact } from "../../src/internal.js";
import { CircuitsMock, binariesMock } from "../mocks/index.js";

describe("Circuits", () => {
  afterEach(() => {
    vi.clearAllMocks();
  });

  describe("Initialization", () => {
    let circuits: CircuitsMock;

    beforeEach(() => {
      circuits = new CircuitsMock();
    });

    it("creates a new circuit handler, uninitialized", () => {
      expect(circuits).toBeDefined();
      expect(circuits.introspectVersion).toStrictEqual("latest");
      expect(circuits.introspectInitialized).toStrictEqual(false);
      expect(circuits.introspectBinaries).toStrictEqual(undefined);
    });
  });

  describe("handles initialization correctly", () => {
    let circuits: CircuitsMock;
    const fetchArtifactError = new FetchArtifact(
      new URL("http://test.com/artifact"),
    );

    beforeEach(() => {
      circuits = new CircuitsMock();
    });

    it("downloads mock artifacts and initializes correctly", async () => {
      const downloadArtifactsSpy = vi
        .spyOn(circuits, "downloadArtifacts")
        .mockResolvedValue(binariesMock);
      const version = "latest";
      await circuits.initArtifacts(version);
      expect(circuits).toBeDefined();
      expect(circuits.introspectVersion).toStrictEqual(version);
      expect(circuits.introspectInitialized).toStrictEqual(true);
      expect(circuits.introspectBinaries).toStrictEqual(binariesMock);
      expect(downloadArtifactsSpy.mock.calls.length).toStrictEqual(1);
    });

    it("_initialize sets up 'binaries', 'version', 'initialized'", () => {
      circuits._initialize(binariesMock, "latest");
      expect(circuits.introspectVersion).toStrictEqual("latest");
      expect(circuits.introspectInitialized).toStrictEqual(true);
      expect(circuits.introspectBinaries).toStrictEqual(binariesMock);
    });

    it("_downloadCircuitArtifacts raises FetchArtifact if _fetchVersionedArtifact throws", async () => {
      const fetchVersionedSpy = vi
        .spyOn(circuits, "_fetchVersionedArtifact")
        .mockRejectedValue(fetchArtifactError);
      await expect(
        async () =>
          await circuits._downloadCircuitArtifacts(CircuitName.Withdraw),
      ).rejects.toThrowError(FetchArtifact);
      expect(fetchVersionedSpy).toHaveBeenCalled();
    });

    it("downloadArtifacts raises FetchArtifact if _downloadCircuitArtifacts throws", async () => {
      const downloadCircuitArtifactsSpy = vi
        .spyOn(circuits, "_downloadCircuitArtifacts")
        .mockRejectedValue(fetchArtifactError);
      await expect(
        async () => await circuits.downloadArtifacts("latest"),
      ).rejects.toThrowError(FetchArtifact);
      expect(downloadCircuitArtifactsSpy).toHaveBeenCalled();
    });

    it("initArtifacts raises FetchArtifact", async () => {
      const downloadArtifactsSpy = vi
        .spyOn(circuits, "downloadArtifacts")
        .mockRejectedValue(fetchArtifactError);
      await expect(
        async () => await circuits.initArtifacts("latest"),
      ).rejects.toThrowError(FetchArtifact);
      expect(downloadArtifactsSpy).toHaveBeenCalled();
      expect(downloadArtifactsSpy).toHaveBeenCalledOnce();
      expect(downloadArtifactsSpy).toHaveBeenCalledWith("latest");
    });

    it("_handleInitialization raises CircuitInitialization error when something happens", async () => {
      vi.spyOn(circuits, "initArtifacts").mockRejectedValue(fetchArtifactError);
      await expect(
        async () => await circuits._handleInitialization("latest"),
      ).rejects.toThrowError(CircuitInitialization);
      vi.spyOn(circuits, "initArtifacts").mockRejectedValue(
        new Error("DifferentError"),
      );
      await expect(
        async () => await circuits._handleInitialization("latest"),
      ).rejects.toThrowError(CircuitInitialization);
    });
  });

  describe("artifact getters", () => {
    let circuits: CircuitsMock;

    beforeEach(() => {
      circuits = new CircuitsMock();
      vi.spyOn(circuits, "downloadArtifacts").mockResolvedValue(binariesMock);
    });

    it("returns wasm", async () => {
      expect(await circuits.getWasm(CircuitName.Withdraw)).toStrictEqual(
        binariesMock.withdraw.wasm,
      );
      expect(await circuits.getWasm(CircuitName.Commitment)).toStrictEqual(
        binariesMock.commitment.wasm,
      );
    });

    it("returns proving key", async () => {
      expect(await circuits.getProvingKey(CircuitName.Withdraw)).toStrictEqual(
        binariesMock.withdraw.zkey,
      );
      expect(
        await circuits.getProvingKey(CircuitName.Commitment),
      ).toStrictEqual(binariesMock.commitment.zkey);
    });

    it("returns verifying key", async () => {
      expect(
        await circuits.getVerificationKey(CircuitName.Withdraw),
      ).toStrictEqual(binariesMock.withdraw.vkey);
      expect(
        await circuits.getVerificationKey(CircuitName.Commitment),
      ).toStrictEqual(binariesMock.commitment.vkey);
    });
  });
});
