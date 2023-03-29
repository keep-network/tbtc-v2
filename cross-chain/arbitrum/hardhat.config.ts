import type { HardhatUserConfig } from "hardhat/config"

import "@keep-network/hardhat-helpers"
import "@nomiclabs/hardhat-waffle"
import "@nomiclabs/hardhat-etherscan"
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
      deploy: ["deploy_l2"],
    },
    goerli: {
      url: process.env.CHAIN_L1_API_URL || "",
      chainId: 5,
      deploy: ["deploy_l1"],
      accounts: process.env.ACCOUNTS_L1_PRIVATE_KEYS
        ? process.env.ACCOUNTS_L1_PRIVATE_KEYS.split(",")
        : undefined,
      tags: ["etherscan"],
    },
    mainnet: {
      url: process.env.CHAIN_L1_API_URL || "",
      chainId: 1,
      deploy: ["deploy_l1"],
      accounts: process.env.ACCOUNTS_L1_PRIVATE_KEYS
        ? process.env.ACCOUNTS_L1_PRIVATE_KEYS.split(",")
        : undefined,
      tags: ["etherscan"],
    },
    arbitrumGoerli: {
      url: process.env.CHAIN_L2_API_URL || "",
      chainId: 421613,
      deploy: ["deploy_l2"],
      accounts: process.env.ACCOUNTS_L2_PRIVATE_KEYS
        ? process.env.ACCOUNTS_L2_PRIVATE_KEYS.split(",")
        : undefined,
      tags: ["arbiscan"],
      companionNetworks: {
        l1: "goerli",
      },
    },
    arbitrumMainnet: {
      url: process.env.CHAIN_L2_API_URL || "",
      chainId: 42161,
      deploy: ["deploy_l2"],
      accounts: process.env.ACCOUNTS_L2_PRIVATE_KEYS
        ? process.env.ACCOUNTS_L2_PRIVATE_KEYS.split(",")
        : undefined,
      tags: ["arbiscan"],
      companionNetworks: {
        l1: "mainnet",
      },
    },
  },

  external: {
    deployments: {
      goerli: ["./external/goerli"],
      arbitrumGoerli: ["./external/arbitrumGoerli"],
      mainnet: ["./external/mainnet"],
      arbitrumMainnet: ["./external/arbitrumMainnet"],
    },
  },

  etherscan: {
    apiKey: {
      goerli: process.env.ETHERSCAN_API_KEY,
      arbitrumGoerli: process.env.ARBISCAN_API_KEY,
    },
  },

  namedAccounts: {
    deployer: {
      default: 1,
      goerli: process.env.CONTRACT_L1_OWNER_ADDRESS || "",
      arbitrumGoerli: process.env.CONTRACT_L2_OWNER_ADDRESS || "",
      mainnet: "0x123694886DBf5Ac94DDA07135349534536D14cAf",
      arbitrumMainnet: "0x123694886DBf5Ac94DDA07135349534536D14cAf",
    },
    governance: {
      default: 2,
      goerli: process.env.THRESHOLD_L1_COUNCIL_ADDRESS || "",
      arbitrumGoerli: process.env.THRESHOLD_L2_COUNCIL_ADDRESS || "",
      mainnet: "0x9f6e831c8f8939dc0c830c6e492e7cef4f9c2f5f",
      arbitrumMainnet: "0x9f6e831c8f8939dc0c830c6e492e7cef4f9c2f5f",
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
