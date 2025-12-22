import { RawTestChainConfig, TestChainConfig, zTestChainConfig } from "./configTypes";

export type TestConfigSetupParams = {
  chainConfig: object,
  rpcUrl: string, 
  entrypointAddress: string, 
  signerPrivateKey: string, 
  feeRecieverAddress: string
}

export const setTestChainConfig = ( p: TestConfigSetupParams ): TestChainConfig => {
  const { 
    chainConfig,
    rpcUrl, 
    entrypointAddress, 
    signerPrivateKey, 
    feeRecieverAddress
  } = p;
 
  const result = zTestChainConfig.safeParse({
    ...chainConfig,
    rpc_url: rpcUrl, 
    entrypoint_address: entrypointAddress,
    signer_private_key: signerPrivateKey,
    fee_receiver_address: feeRecieverAddress,
  });
  if (!result.success) {
    throw Error(`${result.error}`)
  }
 
  return result.data; 
};

export const chainMainnet = 
  {
    "chain_id": "1",
    "chain_name": "ethereum",
    "max_gas_price": "40000000000",
    "native_currency": {
      "name": "Ether",
      "symbol": "ETH",
      "decimals": 18
    },
    "supported_assets": [
      {
        "asset_address": "0xEeeeeEeeeEeEeeEeEeEeeEEEeeeeEeeeeeeeEEeE",
        "asset_name": "ETH",
        "fee_bps": "10",
        "min_withdraw_amount": "0"
      },
      {
        "asset_address": "0xdC035D45d973E3EC169d2276DDab16f1e407384F",
        "asset_name": "USDS",
        "fee_bps": "10",
        "min_withdraw_amount": "0"
      },
      {
        "asset_address": "0xa3931d71877C0E7a3148CB7Eb4463524FEc27fbD",
        "asset_name": "sUSDS",
        "fee_bps": "10",
        "min_withdraw_amount": "0"
      },
      {
        "asset_address": "0x6B175474E89094C44Da98b954EedeAC495271d0F",
        "asset_name": "DAI",
        "fee_bps": "10",
        "min_withdraw_amount": "0"
      },
      {
        "asset_address": "0xdAC17F958D2ee523a2206206994597C13D831ec7",
        "asset_name": "USDT",
        "fee_bps": "10",
        "min_withdraw_amount": "0"
      },
      {
        "asset_address": "0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48",
        "asset_name": "USDC",
        "fee_bps": "10",
        "min_withdraw_amount": "0"
      },
      {
        "asset_address": "0x7f39C581F595B53c5cb19bD0b3f8dA6c935E2Ca0",
        "asset_name": "wstETH",
        "fee_bps": "10",
        "min_withdraw_amount": "0"
      },
      {
        "asset_address": "0x2260FAC5E5542a773Aa44fBCfeDf7C193bc2C599",
        "asset_name": "WBTC",
        "fee_bps": "10",
        "min_withdraw_amount": "0"
      },
      {
        "asset_address": "0x4c9EDD5852cd905f086C759E8383e09bff1E68B3",
        "asset_name": "USDe",
        "fee_bps": "10",
        "min_withdraw_amount": "0"
      },
      {
        "asset_address": "0x8d0D000Ee44948FC98c9B98A4FA4921476f08B0d",
        "asset_name": "USD1",
        "fee_bps": "10",
        "min_withdraw_amount": "0"
      },
      {
        "asset_address": "0xCAcd6fd266aF91b8AeD52aCCc382b4e165586E29",
        "asset_name": "FRXUSD",
        "fee_bps": "10",
        "min_withdraw_amount": "0"
      },
      {
        "asset_address": "0xDcEe70654261AF21C44c093C300eD3Bb97b78192",
        "asset_name": "WOETH",
        "fee_bps": "10",
        "min_withdraw_amount": "0"
      }
    ] 
  }


export const chainSepolia = 
  {
    "chain_id": "11155111",
    "chain_name": "sepolia",
    "max_gas_price": "40000000000",
    "native_currency": {
      "name": "Sepolia Ether",
      "symbol": "ETH",
      "decimals": 18
    },
    "supported_assets": [
      {
        "asset_address": "0xEeeeeEeeeEeEeeEeEeEeeEEEeeeeEeeeeeeeEEeE",
        "asset_name": "ETH",
        "fee_bps": "10",
        "min_withdraw_amount": "0"
      },
      {
        "asset_address": "0x6709277E170DEe3E54101cDb73a450E392ADfF54",
        "asset_name": "USDT",
        "fee_bps": "10",
        "min_withdraw_amount": "0"
      },
      {
        "asset_address": "0x0b062Fe33c4f1592D8EA63f9a0177FcA44374C0f",
        "asset_name": "USDC",
        "fee_bps": "10",
        "min_withdraw_amount": "0"
      },
      {
        "asset_address": "0x1c7D4B196Cb0C7B01d743Fbc6116a902379C7238",
        "asset_name": "USDC",
        "fee_bps": "10",
        "min_withdraw_amount": "0"
      }
    ]
  };

export const chainOptimismSepolia =
  {
    "chain_id": "11155420",
    "chain_name": "sepolia-optimism",
    "max_gas_price": "40000000000",
    "native_currency": {
      "name": "Ether",
      "symbol": "ETH",
      "decimals": 18
    },
    "supported_assets": [
      {
        "asset_address": "0xEeeeeEeeeEeEeeEeEeEeeEEEeeeeEeeeeeeeEEeE",
        "asset_name": "ETH",
        "fee_bps": "10",
        "min_withdraw_amount": "0"
      },
      {
        "asset_address": "0x4200000000000000000000000000000000000006",
        "asset_name": "ETH",
        "fee_bps": "10",
        "min_withdraw_amount": "0"
      }
    ]
  };

export const chainOptimismMainnet =
    {
      "chain_id": "10",
      "chain_name": "opt-mainnet",
      "max_gas_price": "40000000000",
      "native_currency": {
        "name": "Ether",
        "symbol": "ETH",
        "decimals": 18
      },
      "supported_assets": [
        {
          "asset_address": "0xEeeeeEeeeEeEeeEeEeEeeEEEeeeeEeeeeeeeEEeE",
          "asset_name": "ETH",
          "fee_bps": "10",
          "min_withdraw_amount": "0"
        },
        {
          "asset_address": "0x4200000000000000000000000000000000000006",
          "asset_name": "ETH",
          "fee_bps": "10",
          "min_withdraw_amount": "0"
        }
      ]
    };

export const chainBscMainnet =
  {
    "chain_id": "56",
    "chain_name": "bsc-mainnet",
    "max_gas_price": "40000000000",
    "native_currency": {
      "name": "cz money",
      "symbol": "BNB",
      "decimals": 18
    },
    "supported_assets": [
      {
        "asset_address": "0xEeeeeEeeeEeEeeEeEeEeeEEEeeeeEeeeeeeeEEeE",
        "asset_name": "BNB",
        "fee_bps": "10",
        "min_withdraw_amount": "0"
      },
      {
        "asset_address": "0x4200000000000000000000000000000000000006",
        "asset_name": "BNB",
        "fee_bps": "10",
        "min_withdraw_amount": "0"
      }
    ]
  };

export const chainBaseMainnet =
  {
    "chain_id": "8453",
    "chain_name": "base-mainnet",
    "max_gas_price": "40000000000",
    "native_currency": {
      "name": "Ether",
      "symbol": "ETH",
      "decimals": 18
    },
    "supported_assets": [
      {
        "asset_address": "0xEeeeeEeeeEeEeeEeEeEeeEEEeeeeEeeeeeeeEEeE",
        "asset_name": "ETH",
        "fee_bps": "10",
        "min_withdraw_amount": "0"
      },
      {
        "asset_address": "0x4200000000000000000000000000000000000006",
        "asset_name": "ETH",
        "fee_bps": "10",
        "min_withdraw_amount": "0"
      }
    ]
  };

export const chainArbitrumMainnet =
  {
    "chain_id": "42161",
    "chain_name": "arbitrum-one-mainnet",
    "max_gas_price": "40000000000",
    "native_currency": {
      "name": "Ether",
      "symbol": "ETH",
      "decimals": 18
    },
    "supported_assets": [
      {
        "asset_address": "0xEeeeeEeeeEeEeeEeEeEeeEEEeeeeEeeeeeeeEEeE",
        "asset_name": "ETH",
        "fee_bps": "10",
        "min_withdraw_amount": "0"
      },
      {
        "asset_address": "0x4200000000000000000000000000000000000006",
        "asset_name": "ETH",
        "fee_bps": "10",
        "min_withdraw_amount": "0"
      },
      {
        "asset_address": "0x252b965400862d94bda35fecf7ee0f204a53cc36",
        "asset_name": "yUSND",
        "fee_bps": "10",
        "min_withdraw_amount": "0"
      },
      {
        "asset_address": "0xaf88d065e77c8cC2239327C5EDb3A432268e5831",
        "asset_name": "USDC",
        "fee_bps": "10",
        "min_withdraw_amount": "0"
      }
    ]
  };
    
