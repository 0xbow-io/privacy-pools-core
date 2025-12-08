import { describe, expect, it } from "vitest";
import { validateBatchRelayQuoteBody } from "../../src/schemes/relayer/batchQuote.scheme.js";

describe.skip("validateBatchRelayQuoteBody", () => {
  
  it("should validate a correct batch relay quote request", () => {
    const validData = {
      batchSize: 5,
      totalAmount: "1000000000000000000",
      chainId: 1,
      recipient: "0x1234567890123456789012345678901234567890",
      feeCommitment: {
        expiration: 1234567890,
        withdrawalData: "0xabcdef",
        signedRelayerCommitment: "0x123456"
      }
    };

    const result = validateBatchRelayQuoteBody(validData);
    expect(result.success).toBe(true);
    expect(result.errors).toBeUndefined();
  });

  it("should reject batch relay quote with missing required fields", () => {
    const invalidData = {
      batchSize: 5,
      totalAmount: "1000000000000000000"
      // missing chainId
    };

    const result = validateBatchRelayQuoteBody(invalidData);
    expect(result.success).toBe(false);
    expect(result.errors).toBeDefined();
    expect(result.errors?.[0]?.message).toContain("chainId");
  });

  it("should reject batch relay quote with invalid batchSize type", () => {
    const invalidData = {
      batchSize: "not-a-number",
      totalAmount: "1000000000000000000",
      chainId: 1
    };

    const result = validateBatchRelayQuoteBody(invalidData);
    expect(result.success).toBe(false);
    expect(result.errors).toBeDefined();
    expect(result.errors?.[0]?.message).toContain("batchSize");
  });

  it("should accept batch relay quote without optional fields", () => {
    const validData = {
      batchSize: 3,
      totalAmount: "500000000000000000",
      chainId: 1
      // no recipient or feeCommitment
    };

    const result = validateBatchRelayQuoteBody(validData);
    expect(result.success).toBe(true);
    expect(result.errors).toBeUndefined();
  });

  it("should accept chainId as string or number", () => {
    const validDataWithStringChainId = {
      batchSize: 2,
      totalAmount: "250000000000000000",
      chainId: "1"
    };

    const result = validateBatchRelayQuoteBody(validDataWithStringChainId);
    expect(result.success).toBe(true);
    expect(result.errors).toBeUndefined();
  });

  it("should reject invalid feeCommitment structure", () => {
    const invalidData = {
      batchSize: 4,
      totalAmount: "750000000000000000",
      chainId: 1,
      feeCommitment: {
        expiration: 1234567890,
        withdrawalData: "0xabcdef"
        // missing signedRelayerCommitment
      }
    };

    const result = validateBatchRelayQuoteBody(invalidData);
    expect(result.success).toBe(false);
    expect(result.errors).toBeDefined();
    expect(result.errors?.[0]?.message).toContain("signedRelayerCommitment");
  });

  it("should return multiple error messages for multiple validation failures", () => {
    const invalidData = {
      batchSize: "invalid",
      totalAmount: 123, // should be string
      // missing chainId
    };

    const result = validateBatchRelayQuoteBody(invalidData);
    expect(result.success).toBe(false);
    expect(result.errors).toBeDefined();
    expect(result.errors?.length).toBeGreaterThan(1);
  });

  it("should accept optional recipient field", () => {
    const validData = {
      batchSize: 1,
      totalAmount: "100000000000000000",
      chainId: 1,
      recipient: "0x9876543210987654321098765432109876543210"
    };

    const result = validateBatchRelayQuoteBody(validData);
    expect(result.success).toBe(true);
    expect(result.errors).toBeUndefined();
  });
});
