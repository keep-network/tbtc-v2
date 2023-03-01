import type { HardhatUserConfig } from "hardhat/config"

import "@keep-network/hardhat-helpers"
import "@keep-network/hardhat-local-networks-config"
import "@nomiclabs/hardhat-waffle"
import "@nomiclabs/hardhat-etherscan"
import "hardhat-gas-reporter"
import "hardhat-contract-sizer"
import "hardhat-deploy"
import "@tenderly/hardhat-tenderly"
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
    goerliEthereum: {
      url: process.env.CHAIN_L1_API_URL || "",
      chainId: 5,
      deploy: ["deploy_l1"],
      accounts: process.env.ACCOUNTS_L1_PRIVATE_KEYS
        ? process.env.ACCOUNTS_L1_PRIVATE_KEYS.split(",")
        : undefined,
      tags: ["tenderly"],
    },
    mainnetEthereum: {
      url: process.env.CHAIN_L1_API_URL || "",
      chainId: 1,
      deploy: ["deploy_l1"],
      accounts: process.env.ACCOUNTS_L1_PRIVATE_KEYS
        ? process.env.ACCOUNTS_L1_PRIVATE_KEYS.split(",")
        : undefined,
      tags: ["etherscan", "tenderly"],
    },
    goerliArbitrum: {
      url: process.env.CHAIN_L2_API_URL || "",
      chainId: 421613,
      deploy: ["deploy_l2"],
      accounts: process.env.ACCOUNTS_L2_PRIVATE_KEYS
        ? process.env.ACCOUNTS_L2_PRIVATE_KEYS.split(",")
        : undefined,
      tags: ["tenderly"],
      companionNetworks: {
        l1: "goerliEthereum",
      },
    },
    mainnetArbitrum: {
      url: process.env.CHAIN_L2_API_URL || "",
      chainId: 42161,
      deploy: ["deploy_l2"],
      accounts: process.env.ACCOUNTS_L2_PRIVATE_KEYS
        ? process.env.ACCOUNTS_L2_PRIVATE_KEYS.split(",")
        : undefined,
      tags: ["arbiscan", "tenderly"],
      companionNetworks: {
        l1: "mainnetEthereum",
      },
    },
  },

  tenderly: {
    username: "thesis",
    project: "",
  },

  external: {
    deployments: {
      goerliEthereum: ["./external/goerliEthereum"],
      goerliArbitrum: ["./external/goerliArbitrum"],
      mainnetEthereum: ["./external/mainnetEthereum"],
      mainnetArbitrum: ["./external/mainnetArbitrum"],
    },
  },

  namedAccounts: {
    deployer: {
      default: 1,
      goerliEthereum: process.env.CONTRACT_L1_OWNER_ADDRESS || "",
      goerliArbitrum: process.env.CONTRACT_L2_OWNER_ADDRESS || "",
      mainnetEthereum: "",
      mainnetArbitrum: "",
    },
    governance: {
      default: 2,
      goerliEthereum: process.env.THRESHOLD_L1_COUNCIL_ADDRESS || "",
      goerliArbitrum: process.env.THRESHOLD_L2_COUNCIL_ADDRESS || "",
      mainnetEthereum: "", // Threshold Council
      mainnetArbitrum: "", // Threshold Council
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
