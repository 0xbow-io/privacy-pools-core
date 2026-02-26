import { describe, it, expect, vi, beforeEach } from "vitest";
import { ContractInteractionsService } from "../../src/core/contracts.service.js";
import { Hex, Address, Chain } from "viem";
import { Withdrawal, WithdrawalProof } from "../../src/types/withdrawal.js";
import { CommitmentProof } from "../../src/types/commitment.js";
import { ContractError } from "../../src/errors/base.error.js";
import { Hash } from "../../src/types/commitment.js";

const mockPublicClient = {
  simulateContract: vi.fn(),
  readContract: vi.fn(),
  waitForTransactionReceipt: vi.fn(),
};
const mockWalletClient = {
  writeContract: vi.fn(),
};

// Mock data
const mockRpcUrl = "http://m.1.l.4.d.y:911";
const mockEntrypointAddress: Address =
  "0x1234567890123456789012345678901234567890";
const mockPoolAddress: Address = "0x0987654321098765432109876543210987654321";
const mockChain: Chain = { id: 11155111, name: "Sepolia" } as Chain;
const mockTokenAddress: Address = "0xTokenAddress";
const mockPrivateKey: Hex =
  "0x1111111111111111111111111111111111111111111111111111111111111111";
const mockAmount = BigInt(1000000000000000000);
const mockPrecommitment = BigInt(123456789);
const mockScope = BigInt(
  "0x0555c5fdc167f1f1519c1b21a690de24d9be5ff0bde19447a5f28958d9256e50",
);
const mockAssetAddress: Address = "0xEeeeeEeeeEeEeeEeEeEeeEEEeeeeEeeeeeeeEEeE";
const mockTransactionHash =
  "0x8b52f966d7ec360050ccea1c2c13c4f6b42f826da16c118e43a4ad4950261e91";

// Mock withdrawal and proof
const mockWithdrawal: Withdrawal = {
  processooor: "0xProcessorAddress",
  data: "0xData",
};

const mockWithdrawalProof: WithdrawalProof = {
  proof: {
    pi_a: ["123", "123"],
    pi_b: [
      ["69", "123"],
      ["12", "123"],
    ],
    pi_c: ["12", "828"],
    protocol: "milady",
    curve: "nsa-definitely-non-backdoored-curve-69",
  },
  publicSignals: ["911", "911", "911", "911", "911", "911"],
};

describe("ContractInteractionsService", () => {
  let service: ContractInteractionsService;

  beforeEach(() => {
    vi.restoreAllMocks(); // reset mocks before each test

    service = new ContractInteractionsService(
      mockRpcUrl,
      mockChain,
      mockEntrypointAddress,
      mockPrivateKey,
    );

    // mock the viem clients
    service["publicClient"] = mockPublicClient as any;
    service["walletClient"] = mockWalletClient as any;
  });

  it("should approve ERC20 tokens successfully", async () => {
    mockPublicClient.simulateContract.mockResolvedValue({
      request: "mockRequest",
    });
    mockWalletClient.writeContract.mockResolvedValue(mockTransactionHash);

    const result = await service.approveERC20(
      mockTokenAddress,
      mockTokenAddress,
      mockAmount,
    );

    expect(result.hash).toBe(mockTransactionHash);
    expect(mockPublicClient.simulateContract).toHaveBeenCalled();
    expect(mockWalletClient.writeContract).toHaveBeenCalled();
  });

  it("should fail to approve ERC20 tokens", async () => {
    mockPublicClient.simulateContract.mockRejectedValue(
      new Error("Approval failed"),
    );

    await expect(
      service.approveERC20(mockTokenAddress, mockTokenAddress, mockAmount),
    ).rejects.toThrow("Failed to approve ERC20: Approval failed");
  });

  it("should deposit ERC20 successfully", async () => {
    mockPublicClient.simulateContract.mockResolvedValue({
      request: "mockRequest",
    });
    mockWalletClient.writeContract.mockResolvedValue(mockTransactionHash);

    const result = await service.depositERC20(
      mockTokenAddress,
      mockAmount,
      mockPrecommitment,
    );

    expect(result.hash).toBe(mockTransactionHash);
  });

  it("should fail to deposit ERC20", async () => {
    mockPublicClient.simulateContract.mockRejectedValue(
      new Error("Deposit failed"),
    );

    await expect(
      service.depositERC20(mockTokenAddress, mockAmount, mockPrecommitment),
    ).rejects.toThrow("Failed to deposit ERC20: Deposit failed");
  });

  it("should deposit ETH successfully", async () => {
    mockPublicClient.simulateContract.mockResolvedValue({
      request: "mockRequest",
    });
    mockWalletClient.writeContract.mockResolvedValue(mockTransactionHash);

    const result = await service.depositETH(mockAmount, mockPrecommitment);

    expect(result.hash).toBe(mockTransactionHash);
  });

  it("should fail to deposit ETH", async () => {
    mockPublicClient.simulateContract.mockRejectedValue(
      new Error("ETH deposit failed"),
    );

    await expect(
      service.depositETH(mockAmount, mockPrecommitment),
    ).rejects.toThrow(Error);
  });

  it("should withdraw successfully", async () => {
    // getScopeData mock
    mockPublicClient.readContract
      .mockResolvedValueOnce(mockPoolAddress)
      .mockResolvedValueOnce(mockAssetAddress);

    mockPublicClient.simulateContract.mockResolvedValue({
      request: "mockRequest",
    });
    mockWalletClient.writeContract.mockResolvedValue(mockTransactionHash);

    const result = await service.withdraw(
      mockWithdrawal,
      mockWithdrawalProof,
      BigInt(0) as Hash,
    );

    expect(result.hash).toBe(mockTransactionHash);
  });

  it("should fail to withdraw", async () => {
    // getScopeData mock
    mockPublicClient.readContract
      .mockResolvedValueOnce(mockPoolAddress)
      .mockResolvedValueOnce(mockAssetAddress);

    mockPublicClient.simulateContract.mockRejectedValue(
      new Error("Withdraw failed"),
    );

    await expect(
      service.withdraw(mockWithdrawal, mockWithdrawalProof, BigInt(0) as Hash),
    ).rejects.toThrow(Error);
  });

  it("should execute ragequit successfully", async () => {
    const mockCommitmentProof: CommitmentProof = {
      proof: mockWithdrawalProof.proof,
      publicSignals: mockWithdrawalProof.publicSignals,
    };

    mockPublicClient.simulateContract.mockResolvedValue({
      request: "mockRequest",
    });
    mockWalletClient.writeContract.mockResolvedValue(mockTransactionHash);

    const result = await service.ragequit(mockCommitmentProof, mockPoolAddress);

    expect(result.hash).toBe(mockTransactionHash);
  });

  it("should fail to ragequit", async () => {
    mockPublicClient.simulateContract.mockRejectedValue(
      new Error("Ragequit failed"),
    );

    const mockCommitmentProof: CommitmentProof = {
      proof: mockWithdrawalProof.proof,
      publicSignals: mockWithdrawalProof.publicSignals,
    };

    await expect(
      service.ragequit(mockCommitmentProof, mockPoolAddress),
    ).rejects.toThrow("Failed to Ragequit: Ragequit failed");
  });

  it("should get scope data successfully", async () => {
    mockPublicClient.readContract.mockResolvedValueOnce(mockPoolAddress);
    mockPublicClient.readContract.mockResolvedValueOnce(mockAssetAddress);

    const result = await service.getScopeData(BigInt(mockScope));

    expect(result.poolAddress).toBe(mockPoolAddress);
    expect(result.assetAddress).toBe(mockAssetAddress);
  });

  it("should fail to get scope data when scope is not found", async () => {
    mockPublicClient.readContract.mockResolvedValue(
      "0x0000000000000000000000000000000000000000",
    );

    await expect(service.getScopeData(BigInt(mockScope))).rejects.toThrow(
      ContractError.scopeNotFound(BigInt(mockScope)),
    );
  });
});
