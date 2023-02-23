import { SystemEventType } from "./system-event"

import type {
  OptimisticMintingCancelledEvent as OptimisticMintingCancelledChainEvent,
  OptimisticMintingRequestedEvent as OptimisticMintingRequestedChainEvent,
} from "@keep-network/tbtc-v2.ts/dist/src/optimistic-minting"
import type {
  Bridge,
  Identifier,
  TBTCVault,
} from "@keep-network/tbtc-v2.ts/dist/src/chain"
import type { Client as BitcoinClient } from "@keep-network/tbtc-v2.ts/dist/src/bitcoin"
import type { BitcoinTransactionHash } from "@keep-network/tbtc-v2.ts"
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

const DesignatedMinterNotRequestedMinting = (
  chainEvent: OptimisticMintingRequestedChainEvent,
  designatedMinter: Identifier
): SystemEvent => ({
  title: "Designated minter has not requested minting",
  type: SystemEventType.Warning,
  data: {
    actualMinter: `0x${chainEvent.minter.identifierHex}`,
    designatedMinter: `0x${designatedMinter.identifierHex}`,
    depositKey: chainEvent.depositKey.toPrefixedString(),
    depositor: `0x${chainEvent.depositor.identifierHex}`,
    amountSat: chainEvent.amount.div(satoshiMultiplier).toString(),
    btcFundingTxHash: chainEvent.fundingTxHash.toString(),
    btcFundingOutputIndex: chainEvent.fundingOutputIndex.toString(),
    ethRequestTxHash: chainEvent.transactionHash.toPrefixedString(),
  },
  block: chainEvent.blockNumber,
})

// Helper type grouping all chain data relevant for the minting monitor.
// It allows fetching the data once and reusing them multiple times to
// generate appropriate system events.
type ChainDataAggregate = {
  mintingCancelledEvents: OptimisticMintingCancelledChainEvent[]
  mintingRequestedEvents: OptimisticMintingRequestedChainEvent[]
  minters: Identifier[]
}

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

    const chainData = await this.fetchChainData(fromBlock, toBlock)

    const systemEvents: SystemEvent[] = []

    systemEvents.push(...this.checkMintingCancels(chainData))

    systemEvents.push(...(await this.checkMintingRequestsValidity(chainData)))

    systemEvents.push(...this.checkDesignatedMintersHealth(chainData))

    // eslint-disable-next-line no-console
    console.log("completed minting monitor check")

    return systemEvents
  }

  private async fetchChainData(
    fromBlock: number,
    toBlock: number
  ): Promise<ChainDataAggregate> {
    const options = {
      fromBlock,
      toBlock,
    }

    return {
      mintingCancelledEvents:
        await this.tbtcVault.getOptimisticMintingCancelledEvents(options),
      mintingRequestedEvents:
        await this.tbtcVault.getOptimisticMintingRequestedEvents(options),
      minters: await this.tbtcVault.getMinters(),
    }
  }

  private checkMintingCancels(chainData: ChainDataAggregate) {
    return chainData.mintingCancelledEvents.map(OptimisticMintingCancelled)
  }

  private async checkMintingRequestsValidity(chainData: ChainDataAggregate) {
    const confirmations = await Promise.allSettled(
      chainData.mintingRequestedEvents.map((ce) =>
        this.btcClient.getTransactionConfirmations(ce.fundingTxHash)
      )
    )

    const systemEvents: SystemEvent[] = []

    chainData.mintingRequestedEvents.forEach((ce, index) => {
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

  private checkDesignatedMintersHealth(chainData: ChainDataAggregate) {
    const systemEvents: SystemEvent[] = []

    chainData.mintingRequestedEvents
      .map((mre) => ({
        ...mre,
        designatedMinter: this.getDesignatedMinter(
          chainData,
          mre.depositor,
          mre.fundingTxHash
        ),
      }))
      .filter((mre) => !mre.minter.equals(mre.designatedMinter))
      .map((mre) =>
        DesignatedMinterNotRequestedMinting(mre, mre.designatedMinter)
      )
      .forEach((se) => systemEvents.push(se))

    // TODO: Detect finalizations done by non-designated minters.

    return systemEvents
  }

  private getDesignatedMinter(
    chainData: ChainDataAggregate,
    depositor: Identifier,
    fundingTxHash: BitcoinTransactionHash
  ): Identifier {
    const d = depositor.identifierHex.slice(-1).charCodeAt(0)
    const f = fundingTxHash.toString().slice(-1).charCodeAt(0)

    // eslint-disable-next-line no-bitwise
    const index = (d ^ f) % chainData.minters.length

    return chainData.minters[index]
  }
}
