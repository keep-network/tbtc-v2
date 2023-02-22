import { SystemEventType } from "./system-event"

import type { NewWalletRegisteredEvent as WalletRegisteredChainEvent } from "@keep-network/tbtc-v2.ts/dist/src/wallet"
import type { Bridge } from "@keep-network/tbtc-v2.ts/dist/src/chain"
import type { SystemEvent, Monitor as SystemEventMonitor } from "./system-event"

const WalletRegistered = (
  chainEvent: WalletRegisteredChainEvent
): SystemEvent => ({
  title: "Wallet registered",
  type: SystemEventType.Informational,
  data: {
    ecdsaWalletID: chainEvent.ecdsaWalletID.toPrefixedString(),
    walletPublicKeyHash: chainEvent.walletPublicKeyHash.toString(),
    ethRegisterTxHash: chainEvent.transactionHash.toPrefixedString(),
  },
  block: chainEvent.blockNumber,
})

export class WalletMonitor implements SystemEventMonitor {
  private bridge: Bridge

  constructor(bridge: Bridge) {
    this.bridge = bridge
  }

  async check(fromBlock: number, toBlock: number): Promise<SystemEvent[]> {
    // eslint-disable-next-line no-console
    console.log("running wallet monitor check")

    const chainEvents = await this.bridge.getNewWalletRegisteredEvents({
      fromBlock,
      toBlock,
    })

    // eslint-disable-next-line no-console
    console.log("completed wallet monitor check")

    return chainEvents.map(WalletRegistered)
  }
}
