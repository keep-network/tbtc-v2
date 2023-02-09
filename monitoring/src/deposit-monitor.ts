import {
  SystemEvent,
  Monitor as SystemEventMonitor,
  SystemEventType
} from "./system-event"
import type {
  DepositRevealedEvent as  DepositRevealedChainEvent
} from "@keep-network/tbtc-v2.ts/dist/src/deposit"
import type { Bridge } from "@keep-network/tbtc-v2.ts/dist/src/chain"
import { BigNumber } from "ethers"

const DepositRevealed = (chainEvent: DepositRevealedChainEvent): SystemEvent => ({
  title: "Deposit revealed",
  type: SystemEventType.Informational,
  data: {
    btcFundingTxHash: chainEvent.fundingTxHash.toString(),
    btcFundingOutputIndex: chainEvent.fundingOutputIndex.toString(),
    amount: chainEvent.amount.toString(),
    ethRevealTxHash: chainEvent.transactionHash.toPrefixedString(),
  }
})

const LargeDepositRevealed = (chainEvent: DepositRevealedChainEvent): SystemEvent => ({
  title: "Large deposit revealed",
  type: SystemEventType.Warning,
  data: {
    btcFundingTxHash: chainEvent.fundingTxHash.toString(),
    btcFundingOutputIndex: chainEvent.fundingOutputIndex.toString(),
    amount: chainEvent.amount.toString(),
    ethRevealTxHash: chainEvent.transactionHash.toPrefixedString(),
  }
})

export class DepositMonitor implements SystemEventMonitor {
  private bridge: Bridge

  constructor(bridge: Bridge) {
    this.bridge = bridge
  }

  async check(fromBlock: number, toBlock: number): Promise<SystemEvent[]> {
    const chainEvents = await this.bridge.getDepositRevealedEvents({
      fromBlock,
      toBlock
    })

    const systemEvents: SystemEvent[] = []

    for (let i = 0; i < chainEvents.length; i++) {
      const chainEvent = chainEvents[i]

      systemEvents.push(DepositRevealed(chainEvent))

      // TODO: Parametrize the threshold.
      if (chainEvent.amount.gt(BigNumber.from(1000000000))) { // 10 BTC
        systemEvents.push(LargeDepositRevealed(chainEvent))
      }
    }

    return systemEvents
  }
}