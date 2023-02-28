import { SystemEventType } from "./system-event"

import type { BigNumber } from "ethers"
import type { TBTCToken } from "@keep-network/tbtc-v2.ts/dist/src/chain"
import type { Monitor as SystemEventMonitor, SystemEvent } from "./system-event"

// The block span the supply change is checked for. It is 12 hours expressed
// in ETH blocks, assuming 12 seconds per block on average.
const totalSupplyBlockSpan = (12 * 60 * 60) / 12

const totalSupplyChangeThreshold = 10 // 10%

const HighTotalSupplyChange = (
  difference: BigNumber,
  change: BigNumber,
  threshold: number,
  referenceBlock: number,
  currentBlock: number
): SystemEvent => ({
  title: "High TBTC token total supply change",
  type: SystemEventType.Critical,
  data: {
    change: `${difference.gte(0) ? "+" : "-"}${change.toString()}%`,
    threshold: `${threshold}%`,
    referenceBlock: referenceBlock.toString(),
  },
  block: currentBlock,
})

export interface SupplyMonitorPersistence {
  lastHighTotalSupplyChangeBlock: () => Promise<number>
  updateLastHighTotalSupplyChangeBlock: (block: number) => Promise<void>
}

export class SupplyMonitor implements SystemEventMonitor {
  private tbtcToken: TBTCToken

  private persistence: SupplyMonitorPersistence

  constructor(tbtcToken: TBTCToken, persistence: SupplyMonitorPersistence) {
    this.tbtcToken = tbtcToken
    this.persistence = persistence
  }

  async check(fromBlock: number, toBlock: number): Promise<SystemEvent[]> {
    // eslint-disable-next-line no-console
    console.log("running supply monitor check")

    // By default, the supply change is checked between the current and
    // reference blocks.
    const currentBlock = toBlock
    let referenceBlock =
      currentBlock - totalSupplyBlockSpan > 0
        ? currentBlock - totalSupplyBlockSpan
        : 0
    let threshold = totalSupplyChangeThreshold

    // Check the default reference block against the last high total supply change
    // event block. If the event already occurred in the checked block window,
    // the monitor uses the event block as reference in order to not produce
    // a duplicated event. Since the checked window is shorter, the threshold
    // is reduced by half.
    const lastEventBlock =
      await this.persistence.lastHighTotalSupplyChangeBlock()
    if (lastEventBlock > referenceBlock) {
      referenceBlock = lastEventBlock
      threshold = totalSupplyChangeThreshold / 2
    }

    const referenceSupply = await this.tbtcToken.totalSupply(referenceBlock)
    const currentSupply = await this.tbtcToken.totalSupply(currentBlock)

    const difference = currentSupply.sub(referenceSupply)
    // There is a precision loss here, but it is acceptable as long as the
    // threshold is at least 1%.
    const change = difference.abs().mul(100).div(referenceSupply)

    const systemEvents: SystemEvent[] = []

    // Check >= to catch cases when the change was bigger than threshold by
    // the decimal part but was rounded down to an integer.
    if (change.gte(threshold)) {
      systemEvents.push(
        HighTotalSupplyChange(
          difference,
          change,
          threshold,
          referenceBlock,
          currentBlock
        )
      )

      await this.persistence.updateLastHighTotalSupplyChangeBlock(currentBlock)
    }

    // eslint-disable-next-line no-console
    console.log("completed supply monitor check")

    return systemEvents
  }
}
