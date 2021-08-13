import { HardhatUserConfig } from "hardhat/config"

import "@keep-network/hardhat-helpers"
import "@keep-network/hardhat-local-networks-config"
import "@nomiclabs/hardhat-waffle"
import "hardhat-gas-reporter"
import "hardhat-deploy"

const config: HardhatUserConfig = {
  solidity: {
    compilers: [
      {
        version: "0.8.4", // TODO: Revisit solidity version before deploying on mainnet!
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
      tags: ["local"],
    },
    development: {
      url: "http://localhost:8545",
      chainId: 1101,
      tags: ["local"],
    },
  },

  // Define local networks configuration file path to load networks from file.
  // localNetworksConfig: "./.hardhat/networks.ts",

  external: {
    contracts: [
      {
        artifacts: "node_modules/@keep-network/tbtc/artifacts",
      },
    ],
    deployments: {
      // For development environment we expect the local dependencies to be
      // linked with `yarn link` command.
      development: ["node_modules/@keep-network/tbtc/artifacts"],
      ropsten: ["node_modules/@keep-network/tbtc/artifacts"],
      mainnet: ["./external/mainnet"],
    },
  },

  namedAccounts: {
    deployer: {
      default: 0, // take the first account as deployer
    },
    keepTechnicalWalletTeam: {
      mainnet: "0xB3726E69Da808A689F2607939a2D9E958724FC2A",
    },
    keepCommunityMultiSig: {
      mainnet: "0x19FcB32347ff4656E4E6746b4584192D185d640d",
    },
  },
}

export default config
