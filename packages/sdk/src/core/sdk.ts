import { CommitmentService } from "./commitment.service.js";
import { WithdrawalService } from "./withdrawal.service.js";
import { CircuitsInterface } from "../interfaces/circuits.interface.js";
import { Commitment, CommitmentProof } from "../types/commitment.js";
import { WithdrawalProof, WithdrawalProofInput } from "../types/withdrawal.js";
import { ContractInteractionsService } from "./contracts.service.js";
import { Hex, Address, Chain } from "viem";
import { AccountCommitment } from "../types/account.js";

/**
 * Main SDK class providing access to all privacy pool functionality.
 * Uses Poseidon hash for all commitment operations.
 */
export class PrivacyPoolSDK {
  private readonly commitmentService: CommitmentService;
  private readonly withdrawalService: WithdrawalService;

  constructor(circuits: CircuitsInterface) {
    this.commitmentService = new CommitmentService(circuits);
    this.withdrawalService = new WithdrawalService(circuits);
  }

  public createContractInstance(
    rpcUrl: string,
    chain: Chain,
    entrypointAddress: Address,
    privateKey: Hex,
  ): ContractInteractionsService {
    return new ContractInteractionsService(
      rpcUrl,
      chain,
      entrypointAddress,
      privateKey,
    );
  }

  /**
   * Generates a commitment proof.
   *
   * @param value - Value to commit
   * @param label - Label for the commitment
   * @param nullifier - Nullifier for the commitment
   * @param secret - Secret for the commitment
   */
  public async proveCommitment(
    value: bigint,
    label: bigint,
    nullifier: bigint,
    secret: bigint,
  ): Promise<CommitmentProof> {
    return this.commitmentService.proveCommitment(
      value,
      label,
      nullifier,
      secret,
    );
  }

  /**
   * Verifies a commitment proof.
   *
   * @param proof - The proof to verify
   */
  public async verifyCommitment(proof: CommitmentProof): Promise<boolean> {
    return this.commitmentService.verifyCommitment(proof);
  }

  /**
   * Generates a withdrawal proof.
   *
   * @param commitment - Commitment to withdraw
   * @param input - Input parameters for the withdrawal
   * @param withdrawal - Withdrawal details
   */
  public async proveWithdrawal(
    commitment: Commitment | AccountCommitment ,
    input: WithdrawalProofInput,
  ): Promise<WithdrawalProof> {
    return await this.withdrawalService.proveWithdrawal(commitment, input);
  }

  /**
   * Verifies a withdrawal proof.
   *
   * @param withdrawalProof - The withdrawal payload to verify
   */
  public async verifyWithdrawal(
    withdrawalProof: WithdrawalProof,
  ): Promise<boolean> {
    return this.withdrawalService.verifyWithdrawal(withdrawalProof);
  }
}
