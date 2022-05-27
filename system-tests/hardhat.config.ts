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
      default: 0,
    },
    maintainer: {
      default: 1,
    },
    depositor: {
      default: 2,
    },
  },

  mocha: {
    timeout: 14400000, // 4 hours
  },
}

export default config
