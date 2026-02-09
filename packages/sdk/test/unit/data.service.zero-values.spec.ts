import { beforeEach, describe, expect, it, vi } from "vitest";
import { Address, Hex } from "viem";

import { DataService } from "../../src/core/data.service.js";
import { PoolInfo } from "../../src/types/account.js";
import { ChainConfig } from "../../src/types/events.js";
import { Hash } from "../../src/types/commitment.js";

const CHAIN_ID = 11155111;
const POOL_ADDRESS = "0x1234567890123456789012345678901234567890" as Address;
const TX_HASH = `0x${"1".repeat(64)}` as Hex;

const CONFIG: ChainConfig = {
  chainId: CHAIN_ID,
  privacyPoolAddress: POOL_ADDRESS,
  startBlock: 0n,
  rpcUrl: "http://localhost:8545",
};

const POOL: PoolInfo = {
  chainId: CHAIN_ID,
  address: POOL_ADDRESS,
  scope: 1n as Hash,
  deploymentBlock: 0n,
};

describe("DataService zero-value handling", () => {
  let dataService: DataService;
  let mockClient: { getLogs: ReturnType<typeof vi.fn> };

  beforeEach(() => {
    dataService = new DataService([CONFIG]);
    mockClient = { getLogs: vi.fn() };
    (dataService as any).clients.set(CHAIN_ID, mockClient);
  });

  it("accepts withdrawal events where _value is 0n", async () => {
    mockClient.getLogs.mockResolvedValue([
      {
        args: {
          _value: 0n,
          _spentNullifier: 2n,
          _newCommitment: 3n,
        },
        blockNumber: 10n,
        transactionHash: TX_HASH,
      },
    ]);

    const withdrawals = await dataService.getWithdrawals(POOL);
    const first = withdrawals[0]!;

    expect(withdrawals).toHaveLength(1);
    expect(first.withdrawn).toBe(0n);
    expect(first.spentNullifier).toBe(2n);
    expect(first.newCommitment).toBe(3n);
  });

  it("accepts deposit events with zero-valued bigint fields", async () => {
    mockClient.getLogs.mockResolvedValue([
      {
        args: {
          _depositor: "0xAbCdEf1234567890abcdef1234567890ABCDEF12",
          _commitment: 0n,
          _label: 0n,
          _value: 0n,
          _merkleRoot: 0n,
        },
        blockNumber: 11n,
        transactionHash: TX_HASH,
      },
    ]);

    const deposits = await dataService.getDeposits(POOL);
    const first = deposits[0]!;

    expect(deposits).toHaveLength(1);
    expect(first.depositor).toBe(
      "0xabcdef1234567890abcdef1234567890abcdef12",
    );
    expect(first.commitment).toBe(0n);
    expect(first.label).toBe(0n);
    expect(first.precommitment).toBe(0n);
    expect(first.value).toBe(0n);
  });

  it("accepts ragequit events with zero-valued bigint fields", async () => {
    mockClient.getLogs.mockResolvedValue([
      {
        args: {
          _ragequitter: "0xAbCdEf1234567890abcdef1234567890ABCDEF12",
          _commitment: 0n,
          _label: 0n,
          _value: 0n,
        },
        blockNumber: 12n,
        transactionHash: TX_HASH,
      },
    ]);

    const ragequits = await dataService.getRagequits(POOL);
    const first = ragequits[0]!;

    expect(ragequits).toHaveLength(1);
    expect(first.ragequitter).toBe(
      "0xabcdef1234567890abcdef1234567890abcdef12",
    );
    expect(first.commitment).toBe(0n);
    expect(first.label).toBe(0n);
    expect(first.value).toBe(0n);
  });
});
