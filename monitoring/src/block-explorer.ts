import { context, Environment } from "./context"

import type { BitcoinTransactionHash, Hex } from "@keep-network/tbtc-v2.ts"

const ethTxUrlPrefixMapping = {
  [Environment.Mainnet]: "https://etherscan.io/tx",
  [Environment.Testnet]: "https://goerli.etherscan.io/tx",
}

export function createEthTxUrl(txHash: Hex) {
  return `${
    ethTxUrlPrefixMapping[context.environment]
  }/${txHash.toPrefixedString()}`
}

const btcTxUrlPrefixMapping = {
  [Environment.Mainnet]: "https://mempool.space/tx",
  [Environment.Testnet]: "https://mempool.space/testnet/tx",
}

export function createBtcTxUrl(txHash: BitcoinTransactionHash) {
  return `${btcTxUrlPrefixMapping[context.environment]}/${txHash.toString()}`
}
