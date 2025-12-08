import { describe, expect, it } from "vitest";
import { validateBatchRelayRequestBody } from "../../src/schemes/relayer/batchRequest.scheme.js";

describe.skip("validateBatchRelayRequestBody", () => {
  
  it("should validate a correct batch relay request", () => {
    const validData = {
      withdrawal: {
        processooor: "0x1234567890123456789012345678901234567890",
        data: "0xabcdef"
      },
      proofs: [{
        publicSignals: ["1", "2", "3"],
        proof: {
          pi_a: ["1", "2"],
          pi_b: [["1", "2"], ["3", "4"]], 
          pi_c: ["5", "6"]
        }
      }],
      poolAddress: "0x4567890123456789012345678901234567890123",
      chainId: 1,
      feeCommitment: {
        expiration: 1234567890,
        withdrawalData: "0xabcdef123456",
        signedRelayerCommitment: "0x123456789abcdef"
      }
    };

    const result = validateBatchRelayRequestBody(validData);
    expect(result.success).toBe(true);
    expect(result.errors).toBeUndefined();
  });

  it("should reject batch relay request with missing withdrawal data", () => {
    const invalidData = {
      withdrawal: {
        processooor: "0x1234567890123456789012345678901234567890"
        // missing data
      },
      proofs: [{
        publicSignals: ["1", "2", "3"],
        proof: {
          pi_a: ["1", "2"],
          pi_b: [["1", "2"], ["3", "4"]], 
          pi_c: ["5", "6"]
        }
      }],
      poolAddress: "0x4567890123456789012345678901234567890123",
      chainId: 1
    };

    const result = validateBatchRelayRequestBody(invalidData);
    expect(result.success).toBe(false);
    expect(result.errors).toBeDefined();
  });

  it("should reject batch relay request with empty proofs array", () => {
    const invalidData = {
      withdrawal: {
        processooor: "0x1234567890123456789012345678901234567890",
        data: "0xabcdef"
      },
      proofs: [], // empty array
      poolAddress: "0x4567890123456789012345678901234567890123",
      chainId: 1
    };

    const result = validateBatchRelayRequestBody(invalidData);
    expect(result.success).toBe(false);
    expect(result.errors).toBeDefined();
  });

  it("should reject batch relay request with invalid proof structure", () => {
    const invalidData = {
      withdrawal: {
        processooor: "0x1234567890123456789012345678901234567890",
        data: "0xabcdef"
      },
      proofs: [{
        publicSignals: ["1", "2", "3"],
        proof: {
          pi_a: ["1"], // should be length 2
          pi_b: [["1", "2"], ["3", "4"]], 
          pi_c: ["5", "6"]
        }
      }],
      poolAddress: "0x4567890123456789012345678901234567890123",
      chainId: 1
    };

    const result = validateBatchRelayRequestBody(invalidData);
    expect(result.success).toBe(false);
    expect(result.errors).toBeDefined();
  });

  it("should accept batch relay request without optional feeCommitment", () => {
    const validData = {
      withdrawal: {
        processooor: "0x1234567890123456789012345678901234567890",
        data: "0xabcdef"
      },
      proofs: [{
        publicSignals: ["1", "2", "3"],
        proof: {
          pi_a: ["1", "2"],
          pi_b: [["1", "2"], ["3", "4"]], 
          pi_c: ["5", "6"]
        }
      }],
      poolAddress: "0x4567890123456789012345678901234567890123",
      chainId: 1
      // no feeCommitment
    };

    const result = validateBatchRelayRequestBody(validData);
    expect(result.success).toBe(true);
    expect(result.errors).toBeUndefined();
  });

  it("should accept chainId as string or number", () => {
    const validDataWithStringChainId = {
      withdrawal: {
        processooor: "0x1234567890123456789012345678901234567890",
        data: "0xabcdef"
      },
      proofs: [{
        publicSignals: ["1", "2", "3"],
        proof: {
          pi_a: ["1", "2"],
          pi_b: [["1", "2"], ["3", "4"]], 
          pi_c: ["5", "6"]
        }
      }],
      poolAddress: "0x4567890123456789012345678901234567890123",
      chainId: "1"
    };

    const result = validateBatchRelayRequestBody(validDataWithStringChainId);
    expect(result.success).toBe(true);
    expect(result.errors).toBeUndefined();
  });

  it("should enforce maximum batch size of 255", () => {
    const proofs = Array(256).fill({
      publicSignals: ["1", "2", "3"],
      proof: {
        pi_a: ["1", "2"],
        pi_b: [["1", "2"], ["3", "4"]], 
        pi_c: ["5", "6"]
      }
    });

    const invalidData = {
      withdrawal: {
        processooor: "0x1234567890123456789012345678901234567890",
        data: "0xabcdef"
      },
      proofs,
      poolAddress: "0x4567890123456789012345678901234567890123",
      chainId: 1
    };

    const result = validateBatchRelayRequestBody(invalidData);
    expect(result.success).toBe(false);
    expect(result.errors).toBeDefined();
  });
});
