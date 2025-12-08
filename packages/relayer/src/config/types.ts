import { z } from "zod";
import {
  zAssetConfig,
  zCommonConfig,
  zDefaultConfig,
  zVariableChainConfig,
  zRawChainConfig,
  zRawConfig,
  zNativeCurrency
} from "./schemas.js";

// Export types derived from Zod schemas
export type AssetConfig = z.infer<typeof zAssetConfig>;
export type RawChainConfig = z.infer<typeof zRawChainConfig>;
export type VariableChainConfig = z.infer<typeof zVariableChainConfig>;
export type UpdateChainConfigBody = VariableChainConfig;
export type NativeCurrency = z.infer<typeof zNativeCurrency>;
export type CommonConfig = z.infer<typeof zCommonConfig>;
export type DefaultConfig = z.infer<typeof zDefaultConfig>;
export type RawConfig = z.infer<typeof zRawConfig>;

export type SafeDefaultConfig = {
  entrypoint_address: DefaultConfig['entrypoint_address'];
};

export type SafeChainConfig = Omit<RawChainConfig, 'fee_receiver_address' | 'signer_private_key'>;

export type SafeConfig = Omit<RawConfig, 'defaults' | 'chains'> & {
  defaults?: SafeDefaultConfig;
  chains: SafeChainConfig[];
}; 
