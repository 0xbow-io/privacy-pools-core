import {
  bigintToHash,
  calculateContext,
  Circuits,
  getCommitment,
  hashPrecommitment,
  LeanIMTMerkleProof,
  PrivacyPoolSDK,
  Secret,
  Withdrawal,
  WithdrawalProof,
  WithdrawalProofInput,
} from "@0xbow/privacy-pools-core-sdk";
import { Address, defineChain, Hex } from "viem";
import { localhost } from "viem/chains";

/*
TestToken deployed at: 0xCf7Ed3AccA5a467e9e704C703E8D87F634fB0Fc9
Withdrawal Verifier deployed at: 0xDc64a140Aa3E981100a9becA4E685f962f0cF6C9
Ragequit Verifier deployed at: 0x5FC8d32690cc91D4c39d9d3abcBD16989F875707
Entrypoint deployed at: 0xa513E6E4b8f2a923D98304ec87F64353C4D5C853
ETH Pool deployed at: 0x2279B7A0a67DB372996a5FaB50D91eAA73d2eBe6
TST Pool deployed at: 0x610178dA211FEF7D417bC0e6FeD39F05609AD788
*/

const LOCAL_ANVIL_RPC = "http://127.0.0.1:8545";
const ENTRYPOINT_ADDRESS: Address =
  "0xa513E6E4b8f2a923D98304ec87F64353C4D5C853";
// const PRIVACY_POOL_ADDRESS: Address = "0x2279B7A0a67DB372996a5FaB50D91eAA73d2eBe6";
const PRIVATE_KEY: Hex =
  "0xac0974bec39a17e36ba4a6b4d238ff944bacb478cbed5efcae784d7bf4f2ff80";

const anvilChain = defineChain({ ...localhost, id: 31337 });

const sdk = new PrivacyPoolSDK(new Circuits());

const contracts = sdk.createContractInstance(
  LOCAL_ANVIL_RPC,
  anvilChain,
  ENTRYPOINT_ADDRESS,
  PRIVATE_KEY,
);

export async function deposit() {
  const existingValue = BigInt("5000000000000000000"); // 5 eth
  const existingNullifier = BigInt("2827991637673173") as Secret;
  const existingSecret = BigInt("7338940278733227") as Secret;
  const precommitment = {
    hash: hashPrecommitment(existingNullifier, existingSecret),
    nullifier: existingNullifier,
    secret: existingSecret,
  };
  return contracts.depositETH(existingValue, precommitment.hash);
}

export async function proveWithdrawal(w: Withdrawal): Promise<WithdrawalProof> {
  try {
    console.log("🚀 Initializing PrivacyPoolSDK...");

    // **Retrieve On-Chain Scope**
    console.log(
      "🔹 Retrieved Scope from Withdrawal:",
      `0x${w.scope.toString(16)}`,
    );

    // **Load Valid Input Values**
    const withdrawnValue = BigInt("100000000000000000"); // 0.1 eth
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
    const existingNullifier = BigInt("2827991637673173") as Secret;
    const existingSecret = BigInt("7338940278733227") as Secret;
    const newNullifier = BigInt("1800210687471587") as Secret;
    const newSecret = BigInt("6593588285288381") as Secret;

    console.log("🛠️ Generating commitments...");

    const commitment = getCommitment(
      existingValue,
      label,
      existingNullifier,
      existingSecret,
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
    const computedContext = calculateContext(w);
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
    const proofPayload: WithdrawalProof = await sdk.proveWithdrawal(
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
