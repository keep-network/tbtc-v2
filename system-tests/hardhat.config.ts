import { HardhatUserConfig } from "hardhat/config"

import "@keep-network/hardhat-helpers"
import "@nomiclabs/hardhat-ethers"
import "@nomiclabs/hardhat-waffle"
import "hardhat-deploy"

const config: HardhatUserConfig = {
  networks: {
    hardhat: {},
  },

  external: {
    contracts: [
      {
        artifacts: "node_modules/@keep-network/tbtc-v2/artifacts",
        deploy: "node_modules/@keep-network/tbtc-v2/deploy",
      },
    ],
  },

  namedAccounts: {
    deployer: {
      default: 0,
    },
    depositor: {
      default: 1,
    },
  },
}

export default config
