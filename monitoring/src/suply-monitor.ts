import { SystemEventType } from "./system-event"

import type { TBTCToken } from "@keep-network/tbtc-v2.ts/dist/src/chain"
import type { Monitor as SystemEventMonitor, SystemEvent } from "./system-event"

// The block span the supply change is checked for. It is 12 hours expressed
// in ETH blocks, assuming 12 seconds per block on average.
const totalSupplyBlockSpan = (12 * 60 * 60) / 12

const totalSupplyChangeThreshold = 10 // 10%

const HighTotalSupplyChange = (
  percentageChange: string,
  block: number
): SystemEvent => ({
  title: "High TBTC token total supply change",
  type: SystemEventType.Critical,
  data: {
    percentageChange,
  },
  block,
})

export class SupplyMonitor implements SystemEventMonitor {
  private tbtcToken: TBTCToken

  constructor(tbtcToken: TBTCToken) {
    this.tbtcToken = tbtcToken
  }

  // TODO: This check must be improved as it can produce a series of alerts
  //       referring to the same supply increase. This is because the monitoring
  //       interval is much shorter than the supply check span.
  async check(fromBlock: number, toBlock: number): Promise<SystemEvent[]> {
    // eslint-disable-next-line no-console
    console.log("running supply monitor check")

    const pastBlock =
      toBlock - totalSupplyBlockSpan > 0 ? toBlock - totalSupplyBlockSpan : 0

    const pastSupply = await this.tbtcToken.totalSupply(pastBlock)
    const currentSupply = await this.tbtcToken.totalSupply()

    const diff = currentSupply.sub(pastSupply)
    const percentageChange = diff.abs().div(pastSupply).mul(100)

    const systemEvents: SystemEvent[] = []

    if (percentageChange.gt(totalSupplyChangeThreshold)) {
      const sign = diff.gte(0) ? "+" : "-"

      systemEvents.push(
        HighTotalSupplyChange(`${sign}${percentageChange.toString()}%`, toBlock)
      )
    }

    // eslint-disable-next-line no-console
    console.log("completed supply monitor check")

    return systemEvents
  }
}
