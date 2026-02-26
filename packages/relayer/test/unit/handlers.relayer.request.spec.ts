import { describe, expect, it, vi, beforeEach } from "vitest";

vi.mock("../../src/services/privacyPoolRelayer.service.js");
vi.mock("../../src/providers/web3.provider.js");

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
          max_gas_price: "5",
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
    getChainConfig: vi.fn().mockReturnValue({
      chain_id: 31337,
      chain_name: "localhost",
      rpc_url: "http://localhost:8545",
      max_gas_price: "5",
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

import { relayRequestHandler } from "../../src/handlers/index.js";
import { ConfigError, ValidationError, ErrorCode } from "../../src/exceptions/base.exception.js";
import { privacyPoolRelayer } from "../../src/services/index.js";
import { web3Provider } from "../../src/providers/index.js";

const withdrawalPayload = {
  withdrawal: {
    processooor: "0x5FF137D4b0FDCD49DcA30c7CF57E578a026d2789",
    data: "0xfeeMismatch",
  },
  proof: {
    pi_a: ["0", "0", "0"],
    pi_b: [
      ["0", "0"],
      ["0", "0"],
      ["0", "0"],
    ],
    pi_c: ["0", "0", "0"],
    protocol: "groth16",
    curve: "bn128",
  },
  publicSignals: ["0", "0", "0", "0", "0", "0", "0", "0"],
  chainId: 31337,
  scope: "0",
};

function newResMock() {
  const obj = vi.fn();
  const attrs = {
    status: vi.fn(() => newResMock()),
    json: vi.fn(() => newResMock()),
    locals: {
      marshalResponse: vi.fn(() => newResMock()),
    }
  };
  return Object.assign(obj, attrs);
}

describe("relayRequestHandler", () => {

  let resMock = newResMock();
  let nextMock= vi.fn();

  afterEach(() => {
    vi.clearAllMocks();
  })

  beforeEach(() => {
    resMock = newResMock();
    nextMock = vi.fn();
  });

  it("empty body raises validation error", async () => {
    const req = { body: {} };
    await relayRequestHandler(req, resMock, nextMock);
    expect(nextMock.mock.calls[0][0]).toBeInstanceOf(ValidationError)
  });

  it("gas price below max is ok", async () => {
    const req = { body: { ...withdrawalPayload } };
    vi.spyOn(web3Provider, "getGasPrice").mockResolvedValue(2n);  // max_gas_price == 5
    vi.spyOn(privacyPoolRelayer, "handleRequest").mockResolvedValue(undefined);
    await relayRequestHandler(req, resMock, nextMock);
    expect(nextMock.mock.calls[0][0]).toEqual(undefined)
    expect(resMock.status.mock.calls[0][0]).toEqual(200)
  });

  it("gas price above max is rejected", async () => {
    const req = { body: { ...withdrawalPayload } };
    vi.spyOn(web3Provider, "getGasPrice").mockResolvedValue(10n);  // max_gas_price == 5
    vi.spyOn(privacyPoolRelayer, "handleRequest").mockResolvedValue(undefined);
    await relayRequestHandler(req, resMock, nextMock);
    const error = nextMock.mock.calls[0][0]
    console.log(error)
    expect(error).toBeInstanceOf(ConfigError)
    expect(error.code).toEqual(ErrorCode.MAX_GAS_PRICE);
  });

});
