import { HardhatUserConfig } from "hardhat/config"

import "@keep-network/hardhat-helpers"
import "@nomiclabs/hardhat-ethers"
import "@nomiclabs/hardhat-waffle"
import "hardhat-deploy"

const config: HardhatUserConfig = {
  networks: {
    development: {
      url: "http://localhost:8545",
    },
  },

  namedAccounts: {
    deployer: {
      default: 1,
    },
    treasury: {
      default: 2,
    },
    governance: {
      default: 3,
    },
    keepTechnicalWalletTeam: {
      default: 4,
    },
    keepCommunityMultiSig: {
      default: 5,
    },
    esdm: {
      default: 6,
    },
    maintainer: {
      default: 7,
    },
    depositor: {
      default: 8,
    },
  },

  mocha: {
    timeout: 14400000, // 4 hours
  },
}

export default config
