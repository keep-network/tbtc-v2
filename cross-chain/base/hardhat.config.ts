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
        // "deploy_l1",
        "deploy_l2",
      ],
    },
    mainnet: {
      url: process.env.L1_CHAIN_API_URL || "",
      chainId: 1,
      deploy: ["deploy_l1"],
      accounts: process.env.L1_ACCOUNTS_PRIVATE_KEYS
        ? process.env.L1_ACCOUNTS_PRIVATE_KEYS.split(",")
        : undefined,
      tags: ["etherscan"],
    },
    base: {
      url: process.env.L2_CHAIN_API_URL || "",
      chainId: 8453,
      deploy: ["deploy_l2"],
      accounts: process.env.L2_ACCOUNTS_PRIVATE_KEYS
        ? process.env.L2_ACCOUNTS_PRIVATE_KEYS.split(",")
        : undefined,
      tags: ["basescan"],
      // In case of deployment failing with underpriced transaction error set
      // the `gasPrice` parameter.
      // gasPrice: 1000000000,
      // companionNetworks: {
      //   l1: "mainnet",
      // },
    },
  },

  external: {
    deployments: {
      mainnet: ["./external/mainnet"],
      base: ["./external/base"],
    },
  },

  deploymentArtifactsExport: {
    mainnet: "artifacts/l1",
    base: "artifacts/l2",
  },

  etherscan: {
    apiKey: {
      mainnet: process.env.ETHERSCAN_API_KEY,
      "base-mainnet": process.env.BASESCAN_API_KEY,
    },
    customChains: [
      {
        network: "base-mainnet",
        chainId: 8453,
        urls: {
          apiURL: "https://api.basescan.org/api",
          browserURL: "https://basescan.org",
        },
      },
    ],
  },

  namedAccounts: {
    deployer: {
      default: 1,
      mainnet: "0x123694886DBf5Ac94DDA07135349534536D14cAf",
      base: "0x123694886DBf5Ac94DDA07135349534536D14cAf",
    },
    governance: {
      default: 2,
      mainnet: "0x9f6e831c8f8939dc0c830c6e492e7cef4f9c2f5f", // Threshold Council
      base: "0x518385dd31289F1000fE6382b0C65df4d1Cd3bfC", // Threshold Council
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
