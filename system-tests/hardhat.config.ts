import type { HardhatUserConfig } from "hardhat/config"

import "@keep-network/hardhat-helpers"
import "@nomiclabs/hardhat-ethers"
import "@nomiclabs/hardhat-waffle"
import "hardhat-deploy"

const config: HardhatUserConfig = {
  networks: {
    development: {
      url: "http://127.0.0.1:8545",
    },
    system_tests: {
      url: "http://127.0.0.1:8545",
    },
  },

  // Indices for named accounts should match the ones defined in `@keep-network/tbtc-v2`.
  namedAccounts: {
    deployer: {
      default: 1,
    },
    governance: {
      default: 2,
    },
    chaosnetOwner: {
      default: 3,
    },
    esdm: {
      default: 4,
    },
    keepTechnicalWalletTeam: {
      default: 5,
    },
    keepCommunityMultiSig: {
      default: 6,
    },
    treasury: {
      default: 7,
    },
    maintainer: {
      default: 8,
    },
    depositor: {
      default: 9,
    },
  },

  mocha: {
    timeout: 14400000, // 4 hours
  },
}

export default config
