import { chainArbitrumMainnet, chainBscMainnet, chainMainnet, chainOptimismMainnet, chainOptimismSepolia, chainSepolia, setTestChainConfig } from "./chainsConfig";
import { TestConfig } from "./configTypes";

const signerPrivateKey = "0xac0974bec39a17e36ba4a6b4d238ff944bacb478cbed5efcae784d7bf4f2ff80" 
const feeRecieverAddress = "0xf39Fd6e51aad88F6F4ce6aB8827279cffFb92266" 
const rpcUrlId = process.env.RPC_URL_KEY!  
const sepoliaRpcUrl = process.env.SEPOLIA_RPC_URL!

export const originalConfig: TestConfig = { 
  "chains": [
    setTestChainConfig({chainConfig: chainMainnet, 
      rpcUrl: `https://eth-mainnet.g.alchemy.com/v2/${rpcUrlId}`,
      entrypointAddress: "0x6818809EefCe719E480a7526D76bD3e561526b46",
      signerPrivateKey,
      feeRecieverAddress
    }),
    setTestChainConfig({chainConfig: chainSepolia, 
      rpcUrl: sepoliaRpcUrl,
      entrypointAddress: "0x34A2068192b1297f2a7f85D7D8CdE66F8F0921cB",
      signerPrivateKey,
      feeRecieverAddress
    }),
    setTestChainConfig({chainConfig: chainOptimismSepolia,
      rpcUrl: `https://opt-sepolia.g.alchemy.com/v2/${rpcUrlId}`,
      entrypointAddress: "0x54aCA0D27500669FA37867233e05423701f11ba1",
      signerPrivateKey,
      feeRecieverAddress
    }),
    setTestChainConfig({chainConfig: chainOptimismMainnet,
      rpcUrl: `https://opt-mainnet.g.alchemy.com/v2/${rpcUrlId}`,
      entrypointAddress: "0x44192215FEd782896BE2CE24E0Bfbf0BF825d15E",
      signerPrivateKey,
      feeRecieverAddress
    }),
    // setTestChainConfig({chainConfig: chainBscMainnet,
    //   rpcUrl: `https://bnb-mainnet.g.alchemy.com/v2/${rpcUrlId}`,
    //   entrypointAddress: "0x44192215FEd782896BE2CE24E0Bfbf0BF825d15E",
    //   signerPrivateKey,
    //   feeRecieverAddress
    // }),
    setTestChainConfig({chainConfig: chainArbitrumMainnet,
      rpcUrl: `https://arb-mainnet.g.alchemy.com/v2/${rpcUrlId}`,
      entrypointAddress: "0x44192215FEd782896BE2CE24E0Bfbf0BF825d15E",
      signerPrivateKey,
      feeRecieverAddress
    }),  
  ],
  "sqlite_db_path": "/tmp/pp_relayer.sqlite",
  "cors_allow_all": true,
  "allowed_domains": [
    "https://testnet.privacypools.com",
    "https://privacypools.com",
    "https://prod-privacy-pool-ui.vercel.app",
    "https://staging-privacy-pool-ui.vercel.app",
    "https://dev-privacy-pool-ui.vercel.app"
  ]
};


