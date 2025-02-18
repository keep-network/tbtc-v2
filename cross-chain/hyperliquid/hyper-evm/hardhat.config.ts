import type { HardhatUserConfig } from "hardhat/config"

import "@nomiclabs/hardhat-etherscan"
import "@keep-network/hardhat-helpers"
import "@nomiclabs/hardhat-waffle"
import "hardhat-gas-reporter"
import "hardhat-contract-sizer"
import "hardhat-deploy"
import "@typechain/hardhat"
import "hardhat-dependency-compiler"

const config: HardhatUserConfig = {
  solidity: {
    compilers: [
      {
        version: "0.8.17",
        settings: {
          optimizer: {
            enabled: true,
            runs: 1000,
          },
        },
      },
    ],
  },

  paths: {
    artifacts: "./build",
  },

  networks: {
    hardhat: {
      deploy: [
        "deploy",
      ],
    },
    hyperEvmTestnet: {
      url: process.env.HYPER_EVM_API_URL || "",
      chainId: 998,
      deploy: ["deploy"],
      accounts: process.env.ACCOUNTS_PRIVATE_KEYS
        ? process.env.ACCOUNTS_PRIVATE_KEYS.split(",")
        : undefined,
    },
  },

  // external: {
  //   deployments: {
  //     hyperEvmTestnet: ["./external/hyperEvmTestnet"],
  //   },
  // },

  deploymentArtifactsExport: {
    hyperEvmTestnet: "artifacts/",
  },

  namedAccounts: {
    deployer: {
      default: 1,
      hyperEvmTestnet: "0x15424dC94D4da488DB0d0e0B7aAdB86835813a63",
    },
    governance: {
      default: 2,
      hyperEvmTestnet: "0x9f6e831c8f8939dc0c830c6e492e7cef4f9c2f5f",
    },
  },
  mocha: {
    timeout: 60_000,
  },
  typechain: {
    outDir: "typechain",
  },
}

export default config
