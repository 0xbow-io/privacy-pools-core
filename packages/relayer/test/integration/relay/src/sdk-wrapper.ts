import {
  bigintToHash,
  calculateContext,
  Circuits,
  ContractInteractionsService,
  generateDepositSecrets,
  generateMasterKeys,
  generateMerkleProof,
  getCommitment,
  Hash,
  hashPrecommitment,
  LeanIMTMerkleProof,
  MasterKeys,
  PrivacyPoolSDK,
  Secret,
  Withdrawal,
  WithdrawalProof,
  WithdrawalProofInput
} from "@0xbow/privacy-pools-core-sdk";

import { IChainContext } from "./chain.js";
import {
  ENTRYPOINT_ADDRESS,
  PRIVATE_KEY
} from "./constants.js";

type Note = { nullifier: bigint, secret: bigint; };

/*
  TestToken deployed at: 0x9fE46736679d2D9a65F0992F2272dE9f3c7fa6e0
  Withdrawal Verifier deployed at: 0xCf7Ed3AccA5a467e9e704C703E8D87F634fB0Fc9
  Ragequit Verifier deployed at: 0xDc64a140Aa3E981100a9becA4E685f962f0cF6C9
  Entrypoint deployed at: 0x0165878A594ca255338adfa4d48449f69242Eb8F
  ETH Pool deployed at: 0xa513E6E4b8f2a923D98304ec87F64353C4D5C853
  TST Pool deployed at: 0x8A791620dd6260079BF849Dc5567aDC3F2FdC318
*/

export class SdkWrapper {

  chainContext: IChainContext;
  sdk: PrivacyPoolSDK;
  contracts: ContractInteractionsService;
  mnemonic: string;
  masterKeys: MasterKeys;

  constructor(chainContext: IChainContext) {
    this.chainContext = chainContext;
    this.sdk = new PrivacyPoolSDK(new Circuits({ browser: false }));
    this.contracts = this.sdk.createContractInstance(
      this.chainContext.client.transport.url,
      this.chainContext.chain,
      ENTRYPOINT_ADDRESS,
      PRIVATE_KEY,
    );
    this.mnemonic = "muscle horse fly praise focus mixed annual disorder false black bottom uncover";
    this.masterKeys = generateMasterKeys(this.mnemonic);

  }

  depositSecret(scope: bigint, index: bigint) {
    return generateDepositSecrets(this.masterKeys, scope as Hash, index);
  }

  withdrawSecret(label: bigint, index: bigint) {
    return generateDepositSecrets(this.masterKeys, label as Hash, index);
  }

  async findLabelFromDepositNote(asset: `0x${string}`, note: { nullifier: bigint; secret: bigint; }): Promise<bigint> {
    const pool = await this.chainContext.getPoolContract(asset);
    const depositEvents = await pool.getEvents.Deposited(undefined, { fromBlock: (await this.chainContext.client.getBlockNumber()) - 50n });
    const preCommitment = hashPrecommitment(note.nullifier as Secret, note.secret as Secret);
    const event = depositEvents.filter(de => de.args._precommitmentHash === preCommitment).pop();
    if (event && event?.args?._label !== undefined) {
      return event.args._label;
    } else {
      throw Error("Can't find matching label");
    }
  }

  async deposit(accNonce: bigint, amount: bigint) {

    const pool = await this.chainContext.getPoolContract("0xEeeeeEeeeEeEeeEeEeEeeEEEeeeeEeeeeeeeEEeE");
    const scope = await pool.read.SCOPE() as Hash;

    const { secret, nullifier } = this.depositSecret(scope, accNonce);

    const precommitment = {
      hash: hashPrecommitment(nullifier!, secret!),
      nullifier: secret,
      secret: nullifier,
    };

    const tx = await this.contracts.depositETH(amount, precommitment.hash);
    await tx.wait();
    const depositEvents = await pool.getEvents.Deposited({ _depositor: this.chainContext.account.address });
    depositEvents.forEach(e => {
      console.log("Deposited<", {
        ...e.args,
        blockNumber: e.blockNumber,
        blockHash: e.blockHash
      }, ">");
    });
    return tx;
  }

  async depositAsset(accNonce: bigint, amount: bigint, assetAddress: `0x${string}`) {

    const pool = await this.chainContext.getPoolContract(assetAddress);
    const scope = await pool.read.SCOPE() as Hash;

    const { secret, nullifier } = this.depositSecret(scope, accNonce);

    const precommitment = {
      hash: hashPrecommitment(nullifier!, secret!),
      nullifier: secret,
      secret: nullifier,
    };

    const erc20 = this.chainContext.getErc20Contract(assetAddress);
    await erc20.write.approve([ENTRYPOINT_ADDRESS, 2n ** 256n - 1n], {
      account: this.chainContext.account,
      chain: this.chainContext.chain
    });
    const tx = await this.contracts.depositERC20(assetAddress, amount, precommitment.hash);
    await tx.wait();
    const depositEvents = await pool.getEvents.Deposited({ _depositor: this.chainContext.account.address });
    depositEvents.forEach(e => {
      console.log("Deposited<", {
        ...e.args,
        blockNumber: e.blockNumber,
        blockHash: e.blockHash
      }, ">");
    });
    return tx;
  }

  async proveWithdrawal(
    withdrawAmount: bigint,
    w: Withdrawal,
    scope: bigint,
    label: bigint,
    oldNoteValue: bigint,
    oldNote: Note,
    newNote: Note,
    leaves: {
      index: bigint;
      leaf: bigint;
      root: bigint;
      block: bigint;
    }[]
  ): Promise<WithdrawalProof> {

    try {
      console.log("🚀 Initializing PrivacyPoolSDK...");

      // **Retrieve On-Chain Scope**
      console.log(
        "🔹 Retrieved Scope from Withdrawal:",
        `0x${scope.toString(16)}`,
      );

      const pool = this.chainContext.getPoolContractByScope(scope);

      // **Load Valid Input Values**
      const stateTreeDepth = await pool.read.currentTreeDepth();
      // pool.read.currentTreeSize();
      const stateRoot = await pool.read.currentRoot();

      // const stateRoot = BigInt(
      //   "11647068014638404411083963959916324311405860401109309104995569418439086324505",
      // );
      // const stateTreeDepth = BigInt("2");

      const { secret: existingSecret, nullifier: existingNullifier } = oldNote;
      const { secret: newSecret, nullifier: newNullifier } = newNote;

      console.log("🛠️ Generating commitments...");

      const commitment = getCommitment(
        oldNoteValue,
        label,
        existingNullifier as Secret,
        existingSecret as Secret,
      );

      const sortedLeaves = leaves.sort((a, b) => Number(a.index - b.index)).map(x => x.leaf);

      // **State Merkle Proof**
      const stateMerkleProof: LeanIMTMerkleProof = generateMerkleProof(sortedLeaves, commitment.hash);
      stateMerkleProof.index = Number.isNaN(stateMerkleProof.index) ? 0 : stateMerkleProof.index;
      if (stateMerkleProof.siblings.length < 32) {
        const N = 32 - stateMerkleProof.siblings.length;
        const siblings = [...stateMerkleProof.siblings, ...Array(N).fill(0n)];
        stateMerkleProof.siblings = siblings;
      }
      stateMerkleProof.siblings = stateMerkleProof.siblings.length === 0 ? [stateRoot, ...Array(31).fill(0n)] : stateMerkleProof.siblings;
      console.log(stateMerkleProof);

      // const stateMerkleProof: LeanIMTMerkleProof = {
      //   root: stateRoot,
      //   leaf: commitment.hash,
      //   index: 3,
      //   siblings: [
      //     BigInt("6398878698952029"),
      //     BigInt(
      //       "13585012987205807684735841540436202984635744455909835202346884556845854938903",
      //     ),
      //     ...Array(30).fill(BigInt(0)),
      //   ],
      // };

      // const aspRoot = BigInt(
      //   "17509119559942543382744731935952318540675152427220720285867932301410542597330",
      // );
      // const aspTreeDepth = BigInt("2");

      const firstSib = 1n;
      const aspRoot = hashPrecommitment(label as Secret, firstSib as Secret);
      const aspTreeDepth = 2n;
      // **ASP Merkle Proof**
      const aspMerkleProof: LeanIMTMerkleProof = {
        root: aspRoot,
        leaf: label,
        index: 0,
        siblings: [
          firstSib,
          ...Array(31).fill(BigInt(0)),
          // BigInt("3189334085279373"),
          // BigInt(
          //   "1131383056830993841196498111009024161908281953428245130508088856824218714105",
          // ),
          // ...Array(30).fill(BigInt(0)),
        ],
      };

      // console.log("✅ State Merkle Proof:", stateMerkleProof);
      // console.log("✅ ASP Merkle Proof:", aspMerkleProof);

      // **Correctly Compute Context Hash**
      const computedContext = calculateContext(w, scope as Hash);
      console.log("🔹 Computed Context:", computedContext.toString());

      // **Create Withdrawal Proof Input**
      const proofInput: WithdrawalProofInput = {
        context: BigInt(computedContext),
        withdrawalAmount: withdrawAmount,
        stateMerkleProof: stateMerkleProof,
        aspMerkleProof: aspMerkleProof,
        stateRoot: bigintToHash(stateRoot),
        stateTreeDepth: stateTreeDepth,
        aspRoot: bigintToHash(aspRoot),
        aspTreeDepth: aspTreeDepth,
        newSecret: newSecret as Secret,
        newNullifier: newNullifier as Secret,
      };

      console.log("🚀 Generating withdrawal proof...");
      const proofPayload: WithdrawalProof = await this.sdk.proveWithdrawal(
        commitment,
        proofInput,
      );

      console.log(proofPayload)
      return proofPayload;

    } catch (error) {
      console.error("❌ **Error running testWithdraw script**:", error);
      process.exit(1);
    }
  }

}
