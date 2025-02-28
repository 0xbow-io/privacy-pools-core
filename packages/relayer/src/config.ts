import fs from "node:fs";
import path from "node:path";
import { defineChain, getAddress } from "viem";
import { localhost, mainnet, sepolia } from "viem/chains";
import { z } from "zod";
import { ConfigError } from "./exceptions/base.exception.js";

const zAddress = z
  .string()
  .regex(/^0x[0-9a-fA-F]+/)
  .length(42)
  .transform((v) => getAddress(v));
const zPkey = z
  .string()
  .regex(/^0x[0-9a-fA-F]+/)
  .length(66)
  .transform((v) => v as `0x${string}`);
const zChain = z
  .object({
    name: z.enum(["localhost", "mainnet", "sepolia"]),
    id: z
      .string()
      .or(z.number())
      .pipe(z.coerce.number())
      .refine((x) => x > 0)
      .default(31337),
  })
  .transform((c) => {
    if (c.name === "localhost") {
      return defineChain({ ...localhost, id: c.id });
    } else if (c.name === "sepolia") {
      return sepolia;
    } else if (c.name === "mainnet") {
      return mainnet;
    } else {
      return z.NEVER;
    }
  });
const zWithdrawAmounts = z.record(
  zAddress,
  z.number().nonnegative().pipe(z.coerce.bigint()),
);
const fee_bps = z
  .string()
  .or(z.number())
  .pipe(z.coerce.bigint().nonnegative().max(10_000n));

const configSchema = z
  .object({
    fee_receiver_address: zAddress,
    fee_bps: fee_bps,
    signer_private_key: zPkey,
    entrypoint_address: zAddress,
    provider_url: z.string().url(),
    chain: zChain,
    sqlite_db_path: z.string().transform((p) => path.resolve(p)),
    withdraw_amounts: zWithdrawAmounts,
    cors_allow_all: z.boolean().default(false),
    allowed_domains: z.array(z.string().url()),
  })
  .strict()
  .readonly();

function readConfigFile(): Record<string, unknown> {
  let configPathString = process.env["CONFIG_PATH"];
  if (!configPathString) {
    console.warn("CONFIG_PATH is not set, using default path: ./config.json");
    configPathString = "./config.json";
  }
  if (!fs.existsSync(configPathString)) {
    throw ConfigError.default("No config.json found for relayer.");
  }
  return JSON.parse(
    fs.readFileSync(path.resolve(configPathString), { encoding: "utf-8" }),
  );
}

const config = configSchema.parse(readConfigFile());

export const FEE_RECEIVER_ADDRESS = config.fee_receiver_address;
export const ENTRYPOINT_ADDRESS = config.entrypoint_address;
export const PROVIDER_URL = config.provider_url;
export const SIGNER_PRIVATE_KEY = config.signer_private_key;
export const FEE_BPS = config.fee_bps;
export const SQLITE_DB_PATH = config.sqlite_db_path;
export const WITHDRAW_AMOUNTS = config.withdraw_amounts;
export const CHAIN = config.chain;
export const ALLOWED_DOMAINS = config.allowed_domains;
export const CORS_ALLOW_ALL = config.cors_allow_all;
