import {
  EthereumBridge,
  EthereumTBTCToken,
  EthereumTBTCVault,
} from "@keep-network/tbtc-v2.ts"
import { providers } from "ethers"

import { context, Environment } from "./context"

import type {
  Bridge,
  TBTCVault,
  TBTCToken,
} from "@keep-network/tbtc-v2.ts/dist/src/chain"

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
      throw new Error(
        `cannot pick tbtc package for ${context.environment} environment`
      )
    }
  }

  const provider = new providers.JsonRpcProvider(context.ethereumUrl)

  const latestBlock = async () => {
    const block = await provider.getBlock("latest")
    return block.number
  }

  // eslint-disable-next-line @typescript-eslint/no-var-requires,global-require,import/no-dynamic-require
  const bridgeArtifact = require(`${packageName}/artifacts/Bridge.json`)
  const bridge: Bridge = new EthereumBridge({
    address: bridgeArtifact.address,
    signerOrProvider: provider,
    deployedAtBlockNumber: bridgeArtifact.receipt.blockNumber,
  })

  // eslint-disable-next-line @typescript-eslint/no-var-requires,global-require,import/no-dynamic-require
  const tbtcVaultArtifact = require(`${packageName}/artifacts/TBTCVault.json`)
  const tbtcVault: TBTCVault = new EthereumTBTCVault({
    address: tbtcVaultArtifact.address,
    signerOrProvider: provider,
    deployedAtBlockNumber: tbtcVaultArtifact.receipt.blockNumber,
  })

  // eslint-disable-next-line @typescript-eslint/no-var-requires,global-require,import/no-dynamic-require
  const tbtcTokenArtifact = require(`${packageName}/artifacts/TBTC.json`)
  const tbtcToken: TBTCToken = new EthereumTBTCToken({
    address: tbtcTokenArtifact.address,
    signerOrProvider: provider,
    deployedAtBlockNumber: tbtcTokenArtifact.receipt.blockNumber,
  })

  return { bridge, tbtcVault, tbtcToken, latestBlock }
}

export const contracts = resolve()
