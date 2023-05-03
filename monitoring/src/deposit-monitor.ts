import { BigNumber } from "ethers"

import { SystemEventType } from "./system-event"
import { context, Environment } from "./context"

import type { SystemEvent, Monitor as SystemEventMonitor } from "./system-event"
import type { DepositRevealedEvent as DepositRevealedChainEvent } from "@keep-network/tbtc-v2.ts/dist/src/deposit"
import type { Bridge } from "@keep-network/tbtc-v2.ts/dist/src/chain"

const satsToRoundedBTC = (sats: BigNumber): string =>
  (sats.div(BigNumber.from(1e6)).toNumber() / 100).toFixed(2)

const hashUrls = (chainEvent: DepositRevealedChainEvent) => {
  let fundingHashUrlPrefix = ""
  if (context.environment === Environment.Mainnet) {
    fundingHashUrlPrefix = "https://mempool.space/tx/"
  }
  if (context.environment === Environment.Testnet) {
    fundingHashUrlPrefix = "https://mempool.space/testnet/tx/"
  }

  let revealHashUrlPrefix = ""
  if (context.environment === Environment.Mainnet) {
    revealHashUrlPrefix = "https://etherscan.io/tx/"
  }
  if (context.environment === Environment.Testnet) {
    revealHashUrlPrefix = "https://goerli.etherscan.io/tx/"
  }

  const fundingHash = chainEvent.fundingTxHash.toString()
  const transactionHash = chainEvent.transactionHash.toPrefixedString()
  return {
    btcFundingTxHashURL: fundingHashUrlPrefix + fundingHash,
    ethRevealTxHashURL: revealHashUrlPrefix + transactionHash,
  }
}

const DepositRevealed = (
  chainEvent: DepositRevealedChainEvent
): SystemEvent => {
  const { btcFundingTxHashURL, ethRevealTxHashURL } = hashUrls(chainEvent)

  return {
    title: "Deposit revealed",
    type: SystemEventType.Informational,
    data: {
      btcFundingTxHash: chainEvent.fundingTxHash.toString(),
      btcFundingTxHashURL,
      btcFundingOutputIndex: chainEvent.fundingOutputIndex.toString(),
      amountBTC: satsToRoundedBTC(chainEvent.amount),
      ethRevealTxHash: chainEvent.transactionHash.toPrefixedString(),
      ethRevealTxHashURL,
    },
    block: chainEvent.blockNumber,
  }
}

const LargeDepositRevealed = (
  chainEvent: DepositRevealedChainEvent
): SystemEvent => {
  const { btcFundingTxHashURL, ethRevealTxHashURL } = hashUrls(chainEvent)

  return {
    title: "Large deposit revealed",
    type: SystemEventType.Warning,
    data: {
      btcFundingTxHash: chainEvent.fundingTxHash.toString(),
      btcFundingTxHashURL,
      btcFundingOutputIndex: chainEvent.fundingOutputIndex.toString(),
      amountBTC: satsToRoundedBTC(chainEvent.amount),
      ethRevealTxHash: chainEvent.transactionHash.toPrefixedString(),
      ethRevealTxHashURL,
    },
    block: chainEvent.blockNumber,
  }
}

export class DepositMonitor implements SystemEventMonitor {
  private bridge: Bridge

  constructor(bridge: Bridge) {
    this.bridge = bridge
  }

  async check(fromBlock: number, toBlock: number): Promise<SystemEvent[]> {
    // eslint-disable-next-line no-console
    console.log("running deposit monitor check")

    const chainEvents = await this.bridge.getDepositRevealedEvents({
      fromBlock,
      toBlock,
    })

    const systemEvents: SystemEvent[] = []

    // eslint-disable-next-line no-plusplus
    for (let i = 0; i < chainEvents.length; i++) {
      const chainEvent = chainEvents[i]

      systemEvents.push(DepositRevealed(chainEvent))

      if (
        chainEvent.amount.gt(BigNumber.from(context.largeDepositThresholdSat))
      ) {
        systemEvents.push(LargeDepositRevealed(chainEvent))
      }
    }

    // eslint-disable-next-line no-console
    console.log("completed deposit monitor check")

    return systemEvents
  }
}
