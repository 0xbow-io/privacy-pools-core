import { describe, expect, it, vi } from "vitest";
import { WithdrawalValidationError } from "../../src/exceptions/base.exception.ts";
import { WithdrawalPayload } from "../../src/interfaces/relayer/request.ts";
import {
  ASSET_ADDRESS_TEST,
  ENTRYPOINT_ADDRESS_TEST,
  PUBLIC_SIGNALS_TEST,
  RECIPIENT_TEST,
  testingConfig,
} from "../inputs/default.input.ts";
import {
  dataCorrect,
  dataMismatchFee,
  dataMismatchFeeRecipient,
} from "../inputs/validateWithdrawal.input.ts";

import { WithdrawalProof } from "@0xbow/privacy-pools-core-sdk";
import * as Config from "../../src/config.ts";
import { PrivacyPoolRelayer } from "../../src/services/privacyPoolRelayer.service.ts";
import { RelayerDatabase } from "../../src/types/db.types.ts";
import { SdkProviderInterface } from "../../src/types/sdk.types.ts";
import { createDbMock } from "../mocks/db.mock.ts";
import { createSdkProviderMock } from "../mocks/sdk.provider.mock.ts";

class PrivacyPoolRelayerMock extends PrivacyPoolRelayer {
  constructor(db: RelayerDatabase, sdk: SdkProviderInterface) {
    super();
    this.db = db;
    this.sdkProvider = sdk;
  }
}

vi.mock("../../src/config.ts", async (importOriginal) => {
  const originalConfig =
    await importOriginal<typeof import("../../src/config.ts")>();
  return {
    ...originalConfig,
    ...testingConfig,
  };
});

describe("PrivacyPoolRelayer", () => {
  describe("validateWithdrawal", () => {
    let service: PrivacyPoolRelayerMock;

    beforeEach(() => {
      const dbMock = createDbMock();
      const sdkProviderMock = createSdkProviderMock();
      service = new PrivacyPoolRelayerMock(dbMock, sdkProviderMock);
    });

    afterEach(() => {
      vi.clearAllMocks();
      vi.resetModules();
    });

    it("raises processooor mismatch if it doesnt point to entrypoint", async () => {
      const withdrawalPayload: WithdrawalPayload = {
        withdrawal: {
          processooor: RECIPIENT_TEST,
          scope: 0n,
          data: dataCorrect,
        },
        proof: {
          proof: "" as WithdrawalProof,
          publicSignals: PUBLIC_SIGNALS_TEST,
        },
      };
      await expect(() =>
        service.validateWithdrawal(withdrawalPayload),
      ).rejects.toThrowError(
        WithdrawalValidationError.processooorMismatch(
          'Processooor mismatch: expected "0xe1e1e1e1e1e1e1e1e1e1e1e1e1e1e1e1e1e1e1e1", got "0x2222222222222222222222222222222222222222".',
        ),
      );
    });

    it("raises fee recipient mismatch", async () => {
      const withdrawalPayload: WithdrawalPayload = {
        withdrawal: {
          processooor: ENTRYPOINT_ADDRESS_TEST,
          scope: 0n,
          data: dataMismatchFeeRecipient,
        },
        proof: {
          proof: "" as WithdrawalProof,
          publicSignals: PUBLIC_SIGNALS_TEST,
        },
      };
      await expect(() =>
        service.validateWithdrawal(withdrawalPayload),
      ).rejects.toThrowError(
        WithdrawalValidationError.feeReceiverMismatch(
          `Fee recipient mismatch: expected "${testingConfig.FEE_RECEIVER_ADDRESS}", got "${RECIPIENT_TEST}".`,
        ),
      );
    });

    it("raises fee mismatch if data fee differs from relayer", async () => {
      const withdrawalPayload: WithdrawalPayload = {
        withdrawal: {
          processooor: ENTRYPOINT_ADDRESS_TEST,
          scope: 0n,
          data: dataMismatchFee,
        },
        proof: {
          proof: "" as WithdrawalProof,
          publicSignals: PUBLIC_SIGNALS_TEST,
        },
      };
      await expect(() =>
        service.validateWithdrawal(withdrawalPayload),
      ).rejects.toThrowError(
        WithdrawalValidationError.feeMismatch(
          'Relay fee mismatch: expected "2000", got "4000".',
        ),
      );
    });

    it("raises context mismatch if withdrawal's context doesnt match public signal", async () => {
      const withdrawalPayload: WithdrawalPayload = {
        withdrawal: {
          processooor: ENTRYPOINT_ADDRESS_TEST,
          data: dataCorrect,
        },
        proof: {
          proof: "" as WithdrawalProof,
          publicSignals: PUBLIC_SIGNALS_TEST,
        },
        scope: BigInt(0x5c0fen), // correct == 0n
      };
      await expect(() =>
        service.validateWithdrawal(withdrawalPayload),
      ).rejects.toThrowError(
        WithdrawalValidationError.contextMismatch(
          'Context mismatch: expected "2ccc7ebae3d6e0489846523cad0cef023986027fc089dc4ce57f9ed644c5f185", got "85bb30f63789e69035080816ae268a74e87b221245153876134a3f39e04b799".',
        ),
      );
    });

    it("raises withdrawn value too small", async () => {
      const publicSignals = [...PUBLIC_SIGNALS_TEST];
      publicSignals[2] = 100n;
      publicSignals[7] =
        10793626036679745516481859563284572555060983750341001924900435534433131367129n;
      const withdrawalPayload: WithdrawalPayload = {
        withdrawal: {
          processooor: ENTRYPOINT_ADDRESS_TEST,
          data: dataCorrect,
        },
        proof: {
          proof: "" as WithdrawalProof,
          publicSignals,
        },
        scope: 0n,
      };

      vi.spyOn(Config, "WITHDRAW_AMOUNTS", "get").mockReturnValue({
        [ASSET_ADDRESS_TEST]: 150n,
      });

      await expect(() =>
        service.validateWithdrawal(withdrawalPayload),
      ).rejects.toThrowError(
        WithdrawalValidationError.withdrawnValueTooSmall(
          'Withdrawn value too small: expected minimum "150", got "100".',
        ),
      );

      vi.spyOn(Config, "WITHDRAW_AMOUNTS", "get").mockReturnValue({
        [ASSET_ADDRESS_TEST]: 50n,
      });

      await expect(service.validateWithdrawal(withdrawalPayload)).resolves.toBe(
        undefined,
      );
    });

    it("validates with no issues", async () => {
      const publicSignals = PUBLIC_SIGNALS_TEST;
      publicSignals[7] =
        10793626036679745516481859563284572555060983750341001924900435534433131367129n;

      const withdrawalPayload: WithdrawalPayload = {
        withdrawal: {
          processooor: ENTRYPOINT_ADDRESS_TEST,
          data: dataCorrect,
        },
        proof: {
          proof: "" as WithdrawalProof,
          publicSignals: publicSignals,
        },
        scope: 0n,
      };
      vi.spyOn(Config, "WITHDRAW_AMOUNTS", "get").mockReturnValue({
        [ASSET_ADDRESS_TEST]: 50n,
      });
      await expect(service.validateWithdrawal(withdrawalPayload)).resolves.toBe(
        undefined,
      );
    });
  });

  describe("handleRequest", () => {
    beforeEach(() => {
      vi.clearAllMocks();
      vi.resetModules();
    });

    it("handler executes correctly", async () => {
      const withdrawalPayload: WithdrawalPayload = {
        withdrawal: {
          processooor: ENTRYPOINT_ADDRESS_TEST,
          data: dataCorrect,
        },
        proof: {
          proof: "" as WithdrawalProof,
          publicSignals: PUBLIC_SIGNALS_TEST,
        },
        scope: 0n,
      };

      const dbMock = createDbMock();
      const sdkProviderMock = createSdkProviderMock();

      const service = new PrivacyPoolRelayerMock(dbMock, sdkProviderMock);
      const validateSpy = vi.spyOn(service, "validateWithdrawal");
      const verifySpy = vi.spyOn(service, "verifyProof");
      const broadcastSpy = vi.spyOn(service, "broadcastWithdrawal");

      expect(service.db).toBe(dbMock);
      expect(service.sdkProvider).toBe(sdkProviderMock);

      await expect(
        service.handleRequest(withdrawalPayload),
      ).resolves.toMatchObject({
        success: true,
        txHash: "0xTx",
      });

      expect(dbMock.createNewRequest).toHaveBeenCalledOnce();
      expect(dbMock.updateBroadcastedRequest).toHaveBeenCalledOnce();
      expect(validateSpy).toHaveBeenCalledOnce();
      expect(verifySpy).toHaveBeenCalledOnce();
      expect(broadcastSpy).toHaveBeenCalledOnce();
      expect(sdkProviderMock.broadcastWithdrawal).toHaveBeenCalledOnce();
    });

    describe("handler returns error", () => {
      const withdrawalPayload: WithdrawalPayload = {
        withdrawal: {
          processooor: ENTRYPOINT_ADDRESS_TEST,
          data: dataCorrect,
        },
        proof: {
          proof: "" as WithdrawalProof,
          publicSignals: PUBLIC_SIGNALS_TEST,
        },
        scope: 0n,
      };

      it("when verification fails", async () => {
        const dbMock = createDbMock();
        const sdkProviderMock = createSdkProviderMock({
          verifyWithdrawal: vi.fn().mockResolvedValue(false),
        });

        const service = new PrivacyPoolRelayerMock(dbMock, sdkProviderMock);
        const validateSpy = vi
          .spyOn(service, "validateWithdrawal")
          .mockRejectedValue(new WithdrawalValidationError("Some error"));
        const verifySpy = vi.spyOn(service, "verifyProof");
        const broadcastSpy = vi.spyOn(service, "broadcastWithdrawal");

        expect(service.db).toBe(dbMock);
        expect(service.sdkProvider).toBe(sdkProviderMock);

        await expect(
          service.handleRequest(withdrawalPayload),
        ).resolves.toMatchObject({
          success: false,
          error: "Some error",
        });

        expect(dbMock.createNewRequest).toHaveBeenCalledOnce();
        expect(validateSpy).toHaveBeenCalledOnce();
        expect(verifySpy).toHaveBeenCalledTimes(0);
        expect(dbMock.updateFailedRequest).toHaveBeenCalledOnce();
        expect(broadcastSpy).toHaveBeenCalledTimes(0);
      });

      it("when proof fails", async () => {
        const dbMock = createDbMock();
        const sdkProviderMock = createSdkProviderMock({
          verifyWithdrawal: vi.fn().mockResolvedValue(false),
        });

        const service = new PrivacyPoolRelayerMock(dbMock, sdkProviderMock);
        const validateSpy = vi.spyOn(service, "validateWithdrawal");
        const verifySpy = vi.spyOn(service, "verifyProof");
        const broadcastSpy = vi.spyOn(service, "broadcastWithdrawal");

        expect(service.db).toBe(dbMock);
        expect(service.sdkProvider).toBe(sdkProviderMock);

        await expect(
          service.handleRequest(withdrawalPayload),
        ).resolves.toMatchObject({
          success: false,
          error: "Invalid proof",
        });

        expect(dbMock.createNewRequest).toHaveBeenCalledOnce();
        expect(validateSpy).toHaveBeenCalledOnce();
        expect(verifySpy).toHaveBeenCalledOnce();
        expect(dbMock.updateFailedRequest).toHaveBeenCalledOnce();
        expect(broadcastSpy).toHaveBeenCalledTimes(0);
      });
    });
  });
});
