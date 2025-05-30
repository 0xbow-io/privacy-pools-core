import { Hash, Withdrawal } from "@0xbow/privacy-pools-core-sdk";
import { encodeAbiParameters, getAddress, Hex } from "viem";
import { quote, request } from "./api-test.js";
import { anvilChain, getPoolContract } from "./chain.js";
import { ENTRYPOINT_ADDRESS } from "./constants.js";
import { deposit, depositAsset, proveWithdrawal } from "./create-withdrawal.js";
import { isNative } from "./util.js";
import { cli } from "./cli.js";

(async () => {

  await cli();

})();
