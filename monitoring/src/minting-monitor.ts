import { SystemEventType } from "./system-event"

import type {
  OptimisticMintingCancelledEvent as OptimisticMintingCancelledChainEvent,
  OptimisticMintingRequestedEvent as OptimisticMintingRequestedChainEvent,
} from "@keep-network/tbtc-v2.ts/dist/src/optimistic-minting"
import type { Bridge, TBTCVault } from "@keep-network/tbtc-v2.ts/dist/src/chain"
import type { Client as BitcoinClient } from "@keep-network/tbtc-v2.ts/dist/src/bitcoin"
import type { SystemEvent, Monitor as SystemEventMonitor } from "./system-event"
import type { BigNumber } from "ethers"

const satoshiMultiplier = 1e10

const OptimisticMintingCancelled = (
  chainEvent: OptimisticMintingCancelledChainEvent
): SystemEvent => ({
  title: "Optimistic minting cancelled",
  type: SystemEventType.Warning,
  data: {
    guardian: `0x${chainEvent.guardian.identifierHex}`,
    depositKey: chainEvent.depositKey.toPrefixedString(),
    ethCancelTxHash: chainEvent.transactionHash.toPrefixedString(),
  },
  block: chainEvent.blockNumber,
})

const OptimisticMintingRequestedTooEarly = (
  chainEvent: OptimisticMintingRequestedChainEvent,
  btcFundingTxActualConfirmations: number,
  btcFundingTxRequiredConfirmations: number
): SystemEvent => ({
  title: "Optimistic minting requested too early",
  type: SystemEventType.Critical,
  data: {
    minter: `0x${chainEvent.minter.identifierHex}`,
    depositKey: chainEvent.depositKey.toPrefixedString(),
    depositor: `0x${chainEvent.depositor.identifierHex}`,
    amountSat: chainEvent.amount.div(satoshiMultiplier).toString(),
    btcFundingTxHash: chainEvent.fundingTxHash.toString(),
    btcFundingOutputIndex: chainEvent.fundingOutputIndex.toString(),
    btcFundingTxActualConfirmations: btcFundingTxActualConfirmations.toString(),
    btcFundingTxRequiredConfirmations:
      btcFundingTxRequiredConfirmations.toString(),
    ethRequestTxHash: chainEvent.transactionHash.toPrefixedString(),
  },
  block: chainEvent.blockNumber,
})

// This event is raised in case one can't determine the confirmations count
// for the given deposit funding transaction pointed by the OM request.
// We cannot determine the exact cause. Example cases are:
// - A problem with the BTC client that doesn't handle requests properly
// - Deliberate behavior of the used client implementation that
//   throws in case of a non-existing BTC transaction. Such a case may indicate
//   an evil minter that requested OM for non-existing funding transaction.
// That said, the monitoring should warn about it and force the on-call
// person to investigate the problem.
const OptimisticMintingRequestedForUndeterminedBtcTx = (
  chainEvent: OptimisticMintingRequestedChainEvent,
  btcClientResponse: string
): SystemEvent => ({
  title: "Optimistic minting requested for undetermined Bitcoin transaction",
  type: SystemEventType.Critical,
  data: {
    minter: `0x${chainEvent.minter.identifierHex}`,
    depositKey: chainEvent.depositKey.toPrefixedString(),
    depositor: `0x${chainEvent.depositor.identifierHex}`,
    amountSat: chainEvent.amount.div(satoshiMultiplier).toString(),
    btcFundingTxHash: chainEvent.fundingTxHash.toString(),
    btcFundingOutputIndex: chainEvent.fundingOutputIndex.toString(),
    btcClientResponse,
    ethRequestTxHash: chainEvent.transactionHash.toPrefixedString(),
  },
  block: chainEvent.blockNumber,
})

export class MintingMonitor implements SystemEventMonitor {
  private bridge: Bridge

  private tbtcVault: TBTCVault

  private btcClient: BitcoinClient

  constructor(bridge: Bridge, tbtcVault: TBTCVault, btcClient: BitcoinClient) {
    this.bridge = bridge
    this.tbtcVault = tbtcVault
    this.btcClient = btcClient
  }

  async check(fromBlock: number, toBlock: number): Promise<SystemEvent[]> {
    // eslint-disable-next-line no-console
    console.log("running minting monitor check")

    const systemEvents: SystemEvent[] = []

    systemEvents.push(...(await this.checkCancelledEvents(fromBlock, toBlock)))

    systemEvents.push(...(await this.checkRequestedEvents(fromBlock, toBlock)))

    // eslint-disable-next-line no-console
    console.log("completed minting monitor check")

    return systemEvents
  }

  private async checkCancelledEvents(fromBlock: number, toBlock: number) {
    const chainEvents =
      await this.tbtcVault.getOptimisticMintingCancelledEvents({
        fromBlock,
        toBlock,
      })

    return chainEvents.map(OptimisticMintingCancelled)
  }

  private async checkRequestedEvents(fromBlock: number, toBlock: number) {
    const chainEvents =
      await this.tbtcVault.getOptimisticMintingRequestedEvents({
        fromBlock,
        toBlock,
      })

    const confirmations = await Promise.allSettled(
      chainEvents.map((ce) =>
        this.btcClient.getTransactionConfirmations(ce.fundingTxHash)
      )
    )

    const systemEvents: SystemEvent[] = []

    chainEvents.forEach((ce, index) => {
      const confirmation = confirmations[index]

      switch (confirmation.status) {
        case "fulfilled": {
          const actualConfirmations = confirmation.value
          const requiredConfirmations = this.requiredConfirmations(
            ce.amount.div(satoshiMultiplier)
          )

          if (actualConfirmations < requiredConfirmations) {
            systemEvents.push(
              OptimisticMintingRequestedTooEarly(
                ce,
                actualConfirmations,
                requiredConfirmations
              )
            )
          }
          break
        }
        case "rejected": {
          systemEvents.push(
            OptimisticMintingRequestedForUndeterminedBtcTx(
              ce,
              `${confirmation.reason}`
            )
          )

          break
        }
      }
    })

    return systemEvents
  }

  private requiredConfirmations(amountSat: BigNumber): number {
    if (amountSat.lt(10000000)) {
      // 0.1 BTC
      return 1
    }

    if (amountSat.lt(100000000)) {
      // 1 BTC
      return 3
    }

    return 6
  }
}
