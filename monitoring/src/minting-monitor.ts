import type { SystemEvent, Monitor as SystemEventMonitor } from "./system-event"

export class MintingMonitor implements SystemEventMonitor {
  async check(fromBlock: number, toBlock: number): Promise<SystemEvent[]> {
    // TODO: Implement the minting monitor.
    console.log(
      `checked stub minting monitor from block ${fromBlock} to block ${toBlock}`
    )
    return []
  }
}
