import { z } from "zod";
import { zAssetConfig, zCommonConfig, zNativeCurrency } from "../../src/config/schemas.js";
import { zAddress, zChainId, zNonNegativeBigInt, zPrivateKey } from "../../src/schemes/shared.schemes.js";

export type TestConfig = z.infer<typeof zTestConfig>;
export type TestChainConfig = z.infer<typeof zTestChainConfig>;
export type RawTestChainConfig = z.infer<typeof zRawTestChainConfig>;

export const zRawTestChainConfig = z.object({
  chain_id: zChainId,
  chain_name: z.string(),
  max_gas_price: zNonNegativeBigInt,
  supported_assets: z.array(zAssetConfig),
  native_currency: zNativeCurrency,
});

export const zTestChainConfig = zRawTestChainConfig
  .extend({
    rpc_url: z.string().url(),
    entrypoint_address: zAddress,
    fee_receiver_address: zAddress,
    signer_private_key: zPrivateKey,
  });

// Raw configuration schema (with optional fields)
export const zTestConfig = z
  .object({
    chains: z.array(zTestChainConfig),
    sqlite_db_path: zCommonConfig.shape.sqlite_db_path,
    cors_allow_all: zCommonConfig.shape.cors_allow_all,
    allowed_domains: zCommonConfig.shape.allowed_domains,
  })
  .strict();

