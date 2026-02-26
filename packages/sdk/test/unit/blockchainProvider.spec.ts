import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { BlockchainProvider, InvalidRpcUrl } from "../../src/internal.js";

const mockClient = {
  getBalance: vi.fn(),
};

vi.mock("viem", async (importOriginal) => {
  const actual = await importOriginal<typeof import("viem")>();
  return {
    ...actual,
    createPublicClient: vi.fn().mockImplementation(() => mockClient),
    http: vi.fn(),
  };
});

describe("BlockchainProvider", () => {
  let blockchainProvider: BlockchainProvider;

  beforeEach(() => {
    blockchainProvider = new BlockchainProvider("http://example.com/rpc");
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  describe("constructor", () => {
    it("creates a client with the specified rpcUrl", () => {
      const provider = new BlockchainProvider("http://example.com/rpc");
      expect(provider).toBeDefined();
      expect(provider["client"]).toBeDefined();
    });

    it("throws an error for an invalid rpcUrl", () => {
      expect(() => new BlockchainProvider("invalid-url")).toThrow(
        InvalidRpcUrl,
      );
    });
  });

  describe("getBalance", () => {
    it("returns the balance for a valid address", async () => {
      const address = "0x1234567890abcdef";
      const expectedBalance = BigInt(1000000000000000000);
      vi.spyOn(mockClient, "getBalance").mockResolvedValue(expectedBalance);

      const result = await blockchainProvider.getBalance(address);

      expect(result).toEqual(expectedBalance);
    });
  });
});
