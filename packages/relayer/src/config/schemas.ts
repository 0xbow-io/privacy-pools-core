import { z } from "zod";
import path from "node:path";
import { zAddress, zChainId, zNonNegativeBigInt, zPrivateKey } from "../schemes/shared.schemes.js";

// Fee BPS validation schema
export const zFeeBps = z
  .string()
  .or(z.number())
  .pipe(z.coerce.bigint().nonnegative().max(10_000n));

// Withdraw amount validation schema
export const zWithdrawAmount = z
  .string()
  .or(z.number())
  .pipe(z.coerce.bigint().nonnegative());

// Asset configuration schema
export const zAssetConfig = z.object({
  asset_address: zAddress,
  asset_name: z.string(),
  fee_bps: zFeeBps,
  min_withdraw_amount: zWithdrawAmount,
});

// Native currency configuration schema
export const zNativeCurrency = z.object({
  name: z.string().default("Ether"),
  symbol: z.string().default("ETH"),
  decimals: z.number().default(18)
});

export const zSecretConfig = z.object({
  fee_receiver_address: zAddress,
  signer_private_key: zPrivateKey,
});

export const zVariableChainConfig = z.object({
  chain_id: zChainId,
  chain_name: z.string(),
  rpc_url: z.string().url(),
  max_gas_price: zNonNegativeBigInt.optional(),
  entrypoint_address: zAddress.optional(),
  supported_assets: z.array(zAssetConfig).optional(),
  native_currency: zNativeCurrency.optional(),
});

export const zRawChainConfig = zVariableChainConfig
  .merge(zSecretConfig.partial())
  .strict();

// Common configuration schema
export const zCommonConfig = z.object({
  sqlite_db_path: z.string().transform((p) => path.resolve(p)),
  cors_allow_all: z.boolean().default(true),
  allowed_domains: z.array(z.string().url()).default(["https://testnet.privacypools.com, https://prod-privacy-pool-ui.vercel.app, https://staging-privacy-pool-ui.vercel.app, https://dev-privacy-pool-ui.vercel.app, http://localhost:3000"]),
});

// Default configuration schema
export const zDefaultConfig = z.object({
  fee_receiver_address: zAddress.optional(),
  signer_private_key: zPrivateKey.optional(),
  entrypoint_address: zAddress.optional(),
});

// Raw configuration schema (with optional fields)
export const zRawConfig = z
  .object({
    defaults: zDefaultConfig.optional(),
    chains: z.array(zRawChainConfig),
    sqlite_db_path: zCommonConfig.shape.sqlite_db_path,
    cors_allow_all: zCommonConfig.shape.cors_allow_all,
    allowed_domains: zCommonConfig.shape.allowed_domains,
  })
  .strict();

export const zUpdateChainConfig = z.object({
  chain_id: zChainId,
  chain_name: z.string().optional(),
  rpc_url: z.string().url().optional(),
  max_gas_price: zNonNegativeBigInt.optional(),
  entrypoint_address: zAddress.optional(),
  supported_assets: z.array(zAssetConfig).optional(),
  native_currency: zNativeCurrency.optional(),
}).readonly();

export type UpdateConfigBody = z.infer<typeof zUpdateChainConfig>;

export const validateConfigUpdateBody = (data: unknown) => {
  const result = zUpdateChainConfig.safeParse(data);
  return {
    ...result,
    errors: result.success ? null : result.error.errors,
  };
};

export const zDeleteConfigBody = z.object({
  chain_id: zChainId,
  asset_addresses: zAddress.or(z.array(zAddress).min(1, { message: 'Array must contain at least one asset address' })),
});

export type DeleteConfigBody = z.infer<typeof zDeleteConfigBody>;

export const validateConfigDeleteBody = (data: unknown) => {
  const result = zDeleteConfigBody.safeParse(data);
  return {
    ...result,
    errors: result.success ? null : result.error.errors,
  };
};
