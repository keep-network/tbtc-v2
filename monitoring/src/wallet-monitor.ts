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
    ecdsaWalletID: chainEvent.ecdsaWalletID.toString(),
    walletPublicKeyHash: chainEvent.walletPublicKeyHash.toString(),
    ethRegistrationTxHash: chainEvent.transactionHash.toPrefixedString(),
  },
  block: chainEvent.blockNumber,
})

export class WalletMonitor implements SystemEventMonitor {
  private bridge: Bridge

  constructor(bridge: Bridge) {
    this.bridge = bridge
  }

  async check(fromBlock: number, toBlock: number): Promise<SystemEvent[]> {
    const chainEvents = await this.bridge.getNewWalletRegisteredEvents({
      fromBlock,
      toBlock,
    })

    return chainEvents.map(WalletRegistered)
  }
}
