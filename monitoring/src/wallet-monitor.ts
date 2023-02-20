import type { SystemEvent, Monitor as SystemEventMonitor } from "./system-event"

export class WalletMonitor implements SystemEventMonitor {
  async check(fromBlock: number, toBlock: number): Promise<SystemEvent[]> {
    // TODO: Implement the wallet monitor.
    console.log(
      `checked stub wallet monitor from block ${fromBlock} to block ${toBlock}`
    )
    return []
  }
}
