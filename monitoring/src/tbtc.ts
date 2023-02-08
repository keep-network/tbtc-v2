import { context, Environment } from "./context"
import * as mainnet from "@keep-network/tbtc-v2.ts-mainnet"
import * as testnet from "@keep-network/tbtc-v2.ts-testnet"

const pick = () => {
  switch (context.environment) {
    case Environment.Mainnet: {
      return mainnet
    }
    case Environment.Testnet: {
      return testnet
    }
    default: {
      throw new Error(`cannot pick tbtc library for ${context.environment} environment`)
    }
  }
}

export const tbtc = pick()
