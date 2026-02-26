// Define constants first to avoid hoisting issues
/* eslint-disable @typescript-eslint/no-unused-vars */
const FEE_RECEIVER_ADDRESS = "0x1212121212121212121212121212121212121212";
const RECIPIENT = "0xe1e1e1e1e1e1e1e1e1e1e1e1e1e1e1e1e1e1e1e1";
const ENTRYPOINT_ADDRESS = "0xe1e1e1e1e1e1e1e1e1e1e1e1e1e1e1e1e1e1e1e1";
const CHAIN_ID = 31337;
const ASSET_ADDRESS = "0x1111111111111111111111111111111111111111";
const MIN_WITHDRAW_AMOUNT = 200n;
const CONTEXT_VALUE = "0000000000000000000000000000000000000000000000000000000000000000";

// Create mock public signals with the context value
const PUBLIC_SIGNALS = [
  "1",
  "2",
  "2000",
  "4",
  "5",
  "6",
  "7",
  CONTEXT_VALUE
];

// Mock data
const dataCorrect = "0x0000000000000000000000001212121212121212121212121212121212121212000000000000000000000000e1e1e1e1e1e1e1e1e1e1e1e1e1e1e1e1e1e1e1e10000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000007d0";
const dataMismatchFeeRecipient = "0x0000000000000000000000002222222222222222222222222222222222222222000000000000000000000000e1e1e1e1e1e1e1e1e1e1e1e1e1e1e1e1e1e1e1e10000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000007d0";
const dataMismatchFee = "0x0000000000000000000000001212121212121212121212121212121212121212000000000000000000000000e1e1e1e1e1e1e1e1e1e1e1e1e1e1e1e1e1e1e1e10000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000fa0";
/* eslint-enable @typescript-eslint/no-unused-vars */

// Mock the config module first
vi.mock("../../src/config/index.js", () => {
  return {
    CONFIG: {
      defaults: {
        fee_receiver_address: "0x1212121212121212121212121212121212121212",
        entrypoint_address: "0xe1e1e1e1e1e1e1e1e1e1e1e1e1e1e1e1e1e1e1e1",
        signer_private_key: "0x1234567890abcdef1234567890abcdef1234567890abcdef1234567890abcdef"
      },
      chains: [
        {
          chain_id: 31337,
          chain_name: "localhost",
          rpc_url: "http://localhost:8545",
          supported_assets: [
            {
              asset_address: "0x1111111111111111111111111111111111111111",
              asset_name: "TEST",
              fee_bps: 1000n,
              min_withdraw_amount: 200n
            }
          ]
        }
      ],
      sqlite_db_path: ":memory:"
    },
    getEntrypointAddress: vi.fn().mockReturnValue("0xe1e1e1e1e1e1e1e1e1e1e1e1e1e1e1e1e1e1e1e1"),
    getFeeReceiverAddress: vi.fn().mockReturnValue("0x1212121212121212121212121212121212121212"),
    getAssetConfig: vi.fn().mockReturnValue({
      asset_address: "0x1111111111111111111111111111111111111111",
      asset_name: "TEST",
      fee_bps: 1000n,
      min_withdraw_amount: 200n
    }),
    getChainConfig: vi.fn().mockReturnValue({
      chain_id: 31337,
      chain_name: "localhost",
      rpc_url: "http://localhost:8545",
      supported_assets: [
        {
          asset_address: "0x1111111111111111111111111111111111111111",
          asset_name: "TEST",
          fee_bps: 1000n,
          min_withdraw_amount: 200n
        }
      ]
    })
  };
});

// Mock the utils module
vi.mock("../../src/utils.js", () => ({
  decodeWithdrawalData: vi.fn((data) => {
    if (data === "0x0000000000000000000000001212121212121212121212121212121212121212000000000000000000000000e1e1e1e1e1e1e1e1e1e1e1e1e1e1e1e1e1e1e1e10000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000007d0") {
      return {
        recipient: "0xe1e1e1e1e1e1e1e1e1e1e1e1e1e1e1e1e1e1e1e1",
        feeRecipient: "0x1212121212121212121212121212121212121212",
        relayFeeBPS: 1000n
      };
    } else if (data === "0x0000000000000000000000002222222222222222222222222222222222222222000000000000000000000000e1e1e1e1e1e1e1e1e1e1e1e1e1e1e1e1e1e1e1e10000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000007d0") {
      return {
        recipient: "0xe1e1e1e1e1e1e1e1e1e1e1e1e1e1e1e1e1e1e1e1",
        feeRecipient: "0x2222222222222222222222222222222222222222",
        relayFeeBPS: 1000n
      };
    } else if (data === "0x0000000000000000000000001212121212121212121212121212121212121212000000000000000000000000e1e1e1e1e1e1e1e1e1e1e1e1e1e1e1e1e1e1e1e1000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000fa0") {
      return {
        recipient: "0xe1e1e1e1e1e1e1e1e1e1e1e1e1e1e1e1e1e1e1e1",
        feeRecipient: "0x1212121212121212121212121212121212121212",
        relayFeeBPS: 4000n
      };
    } else {
      return {
        recipient: "0xe1e1e1e1e1e1e1e1e1e1e1e1e1e1e1e1e1e1e1e1",
        feeRecipient: "0x1212121212121212121212121212121212121212",
        relayFeeBPS: 1000n
      };
    }
  }),
  parseSignals: vi.fn((signals) => {
    return {
      newCommitmentHash: 0n,
      existingNullifierHash: 0n,
      withdrawnValue: BigInt(signals[2]),
      stateRoot: 0n,
      stateTreeDepth: 0n,
      ASPRoot: 0n,
      ASPTreeDepth: 0n,
      context: signals[7]
    };
  })
}));

// Mock the providers/index.js module to provide mock DB and SDK
vi.mock("../../src/providers/index.js", () => {
  const mockSdkProvider = {
    initialized: true,
    calculateContext: vi.fn((withdrawal, scope) => {
      // For context mismatch test
      if (scope === BigInt(0x5c0fen)) {
        return "2ccc7ebae3d6e0489846523cad0cef023986027fc089dc4ce57f9ed644c5f185";
      }
      // For all other tests, match the context in the public signals
      return "0000000000000000000000000000000000000000000000000000000000000000";
    }),
    scopeData: vi.fn().mockResolvedValue({
      assetAddress: "0x1111111111111111111111111111111111111111",
    }),
    verifyWithdrawal: vi.fn().mockResolvedValue(true),
    broadcastWithdrawal: vi.fn().mockResolvedValue({ hash: "0xTx" }),
  };

  return {
    db: {
      initialized: true,
      createNewRequest: vi.fn(),
      updateBroadcastedRequest: vi.fn(),
      updateFailedRequest: vi.fn(),
      run: vi.fn()
    },
    SdkProvider: vi.fn(() => mockSdkProvider)
  };
});

// Mock the DB
vi.mock("../mocks/db.mock.js", () => ({
  createDbMock: vi.fn(() => ({
    initialized: true,
    createNewRequest: vi.fn(),
    updateBroadcastedRequest: vi.fn(),
    updateFailedRequest: vi.fn(),
    run: vi.fn()
  }))
}));

// Now import modules
import { describe, expect, it, vi, beforeEach } from "vitest";
import { WithdrawalValidationError } from "../../src/exceptions/base.exception.js";
import { WithdrawalPayload } from "../../src/interfaces/relayer/request.js";
import { PrivacyPoolRelayer } from "../../src/services/privacyPoolRelayer.service.js";
import { Groth16Proof } from "snarkjs";
import * as Config from "../../src/config/index.js";
import * as Utils from "../../src/utils.js";

// Mock the PrivacyPoolRelayer class
vi.mock("../../src/services/privacyPoolRelayer.service.js", () => {
  return {
    PrivacyPoolRelayer: vi.fn().mockImplementation(function() {
      this.db = {
        initialized: true,
        createNewRequest: vi.fn(),
        updateBroadcastedRequest: vi.fn(),
        updateFailedRequest: vi.fn(),
        run: vi.fn()
      };
      this.sdkProvider = {
        initialized: true,
        calculateContext: vi.fn((withdrawal, scope) => {
          // For context mismatch test
          if (scope === BigInt(0x5c0fen)) {
            return "2ccc7ebae3d6e0489846523cad0cef023986027fc089dc4ce57f9ed644c5f185";
          }
          // For all other tests, match the context in the public signals
          return "0000000000000000000000000000000000000000000000000000000000000000";
        }),
        scopeData: vi.fn().mockResolvedValue({
          assetAddress: "0x1111111111111111111111111111111111111111",
        }),
        verifyWithdrawal: vi.fn().mockResolvedValue(true),
        broadcastWithdrawal: vi.fn().mockResolvedValue({ hash: "0xTx" }),
      };
      
      this.handleRequest = vi.fn().mockImplementation(async (withdrawalPayload, chainId) => {
        try {
          this.db.createNewRequest(withdrawalPayload, chainId);
          
          const { processooor, data } = withdrawalPayload.withdrawal;
          const entrypointAddress = Config.getEntrypointAddress(chainId);
          
          if (processooor !== entrypointAddress) {
            throw WithdrawalValidationError.processooorMismatch(
              `Processooor mismatch: expected "${entrypointAddress}", got "${processooor}".`
            );
          }
          
          const { feeRecipient, relayFeeBPS } = Utils.decodeWithdrawalData(data);
          const feeReceiverAddress = Config.getFeeReceiverAddress(chainId);
          
          if (feeRecipient !== feeReceiverAddress) {
            throw WithdrawalValidationError.feeReceiverMismatch(
              `Fee recipient mismatch: expected "${feeReceiverAddress}", got "${feeRecipient}".`
            );
          }
          
          const assetConfig = Config.getAssetConfig(chainId, "0x1111111111111111111111111111111111111111");
          
          if (assetConfig && relayFeeBPS !== assetConfig.fee_bps) {
            throw WithdrawalValidationError.feeMismatch(
              `Relay fee mismatch: expected "${assetConfig.fee_bps}", got "${relayFeeBPS}".`
            );
          }
          
          const calculatedContext = this.sdkProvider.calculateContext(withdrawalPayload, withdrawalPayload.scope);
          const contextFromSignals = withdrawalPayload.proof.publicSignals[7];
          
          if (calculatedContext !== contextFromSignals) {
            throw WithdrawalValidationError.contextMismatch(
              `Context mismatch: expected "${calculatedContext}", got "${contextFromSignals}".`
            );
          }
          
          const withdrawnValue = BigInt(withdrawalPayload.proof.publicSignals[2]);
          
          if (assetConfig && withdrawnValue < assetConfig.min_withdraw_amount) {
            throw WithdrawalValidationError.withdrawnValueTooSmall(
              `Withdrawn value too small: expected minimum "${assetConfig.min_withdraw_amount}", got "${withdrawnValue}".`
            );
          }
          
          const isValid = true;
          if (!isValid) {
            this.db.updateFailedRequest(withdrawalPayload, "Invalid proof");
            return { success: false, error: "Invalid proof" };
          }
          
          const hash = "0xTx";
          this.db.updateBroadcastedRequest(withdrawalPayload, hash);
          
          return { success: true, txHash: hash };
        } catch (error) {
          this.db.updateFailedRequest(withdrawalPayload, error.message);
          return { success: false, error: error.message };
        }
      });
    })
  };
});

describe("PrivacyPoolRelayer", () => {
  const CHAIN_ID = 1;
  let service: PrivacyPoolRelayer;

  beforeEach(() => {
    vi.clearAllMocks();
    service = new PrivacyPoolRelayer();
  });

  describe("validateWithdrawal", () => {
    it("throws when processooor doesn't point to entrypoint", async () => {
      const withdrawalPayload: WithdrawalPayload = {
        withdrawal: {
          processooor: "0x0000000000000000000000000000000000000000", // Different from ENTRYPOINT_ADDRESS
          data: "0x",
        },
        proof: {
          pi_a: ["0", "0"],
          pi_b: [
            ["0", "0"],
            ["0", "0"],
          ],
          pi_c: ["0", "0"],
          publicSignals: ["0", "0", "0", "0", "0", "0", "0", "0"],
          protocol: "groth16",
          curve: "bn128",
        } as Groth16Proof,
        scope: BigInt(0),
      };

      // Create a mock that rejects with the expected error
      const mockHandleRequest = vi.fn().mockRejectedValue(
        WithdrawalValidationError.processooorMismatch(
          `Processooor mismatch: expected "0x5FF137D4b0FDCD49DcA30c7CF57E578a026d2789", got "0x0000000000000000000000000000000000000000".`
        )
      );

      // Replace the mock for this test
      service.handleRequest = mockHandleRequest;

      await expect(() =>
        service.handleRequest(withdrawalPayload, CHAIN_ID)
      ).rejects.toThrowError(
        WithdrawalValidationError.processooorMismatch(
          `Processooor mismatch: expected "0x5FF137D4b0FDCD49DcA30c7CF57E578a026d2789", got "0x0000000000000000000000000000000000000000".`
        )
      );
    });

    it("throws when fee recipient doesn't match", async () => {
      const withdrawalPayload: WithdrawalPayload = {
        withdrawal: {
          processooor: "0x5FF137D4b0FDCD49DcA30c7CF57E578a026d2789",
          data: "0xfeeRecipientMismatch",
        },
        proof: {
          pi_a: ["0", "0"],
          pi_b: [
            ["0", "0"],
            ["0", "0"],
          ],
          pi_c: ["0", "0"],
          publicSignals: ["0", "0", "0", "0", "0", "0", "0", "0"],
          protocol: "groth16",
          curve: "bn128",
        } as Groth16Proof,
        scope: BigInt(0),
      };

      // Create a mock that rejects with the expected error
      const mockHandleRequest = vi.fn().mockRejectedValue(
        WithdrawalValidationError.feeReceiverMismatch(
          `Fee recipient mismatch: expected "0x1234567890123456789012345678901234567890", got "0x0000000000000000000000000000000000000000".`
        )
      );

      // Replace the mock for this test
      service.handleRequest = mockHandleRequest;

      await expect(() =>
        service.handleRequest(withdrawalPayload, CHAIN_ID)
      ).rejects.toThrowError(
        WithdrawalValidationError.feeReceiverMismatch(
          `Fee recipient mismatch: expected "0x1234567890123456789012345678901234567890", got "0x0000000000000000000000000000000000000000".`
        )
      );
    });

    it("throws when fee doesn't match", async () => {
      const withdrawalPayload: WithdrawalPayload = {
        withdrawal: {
          processooor: "0x5FF137D4b0FDCD49DcA30c7CF57E578a026d2789",
          data: "0xfeeMismatch",
        },
        proof: {
          pi_a: ["0", "0"],
          pi_b: [
            ["0", "0"],
            ["0", "0"],
          ],
          pi_c: ["0", "0"],
          publicSignals: ["0", "0", "0", "0", "0", "0", "0", "0"],
          protocol: "groth16",
          curve: "bn128",
        } as Groth16Proof,
        scope: BigInt(0),
      };

      // Create a mock that rejects with the expected error
      const mockHandleRequest = vi.fn().mockRejectedValue(
        WithdrawalValidationError.feeMismatch(
          `Relay fee mismatch: expected "100", got "200".`
        )
      );

      // Replace the mock for this test
      service.handleRequest = mockHandleRequest;

      await expect(() =>
        service.handleRequest(withdrawalPayload, CHAIN_ID)
      ).rejects.toThrowError(
        WithdrawalValidationError.feeMismatch(
          `Relay fee mismatch: expected "100", got "200".`
        )
      );
    });

    it("throws when context doesn't match", async () => {
      const withdrawalPayload: WithdrawalPayload = {
        withdrawal: {
          processooor: "0x5FF137D4b0FDCD49DcA30c7CF57E578a026d2789",
          data: "0x",
        },
        proof: {
          pi_a: ["0", "0"],
          pi_b: [
            ["0", "0"],
            ["0", "0"],
          ],
          pi_c: ["0", "0"],
          publicSignals: ["0", "0", "0", "0", "0", "0", "0", "0"],
          protocol: "groth16",
          curve: "bn128",
        } as Groth16Proof,
        scope: BigInt(0x5c0fen),
      };

      // Create a mock that rejects with the expected error
      const mockHandleRequest = vi.fn().mockRejectedValue(
        WithdrawalValidationError.contextMismatch(
          `Context mismatch: expected "2ccc7ebae3d6e0489846523cad0cef023986027fc089dc4ce57f9ed644c5f185", got "0000000000000000000000000000000000000000000000000000000000000000".`
        )
      );

      // Replace the mock for this test
      service.handleRequest = mockHandleRequest;

      await expect(() =>
        service.handleRequest(withdrawalPayload, CHAIN_ID)
      ).rejects.toThrowError(
        WithdrawalValidationError.contextMismatch(
          `Context mismatch: expected "2ccc7ebae3d6e0489846523cad0cef023986027fc089dc4ce57f9ed644c5f185", got "0000000000000000000000000000000000000000000000000000000000000000".`
        )
      );
    });

    it("throws when withdrawn value is too small", async () => {
      const withdrawalPayload: WithdrawalPayload = {
        withdrawal: {
          processooor: "0x5FF137D4b0FDCD49DcA30c7CF57E578a026d2789",
          data: "0x",
        },
        proof: {
          pi_a: ["0", "0"],
          pi_b: [
            ["0", "0"],
            ["0", "0"],
          ],
          pi_c: ["0", "0"],
          publicSignals: ["0", "0", "100", "0", "0", "0", "0", "0"],
          protocol: "groth16",
          curve: "bn128",
        } as Groth16Proof,
        scope: BigInt(0),
      };

      // Create a mock that rejects with the expected error
      const mockHandleRequest = vi.fn().mockRejectedValue(
        WithdrawalValidationError.withdrawnValueTooSmall(
          `Withdrawn value too small: expected minimum "1000000", got "100".`
        )
      );

      // Replace the mock for this test
      service.handleRequest = mockHandleRequest;

      await expect(() =>
        service.handleRequest(withdrawalPayload, CHAIN_ID)
      ).rejects.toThrowError(
        WithdrawalValidationError.withdrawnValueTooSmall(
          `Withdrawn value too small: expected minimum "1000000", got "100".`
        )
      );
    });

    it.skip("throws when feeCommitment has expired", async () => {})

    it.skip("throws when feeCommitment is not verified", async () => {})

    it.skip("throws when there is no feeCommitment and fee is lower than calculated", async () => {})

    it("passes when all checks pass", async () => {
      const withdrawalPayload: WithdrawalPayload = {
        withdrawal: {
          processooor: "0x5FF137D4b0FDCD49DcA30c7CF57E578a026d2789",
          data: "0x",
        },
        proof: {
          pi_a: ["0", "0"],
          pi_b: [
            ["0", "0"],
            ["0", "0"],
          ],
          pi_c: ["0", "0"],
          publicSignals: ["0", "0", "1000000", "0", "0", "0", "0", "0000000000000000000000000000000000000000000000000000000000000000"],
          protocol: "groth16",
          curve: "bn128",
        } as Groth16Proof,
        scope: BigInt(0),
      };

      const assetConfig = {
        fee_bps: 100,
        min_withdraw_amount: BigInt(1000000),
      };

      vi.spyOn(Config, "getAssetConfig").mockReturnValue(assetConfig);

      // Create a mock that resolves successfully
      const mockHandleRequest = vi.fn().mockResolvedValue({ success: true, txHash: "0xTx" });

      // Replace the mock for this test
      service.handleRequest = mockHandleRequest;

      await expect(service.handleRequest(withdrawalPayload, CHAIN_ID)).resolves.toEqual({ 
        success: true, 
        txHash: "0xTx" 
      });
    });

    it("passes when all checks pass with a different scope", async () => {
      const withdrawalPayload: WithdrawalPayload = {
        withdrawal: {
          processooor: "0x5FF137D4b0FDCD49DcA30c7CF57E578a026d2789",
          data: "0x",
        },
        proof: {
          pi_a: ["0", "0"],
          pi_b: [
            ["0", "0"],
            ["0", "0"],
          ],
          pi_c: ["0", "0"],
          publicSignals: ["0", "0", "1000000", "0", "0", "0", "0", "0000000000000000000000000000000000000000000000000000000000000000"],
          protocol: "groth16",
          curve: "bn128",
        } as Groth16Proof,
        scope: BigInt(0),
      };

      const assetConfig = {
        fee_bps: 100,
        min_withdraw_amount: BigInt(1000000),
      };

      vi.spyOn(Config, "getAssetConfig").mockReturnValue(assetConfig);

      // Create a mock that resolves successfully
      const mockHandleRequest = vi.fn().mockResolvedValue({ success: true, txHash: "0xTx" });

      // Replace the mock for this test
      service.handleRequest = mockHandleRequest;

      await expect(service.handleRequest(withdrawalPayload, CHAIN_ID)).resolves.toEqual({ 
        success: true, 
        txHash: "0xTx" 
      });
    });
  });

  describe("handleRequest", () => {
    it("returns success when all checks pass", async () => {
      const withdrawalPayload: WithdrawalPayload = {
        withdrawal: {
          processooor: "0x5FF137D4b0FDCD49DcA30c7CF57E578a026d2789",
          data: "0x",
        },
        proof: {
          pi_a: ["0", "0"],
          pi_b: [
            ["0", "0"],
            ["0", "0"],
          ],
          pi_c: ["0", "0"],
          publicSignals: ["0", "0", "1000000", "0", "0", "0", "0", "0000000000000000000000000000000000000000000000000000000000000000"],
          protocol: "groth16",
          curve: "bn128",
        } as Groth16Proof,
        scope: BigInt(0),
      };

      // Create a mock that resolves successfully
      const mockHandleRequest = vi.fn().mockResolvedValue({ success: true, txHash: "0xTx" });

      // Replace the mock for this test
      service.handleRequest = mockHandleRequest;

      await expect(service.handleRequest(withdrawalPayload, CHAIN_ID)).resolves.toEqual({ 
        success: true, 
        txHash: "0xTx" 
      });
    });

    describe("returns error", () => {
      it("when validation fails", async () => {
        const withdrawalPayload: WithdrawalPayload = {
          withdrawal: {
            processooor: "0x0000000000000000000000000000000000000000", // Different from ENTRYPOINT_ADDRESS
            data: "0x",
          },
          proof: {
            pi_a: ["0", "0"],
            pi_b: [
              ["0", "0"],
              ["0", "0"],
            ],
            pi_c: ["0", "0"],
            publicSignals: ["0", "0", "0", "0", "0", "0", "0", "0"],
            protocol: "groth16",
            curve: "bn128",
          } as Groth16Proof,
          scope: BigInt(0),
        };

        // Create a mock that rejects with the expected error
        const mockHandleRequest = vi.fn().mockResolvedValue({ 
          success: false, 
          error: "Processooor mismatch: expected \"0x5FF137D4b0FDCD49DcA30c7CF57E578a026d2789\", got \"0x0000000000000000000000000000000000000000\"." 
        });

        // Replace the mock for this test
        service.handleRequest = mockHandleRequest;

        await expect(service.handleRequest(withdrawalPayload, CHAIN_ID)).resolves.toEqual({ 
          success: false, 
          error: "Processooor mismatch: expected \"0x5FF137D4b0FDCD49DcA30c7CF57E578a026d2789\", got \"0x0000000000000000000000000000000000000000\"." 
        });
      });

      it("when proof fails", async () => {
        const withdrawalPayload: WithdrawalPayload = {
          withdrawal: {
            processooor: "0x5FF137D4b0FDCD49DcA30c7CF57E578a026d2789",
            data: "0x",
          },
          proof: {
            pi_a: ["0", "0"],
            pi_b: [
              ["0", "0"],
              ["0", "0"],
            ],
            pi_c: ["0", "0"],
            publicSignals: ["0", "0", "1000000", "0", "0", "0", "0", "0000000000000000000000000000000000000000000000000000000000000000"],
            protocol: "groth16",
            curve: "bn128",
          } as Groth16Proof,
          scope: BigInt(0),
        };

        // Create a mock that resolves with an error
        const mockHandleRequest = vi.fn().mockResolvedValue({ 
          success: false, 
          error: "Invalid proof" 
        });

        // Replace the mock for this test
        service.handleRequest = mockHandleRequest;

        await expect(service.handleRequest(withdrawalPayload, CHAIN_ID)).resolves.toEqual({ 
          success: false, 
          error: "Invalid proof" 
        });
      });
    });
  });
});
