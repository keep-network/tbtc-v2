import { context, Environment } from "./context"
import type { Bridge, TBTCVault } from "@keep-network/tbtc-v2.ts/dist/src/chain"
import { EthereumBridge, EthereumTBTCVault} from "@keep-network/tbtc-v2.ts"
import { providers } from "ethers"

const resolve = () => {
  let packageName: string

  switch (context.environment) {
    case Environment.Mainnet: {
      packageName = "@keep-network/tbtc-v2-mainnet"
      break
    }
    case Environment.Testnet: {
      packageName = "@keep-network/tbtc-v2-testnet"
      break
    }
    default: {
      throw new Error(`cannot pick tbtc package for ${context.environment} environment`)
    }
  }

  const provider = new providers.JsonRpcProvider(context.ethereumUrl)

  const bridgeArtifact = require(`${packageName}/artifacts/Bridge.json`)
  const Bridge: Bridge = new EthereumBridge({
    address: bridgeArtifact.address,
    signerOrProvider: provider,
    deployedAtBlockNumber: bridgeArtifact.receipt.blockNumber
  })

  const tbtcVaultArtifact = require(`${packageName}/artifacts/TBTCVault.json`)
  const TBTCVault: TBTCVault = new EthereumTBTCVault({
    address: tbtcVaultArtifact.address,
    signerOrProvider: provider,
    deployedAtBlockNumber: tbtcVaultArtifact.receipt.blockNumber
  })

  return { Bridge, TBTCVault }
}

export const contracts = resolve()
