import { BigNumber } from "ethers"

import { context } from "./context"
import { SystemEventType } from "./system-event"
import { satsToRoundedBTC } from "./deposit-monitor"
import { createEthTxUrl } from "./block-explorer"

import type { RedemptionRequestedEvent as RedemptionRequestedChainEvent } from "@keep-network/tbtc-v2.ts/dist/src/redemption"
import type { Bridge } from "@keep-network/tbtc-v2.ts/dist/src/chain"
import type { Monitor as SystemEventMonitor, SystemEvent } from "./system-event"

const RedemptionRequested = (
  chainEvent: RedemptionRequestedChainEvent
): SystemEvent => {
  const ethRequestTxHashURL = createEthTxUrl(chainEvent.transactionHash)

  return {
    title: "Redemption requested",
    type: SystemEventType.Informational,
    data: {
      walletPublicKeyHash: chainEvent.walletPublicKeyHash,
      redeemerOutputScript: chainEvent.redeemerOutputScript,
      requestedAmountBTC: satsToRoundedBTC(chainEvent.requestedAmount),
      ethRequestTxHash: chainEvent.transactionHash.toPrefixedString(),
      ethRequestTxHashURL,
    },
    block: chainEvent.blockNumber,
  }
}

const LargeRedemptionRequested = (
  chainEvent: RedemptionRequestedChainEvent
): SystemEvent => {
  const ethRequestTxHashURL = createEthTxUrl(chainEvent.transactionHash)

  return {
    title: "Large redemption requested",
    type: SystemEventType.Warning,
    data: {
      walletPublicKeyHash: chainEvent.walletPublicKeyHash,
      redeemerOutputScript: chainEvent.redeemerOutputScript,
      requestedAmountBTC: satsToRoundedBTC(chainEvent.requestedAmount),
      ethRequestTxHash: chainEvent.transactionHash.toPrefixedString(),
      ethRequestTxHashURL,
    },
    block: chainEvent.blockNumber,
  }
}

export class RedemptionMonitor implements SystemEventMonitor {
  private bridge: Bridge

  constructor(bridge: Bridge) {
    this.bridge = bridge
  }

  async check(fromBlock: number, toBlock: number): Promise<SystemEvent[]> {
    // eslint-disable-next-line no-console
    console.log("running redemption monitor check")

    const chainEvents = await this.bridge.getRedemptionRequestedEvents({
      fromBlock,
      toBlock,
    })

    const systemEvents: SystemEvent[] = []

    // eslint-disable-next-line no-plusplus
    for (let i = 0; i < chainEvents.length; i++) {
      const chainEvent = chainEvents[i]

      systemEvents.push(RedemptionRequested(chainEvent))

      if (
        chainEvent.requestedAmount.gt(
          BigNumber.from(context.largeRedemptionThresholdSat)
        )
      ) {
        systemEvents.push(LargeRedemptionRequested(chainEvent))
      }
    }

    // eslint-disable-next-line no-console
    console.log("completed redemption monitor check")

    return systemEvents
  }
}
