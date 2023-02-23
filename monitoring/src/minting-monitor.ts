import { OptimisticMinting } from "@keep-network/tbtc-v2.ts"

import { SystemEventType } from "./system-event"

import type {
  OptimisticMintingCancelledEvent as OptimisticMintingCancelledChainEvent,
  OptimisticMintingRequestedEvent as OptimisticMintingRequestedChainEvent,
} from "@keep-network/tbtc-v2.ts/dist/src/optimistic-minting"
import type { DepositRevealedEvent as DepositRevealedChainEvent } from "@keep-network/tbtc-v2.ts/dist/src/deposit"
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

// Number of blocks the monitor gives for minters to create a minting
// request for the given deposit, counted from the deposit reveal block.
// The value is 2 hours which is 600 blocks assuming 12 seconds for ETH block.
// This value aims to include:
// - worst case 6 BTC confirmations of the deposit, i.e. ~60 min assuming
//   10 min for BTC block
// - 20 minutes of the designated minter precedence period
// - 40 minutes of additional margin
const mintingRequestTimeoutBlocks = 600

// Number of blocks the monitor gives for minters to finalize the
// minting request, counted from the minting request block.
// The value is the current optimistic minting delay plus 1 hour, converted
// to blocks assuming 12 seconds for ETH block. The value aims to include:
// - optimistic minting delay
// - 20 minutes of the designated minter precedence period
// - 40 minutes of additional margin
const mintingFinalizationTimeoutBlocks = (optimisticMintingDelay: number) =>
  optimisticMintingDelay / 12 + 300

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

const OptimisticMintingNotRequestedByDesignatedMinter = (
  chainEvent: OptimisticMintingRequestedChainEvent,
  designatedMinter: Identifier
): SystemEvent => ({
  title: "Optimistic minting was not requested by designated minter",
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

const OptimisticMintingNotRequestedByAnyMinter = (
  chainEvent: DepositRevealedChainEvent
): SystemEvent => ({
  title: "Optimistic minting was not requested by any minter",
  type: SystemEventType.Warning,
  data: {
    btcFundingTxHash: chainEvent.fundingTxHash.toString(),
    btcFundingOutputIndex: chainEvent.fundingOutputIndex.toString(),
    amountSat: chainEvent.amount.toString(),
    ethRevealTxHash: chainEvent.transactionHash.toPrefixedString(),
  },
  block: chainEvent.blockNumber,
})

// Cache that holds some chain data relevant for the minting monitor.
// Allows fetching the data once and reusing them multiple times across the monitor.
type ChainDataCache = {
  mintingCancelledEvents: OptimisticMintingCancelledChainEvent[]
  mintingRequestedEvents: OptimisticMintingRequestedChainEvent[]
  minters: Identifier[]
  optimisticMintingDelay: number
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

    const cache = await this.loadChainDataCache(fromBlock, toBlock)

    const systemEvents: SystemEvent[] = []
    systemEvents.push(...this.checkMintingCancels(cache))
    systemEvents.push(...(await this.checkMintingRequestsValidity(cache)))
    systemEvents.push(...this.checkDesignatedMintersHealth(cache))
    systemEvents.push(
      ...(await this.checkOrphanedMinting(cache, fromBlock, toBlock))
    )

    // eslint-disable-next-line no-console
    console.log("completed minting monitor check")

    return systemEvents
  }

  private async loadChainDataCache(
    fromBlock: number,
    toBlock: number
  ): Promise<ChainDataCache> {
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
      optimisticMintingDelay: await this.tbtcVault.optimisticMintingDelay(),
    }
  }

  private checkMintingCancels(cache: ChainDataCache) {
    return cache.mintingCancelledEvents.map(OptimisticMintingCancelled)
  }

  private async checkMintingRequestsValidity(cache: ChainDataCache) {
    const confirmations = await Promise.allSettled(
      cache.mintingRequestedEvents.map((ce) =>
        this.btcClient.getTransactionConfirmations(ce.fundingTxHash)
      )
    )

    const systemEvents: SystemEvent[] = []

    cache.mintingRequestedEvents.forEach((ce, index) => {
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

  private checkDesignatedMintersHealth(cache: ChainDataCache) {
    const systemEvents: SystemEvent[] = []

    cache.mintingRequestedEvents
      .map((mre) => ({
        ...mre,
        designatedMinter: this.getDesignatedMinter(
          cache.minters,
          mre.depositor,
          mre.fundingTxHash
        ),
      }))
      .filter((mre) => !mre.minter.equals(mre.designatedMinter))
      .map((mre) =>
        OptimisticMintingNotRequestedByDesignatedMinter(
          mre,
          mre.designatedMinter
        )
      )
      .forEach((se) => systemEvents.push(se))

    // TODO: Detect finalizations done by non-designated minters.

    return systemEvents
  }

  private getDesignatedMinter(
    minters: Identifier[],
    depositor: Identifier,
    fundingTxHash: BitcoinTransactionHash
  ): Identifier {
    const d = depositor.identifierHex.slice(-1).charCodeAt(0)
    const f = fundingTxHash.toString().slice(-1).charCodeAt(0)

    // eslint-disable-next-line no-bitwise
    const index = (d ^ f) % minters.length

    return minters[index]
  }

  private async checkOrphanedMinting(
    cache: ChainDataCache,
    fromBlock: number,
    toBlock: number
  ) {
    const systemEvents: SystemEvent[] = []

    systemEvents.push(
      ...(await this.checkMintingNotRequested(fromBlock, toBlock))
    )

    // TODO: Check minting not finalized.

    return systemEvents
  }

  private async checkMintingNotRequested(fromBlock: number, toBlock: number) {
    const rewindBlock = (block: number, shift: number) =>
      block - shift > 0 ? block - shift : 0

    // We need to rewind the block window by the minting request timeout.
    // This way, we are looking for past deposits whose time for creating
    // the minting request was already elapsed.
    const chainEvents = await this.bridge.getDepositRevealedEvents({
      fromBlock: rewindBlock(fromBlock, mintingRequestTimeoutBlocks),
      toBlock: rewindBlock(toBlock, mintingRequestTimeoutBlocks),
    })

    const mintingRequests = await Promise.allSettled(
      chainEvents.map((ce) =>
        OptimisticMinting.getOptimisticMintingRequest(
          ce.fundingTxHash,
          ce.fundingOutputIndex,
          this.tbtcVault
        )
      )
    )

    return chainEvents
      .filter((ce, index) => {
        const request = mintingRequests[index]
        const requestExists =
          request.status === "fulfilled" && request.value.requestedAt !== 0
        return !requestExists
      })
      .map(OptimisticMintingNotRequestedByAnyMinter)
  }
}
