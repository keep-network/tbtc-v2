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
    goerliEthereum: {
      url: process.env.CHAIN_L1_API_URL || "",
      chainId: 5,
      deploy: ["deploy_l1"],
      accounts: process.env.ACCOUNTS_L1_PRIVATE_KEYS
        ? process.env.ACCOUNTS_L1_PRIVATE_KEYS.split(",")
        : undefined,
      tags: ["etherscan"],
    },
    mainnetEthereum: {
      url: process.env.CHAIN_L1_API_URL || "",
      chainId: 1,
      deploy: ["deploy_l1"],
      accounts: process.env.ACCOUNTS_L1_PRIVATE_KEYS
        ? process.env.ACCOUNTS_L1_PRIVATE_KEYS.split(",")
        : undefined,
      tags: ["etherscan"],
    },
    goerliArbitrum: {
      url: process.env.CHAIN_L2_API_URL || "",
      chainId: 421613,
      deploy: ["deploy_l2"],
      accounts: process.env.ACCOUNTS_L2_PRIVATE_KEYS
        ? process.env.ACCOUNTS_L2_PRIVATE_KEYS.split(",")
        : undefined,
      tags: ["arbiscan"],
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
      tags: ["arbiscan"],
      companionNetworks: {
        l1: "mainnetEthereum",
      },
    },
  },

  external: {
    deployments: {
      goerliEthereum: ["./external/goerliEthereum"],
      goerliArbitrum: ["./external/goerliArbitrum"],
      mainnetEthereum: ["./external/mainnetEthereum"],
      mainnetArbitrum: ["./external/mainnetArbitrum"],
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
      goerliEthereum: process.env.CONTRACT_L1_OWNER_ADDRESS || "",
      goerliArbitrum: process.env.CONTRACT_L2_OWNER_ADDRESS || "",
      mainnetEthereum: process.env.CONTRACT_L1_OWNER_ADDRESS || "",
      mainnetArbitrum: process.env.CONTRACT_L2_OWNER_ADDRESS || "",
    },
    governance: {
      default: 2,
      goerliEthereum: process.env.THRESHOLD_L1_COUNCIL_ADDRESS || "",
      goerliArbitrum: process.env.THRESHOLD_L2_COUNCIL_ADDRESS || "",
      mainnetEthereum: process.env.THRESHOLD_L1_COUNCIL_ADDRESS || "",
      mainnetArbitrum: process.env.THRESHOLD_L2_COUNCIL_ADDRESS || "",
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
