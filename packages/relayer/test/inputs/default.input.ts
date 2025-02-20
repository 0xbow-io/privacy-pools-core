export const FEE_RECEIVER_ADDRESS_TEST =
  "0x1212121212121212121212121212121212121212";
export const RECIPIENT_TEST = "0x2222222222222222222222222222222222222222";
export const ENTRYPOINT_ADDRESS_TEST =
  "0xe1e1e1e1e1e1e1e1e1e1e1e1e1e1e1e1e1e1e1e1";
export const SIGNER_PRIVATE_KEY_TEST =
  "0x8888888888888888888888888888888888888888888888888888888888888888";
export const FEE_BPS_TEST = 2_000n;
export const PROVIDER_URL_TEST = "http://some.rpc.url";
export const ASSET_ADDRESS_TEST = "0xbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb";

export const PUBLIC_SIGNALS_TEST = [
  "3329689937152127469229150262753567411942915488378487399955260719617505754356",
  "18039167616040266842480420918192602605750291173853081205310130137735640368215",
  "100000000000000000",
  "11647068014638404411083963959916324311405860401109309104995569418439086324505",
  "2",
  "17509119559942543382744731935952318540675152427220720285867932301410542597330",
  "2",
  "3780521699031776166450964239112683738071773548658189963690486009801128327065",
].map(BigInt);

export const testingConfig = {
  FEE_RECEIVER_ADDRESS: FEE_RECEIVER_ADDRESS_TEST,
  ENTRYPOINT_ADDRESS: ENTRYPOINT_ADDRESS_TEST,
  PROVIDER_URL: PROVIDER_URL_TEST,
  SIGNER_PRIVATE_KEY: SIGNER_PRIVATE_KEY_TEST,
  FEE_BPS: FEE_BPS_TEST,
  SQLITE_DB_PATH: "test.sqlite",
  WITHDRAW_AMOUNTS: {
    [ASSET_ADDRESS_TEST]: 200,
  },
  CHAIN: "",
  ALLOWED_DOMAINS: ["http://localhost:3000"],
};
