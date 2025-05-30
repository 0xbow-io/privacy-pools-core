import {
  bigintToHash,
  calculateContext,
  Circuits,
  ContractInteractionsService,
  getCommitment,
  Hash,
  hashPrecommitment,
  LeanIMTMerkleProof,
  PrivacyPoolSDK,
  Secret,
  Withdrawal,
  WithdrawalProof,
  WithdrawalProofInput,
} from "@0xbow/privacy-pools-core-sdk";
import { ChainContext, IChainContext } from "./chain.js";
import {
  ENTRYPOINT_ADDRESS,
  PRIVATE_KEY
} from "./constants.js";

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

  constructor(chainContext: IChainContext) {
    this.chainContext = chainContext;
    this.sdk = new PrivacyPoolSDK(new Circuits());
    this.contracts = this.sdk.createContractInstance(
      this.chainContext.client.transport.url,
      this.chainContext.chain,
      ENTRYPOINT_ADDRESS,
      PRIVATE_KEY,
    );

  }

  async deposit(note: string, amount: bigint) {
    const [secret, nullifier] = note.split(":").map(BigInt) as Secret[];
    if (secret === undefined || nullifier === undefined)
      throw Error(`Malformed note: ${note}`);

    const precommitment = {
      hash: hashPrecommitment(nullifier!, secret!),
      nullifier: secret,
      secret: nullifier,
    };
    return this.contracts.depositETH(amount, precommitment.hash);
  }

  async depositAsset(note: string, amount: bigint, assetAddress: `0x${string}`) {

    const [secret, nullifier] = note.split(":").map(BigInt) as Secret[];
    if (secret === undefined || nullifier === undefined)
      throw Error(`Malformed note: ${note}`);

    const precommitment = {
      hash: hashPrecommitment(nullifier!, secret!),
      nullifier: secret,
      secret: nullifier,
    };

    const erc20 = this.chainContext.getErc20Contract(assetAddress);
    const txApproval = await erc20.write.approve([ENTRYPOINT_ADDRESS, 2n ** 256n - 1n], {
      account: this.chainContext.account,
      chain: this.chainContext.chain
    });
    return this.contracts.depositERC20(assetAddress, amount, precommitment.hash);
  }

  async proveWithdrawal(
    withdrawnValue: bigint,
    w: Withdrawal,
    scope: bigint,
    oldNote: string,
    newNote: string,
  ): Promise<WithdrawalProof> {
    try {
      console.log("🚀 Initializing PrivacyPoolSDK...");

      // **Retrieve On-Chain Scope**
      console.log(
        "🔹 Retrieved Scope from Withdrawal:",
        `0x${scope.toString(16)}`,
      );

      // **Load Valid Input Values**
      // const withdrawnValue = BigInt("100000000000000000"); // 0.1 eth
      const stateRoot = BigInt(
        "11647068014638404411083963959916324311405860401109309104995569418439086324505",
      );
      const stateTreeDepth = BigInt("2");
      const aspRoot = BigInt(
        "17509119559942543382744731935952318540675152427220720285867932301410542597330",
      );
      const aspTreeDepth = BigInt("2");
      const label = BigInt("2310129299332319");

      // **Commitment Data**
      const existingValue = BigInt("5000000000000000000");
      // const existingValue = BigInt("297000000");

      const [existingSecret, existingNullifier] = oldNote.split(":").map(BigInt) as Secret[];
      if (existingSecret === undefined || existingNullifier === undefined)
        throw Error(`Malformed note: ${oldNote}`);

      const [newSecret, newNullifier] = newNote.split(":").map(BigInt) as Secret[];
      if (newSecret === undefined || newNullifier === undefined)
        throw Error(`Malformed note: ${newNote}`);

      console.log("🛠️ Generating commitments...");

      const commitment = getCommitment(
        existingValue,
        label,
        existingNullifier!,
        existingSecret!,
      );

      // **State Merkle Proof**
      const stateMerkleProof: LeanIMTMerkleProof = {
        root: stateRoot,
        leaf: commitment.hash,
        index: 3,
        siblings: [
          BigInt("6398878698952029"),
          BigInt(
            "13585012987205807684735841540436202984635744455909835202346884556845854938903",
          ),
          ...Array(30).fill(BigInt(0)),
        ],
      };

      // **ASP Merkle Proof**
      const aspMerkleProof: LeanIMTMerkleProof = {
        root: aspRoot,
        leaf: label,
        index: 3,
        siblings: [
          BigInt("3189334085279373"),
          BigInt(
            "1131383056830993841196498111009024161908281953428245130508088856824218714105",
          ),
          ...Array(30).fill(BigInt(0)),
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
        withdrawalAmount: withdrawnValue,
        stateMerkleProof: stateMerkleProof,
        aspMerkleProof: aspMerkleProof,
        stateRoot: bigintToHash(stateRoot),
        stateTreeDepth: stateTreeDepth,
        aspRoot: bigintToHash(aspRoot),
        aspTreeDepth: aspTreeDepth,
        newSecret: newSecret,
        newNullifier: newNullifier,
      };

      console.log("🚀 Generating withdrawal proof...");
      const proofPayload: WithdrawalProof = await this.sdk.proveWithdrawal(
        commitment,
        proofInput,
      );

      return proofPayload;

      // if (!proofPayload) {
      //     throw new Error("❌ Withdrawal proof generation failed: proofPayload is null or undefined");
      // }

      // console.log("✅ Proof Payload:", proofPayload);

      // console.log("🚀 Sending withdrawal transaction...");
      // const withdrawalTx = await sdk.getContractInteractions().withdraw(withdrawObj, proofPayload);

      // console.log("✅ Withdrawal transaction sent:", withdrawalTx?.hash ?? "❌ No transaction hash returned");

      // if (!withdrawalTx?.hash) {
      //     throw new Error("❌ Withdrawal transaction failed: No transaction hash returned.");
      // }

      // await withdrawalTx.wait();
      // console.log("🎉 Withdrawal transaction confirmed!");
    } catch (error) {
      console.error("❌ **Error running testWithdraw script**:", error);
      process.exit(1);
    }
  }

}
