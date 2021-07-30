import { HardhatUserConfig } from "hardhat/config"

import "@keep-network/hardhat-helpers"
import "@keep-network/hardhat-local-networks-config"
import "@nomiclabs/hardhat-waffle"
import "hardhat-gas-reporter"
import "hardhat-contract-sizer"
import "hardhat-deploy"

const config: HardhatUserConfig = {
  solidity: {
    compilers: [
      {
        version: "0.6.12",
        settings: {
          optimizer: {
            enabled: true,
            runs: 200,
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
      forking: {
        // forking is enabled only if FORKING_URL env is provided
        enabled: !!process.env.FORKING_URL,
        // URL should point to a node with archival data (Alchemy recommended)
        url: process.env.FORKING_URL || "",
        // latest block is taken if FORKING_BLOCK env is not provided
        blockNumber:
          process.env.FORKING_BLOCK && parseInt(process.env.FORKING_BLOCK),
      },
      tags: ["local"]
    },
  },

  // Define local networks configuration file path to load networks from file.
  // localNetworksConfig: "./.hardhat/networks.ts",

  // TODO: Once tBTC v2 is deployed, revisit `./external/mainnet` files and set
  //       correct addresses and parameters.
  // TODO: Once Saddle vault is created, revisit `./external/hardhat/TBTCSaddleVault.json`
  //       and set its address hare. This will make the deployment script
  //       pass on hardhat network.
  external: {
    deployments: {
      hardhat: [
        "./external/hardhat"
      ],
      mainnet: [
        "./external/mainnet"
      ],
    },
  },

  namedAccounts: {
    deployer: {
      default: 0, // take the first account as deployer
    },
  },

  mocha: {
    timeout: 120000,
  },
}

export default config
