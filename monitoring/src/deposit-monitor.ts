import { Incident, Monitor as IncidentMonitor, Severity as IncidentSeverity } from "./incident"
import type { DepositRevealedEvent } from "@keep-network/tbtc-v2.ts/dist/src/deposit"
import type { Bridge } from "@keep-network/tbtc-v2.ts/dist/src/chain"
import { BigNumber } from "ethers"

const DepositRevealedIncident = (event: DepositRevealedEvent) => ({
  title: "Deposit revealed",
  severity: IncidentSeverity.Minor,
  btcFundingTxHash: event.fundingTxHash.toString(),
  btcFundingOutputIndex: event.fundingOutputIndex,
  amount: event.amount.toNumber(),
  ethRevealTxHash: event.transactionHash.toPrefixedString(),
})

const LargeDepositRevealedIncident = (event: DepositRevealedEvent) => ({
  title: "Large deposit revealed",
  severity: IncidentSeverity.Major,
  btcFundingTxHash: event.fundingTxHash.toString(),
  btcFundingOutputIndex: event.fundingOutputIndex,
  amount: event.amount.toNumber(),
  ethRevealTxHash: event.transactionHash.toPrefixedString(),
})

export class DepositMonitor implements IncidentMonitor {
  private bridge: Bridge

  constructor(bridge: Bridge) {
    this.bridge = bridge
  }

  async check(fromBlock: number, toBlock: number): Promise<Incident[]> {
    const events = await this.bridge.getDepositRevealedEvents({
      fromBlock,
      toBlock
    })

    const incidents: Incident[] = []

    for (let i = 0; i < events.length; i++) {
      const event = events[0]

      incidents.push(DepositRevealedIncident(event))

      // TODO: Parametrize the threshold.
      if (event.amount.gt(BigNumber.from(1000000000))) { // 10 BTC
        incidents.push(LargeDepositRevealedIncident(event))
      }
    }

    return incidents
  }
}