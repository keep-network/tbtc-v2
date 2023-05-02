import { BigNumber } from "ethers"

import { SystemEventType } from "./system-event"
import { context } from "./context"

import type { SystemEvent, Monitor as SystemEventMonitor } from "./system-event"
import type { DepositRevealedEvent as DepositRevealedChainEvent } from "@keep-network/tbtc-v2.ts/dist/src/deposit"
import type { Bridge } from "@keep-network/tbtc-v2.ts/dist/src/chain"

const SATS_PER_BTC = 1e8

const DepositRevealed = (
  chainEvent: DepositRevealedChainEvent
): SystemEvent => ({
  title: "Deposit Revealed",
  type: SystemEventType.Informational,
  data: {
    btcFundingTxHash: `https://mempool.space/tx/${chainEvent.fundingTxHash.toString()}`,
    btcFundingOutputIndex: chainEvent.fundingOutputIndex.toString(),
    amountBTC: (chainEvent.amount / SATS_PER_BTC).toFixed(2),
    ethRevealTxHash: `https://etherscan.io/tx/${chainEvent.transactionHash.toPrefixedString()}`,
  },
  block: chainEvent.blockNumber,
})

const LargeDepositRevealed = (
  chainEvent: DepositRevealedChainEvent
): SystemEvent => ({
  title: "Large Deposit Revealed",
  type: SystemEventType.Warning,
  data: {
    btcFundingTx: `https://mempool.space/tx/${chainEvent.fundingTxHash.toString()}`,
    btcFundingOutputIndex: chainEvent.fundingOutputIndex.toString(),
    amountBTC: (chainEvent.amount / SATS_PER_BTC).toFixed(2),
    ethRevealTxHash: `https://etherscan.io/tx/${chainEvent.transactionHash.toPrefixedString()}`,
    ethRevealTxHash: chainEvent.transactionHash.toPrefixedString(),
  },
  block: chainEvent.blockNumber,
})

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
