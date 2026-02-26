import { Address } from "viem";
import { Withdrawal, WithdrawalProof } from "../types/withdrawal.js";
import { CommitmentProof, Hash } from "../types/commitment.js";

export interface SolidityGroth16Proof {
  pA: [bigint, bigint];
  pB: [[bigint, bigint], [bigint, bigint]];
  pC: [bigint, bigint];
  pubSignals: bigint[];
}

export interface AssetConfig {
  pool: Address,
  minimumDepositAmount: bigint,
  vettingFeeBPS: bigint,
  maxRelayFeeBPS: bigint
}

export interface TransactionResponse {
  hash: string;
  wait: () => Promise<void>;
}

export interface ContractInteractions {
  depositERC20(
    asset: Address,
    amount: bigint,
    precommitment: bigint,
  ): Promise<TransactionResponse>;

  depositETH(
    amount: bigint,
    precommitment: bigint,
  ): Promise<TransactionResponse>;

  withdraw(
    withdrawal: Withdrawal,
    withdrawalProof: WithdrawalProof,
    scope: Hash,
  ): Promise<TransactionResponse>;

  relay(
    withdrawal: Withdrawal,
    withdrawalProof: WithdrawalProof,
    scope: Hash,
  ): Promise<TransactionResponse>;

  ragequit(
    commitmentProof: CommitmentProof,
    privacyPoolAddress: Address,
  ): Promise<TransactionResponse>;

  getScope(privacyPoolAddress: Address): Promise<bigint>;
  getStateRoot(privacyPoolAddress: Address): Promise<bigint>;
  getStateSize(privacyPoolAddress: Address): Promise<bigint>;
  getAssetConfig(assetAddress: Address): Promise<AssetConfig>;
  getScopeData(
    scope: bigint,
  ): Promise<{ poolAddress: Address | null; assetAddress: Address | null }>;

  approveERC20(
    spenderAddress: Address,
    tokenAddress: Address,
    amount: bigint,
  ): Promise<TransactionResponse>;
}
