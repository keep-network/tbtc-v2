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
    depositor: {
      default: 0,
    },
  },
}

export default config
