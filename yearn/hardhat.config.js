require("@nomiclabs/hardhat-waffle")
require("hardhat-gas-reporter")
require("hardhat-contract-sizer")

module.exports = {
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
    },
  },

  mocha: {
    timeout: 30000,
  },
}
