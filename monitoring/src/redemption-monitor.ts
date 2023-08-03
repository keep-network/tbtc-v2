import { BigNumber } from "ethers"
import { Hex } from "@keep-network/tbtc-v2.ts"

import { context } from "./context"
import { SystemEventType } from "./system-event"
import { satsToRoundedBTC } from "./deposit-monitor"
import { createEthTxUrl } from "./block-explorer"
import { contracts } from "./contracts"

import type { Monitor as SystemEventMonitor, SystemEvent } from "./system-event"
import type { RedemptionRequestedEvent as RedemptionRequestedChainEvent } from "@keep-network/tbtc-v2.ts/dist/src/redemption"
import type { Bridge } from "@keep-network/tbtc-v2.ts/dist/src/chain"

// The time after which a pending redemption request is considered stale.
// Typically, a redemption request processing time should not exceed 5 hours.
// A redemption request pending for 8 hours indicates that something is wrong.
// This value is expressed in blocks, assuming 12 seconds per block.
const redemptionRequestStaleBlocks = (8 * 60 * 60) / 12

const RedemptionRequested = (
  chainEvent: RedemptionRequestedChainEvent
): SystemEvent => {
  const ethRequestTxHashURL = createEthTxUrl(chainEvent.transactionHash)

  return {
    title: "Redemption requested",
    type: SystemEventType.Informational,
    data: {
      walletPublicKeyHash: chainEvent.walletPublicKeyHash,
      redeemerOutputScript: chainEvent.redeemerOutputScript,
      requestedAmountBTC: satsToRoundedBTC(chainEvent.requestedAmount),
      ethRequestTxHash: chainEvent.transactionHash.toPrefixedString(),
      ethRequestTxHashURL,
    },
    block: chainEvent.blockNumber,
  }
}

const LargeRedemptionRequested = (
  chainEvent: RedemptionRequestedChainEvent
): SystemEvent => {
  const ethRequestTxHashURL = createEthTxUrl(chainEvent.transactionHash)

  return {
    title: "Large redemption requested",
    type: SystemEventType.Warning,
    data: {
      walletPublicKeyHash: chainEvent.walletPublicKeyHash,
      redeemerOutputScript: chainEvent.redeemerOutputScript,
      requestedAmountBTC: satsToRoundedBTC(chainEvent.requestedAmount),
      ethRequestTxHash: chainEvent.transactionHash.toPrefixedString(),
      ethRequestTxHashURL,
    },
    block: chainEvent.blockNumber,
  }
}

const StaleRedemption = (
  chainEvent: RedemptionRequestedChainEvent
): SystemEvent => {
  const ethRequestTxHashURL = createEthTxUrl(chainEvent.transactionHash)

  return {
    title: "Stale redemption",
    type: SystemEventType.Warning,
    data: {
      walletPublicKeyHash: chainEvent.walletPublicKeyHash,
      redeemerOutputScript: chainEvent.redeemerOutputScript,
      requestedAmountBTC: satsToRoundedBTC(chainEvent.requestedAmount),
      ethRequestTxHash: chainEvent.transactionHash.toPrefixedString(),
      ethRequestTxHashURL,
    },
    block: chainEvent.blockNumber,
  }
}

export class RedemptionMonitor implements SystemEventMonitor {
  private bridge: Bridge

  constructor(bridge: Bridge) {
    this.bridge = bridge
  }

  async check(fromBlock: number, toBlock: number): Promise<SystemEvent[]> {
    // eslint-disable-next-line no-console
    console.log("running redemption monitor check")

    const systemEvents: SystemEvent[] = []
    systemEvents.push(
      ...(await this.checkRequestedRedemptions(fromBlock, toBlock))
    )
    systemEvents.push(...(await this.checkStaleRedemptions(fromBlock, toBlock)))

    // eslint-disable-next-line no-console
    console.log("completed redemption monitor check")

    return systemEvents
  }

  private async checkRequestedRedemptions(
    fromBlock: number,
    toBlock: number
  ): Promise<SystemEvent[]> {
    const chainEvents = await this.bridge.getRedemptionRequestedEvents({
      fromBlock,
      toBlock,
    })

    const systemEvents: SystemEvent[] = []

    // eslint-disable-next-line no-plusplus
    for (let i = 0; i < chainEvents.length; i++) {
      const chainEvent = chainEvents[i]

      systemEvents.push(RedemptionRequested(chainEvent))

      if (
        chainEvent.requestedAmount.gt(
          BigNumber.from(context.largeRedemptionThresholdSat)
        )
      ) {
        systemEvents.push(LargeRedemptionRequested(chainEvent))
      }
    }

    return systemEvents
  }

  private async checkStaleRedemptions(
    fromBlock: number,
    toBlock: number
  ): Promise<SystemEvent[]> {
    const rewindBlock = (block: number, shift: number) =>
      block - shift > 0 ? block - shift : 0

    // We need to rewind the block window by the minting request timeout.
    // This way, we are looking for past deposits whose time for creating
    // the minting request was already elapsed.
    const chainEvents = await this.bridge.getRedemptionRequestedEvents({
      fromBlock: rewindBlock(fromBlock, redemptionRequestStaleBlocks),
      toBlock: rewindBlock(toBlock, redemptionRequestStaleBlocks),
    })

    const chainEventsTimestamps = await Promise.all(
      chainEvents.map((ce) => contracts.blockTimestamp(ce.blockNumber))
    )

    // To fetch pending redemptions requests, we need to know the plain-text
    // public keys of the wallets used by the given chain events. In order to
    // achieve that, we build a cache where the key is the wallet public key
    // hash and the value is the wallet plain text public key.
    //
    // TODO: This can be optimized by refactoring the Bridge.pendingRedemptions
    //       method to accept wallet public key hashes directly.
    const walletCache = new Map<string, string>()
    // eslint-disable-next-line no-plusplus
    for (let i = 0; i < chainEvents.length; i++) {
      const { walletPublicKeyHash } = chainEvents[i]

      if (!walletCache.has(walletPublicKeyHash)) {
        // eslint-disable-next-line no-await-in-loop
        const wallet = await this.bridge.wallets(Hex.from(walletPublicKeyHash))
        walletCache.set(walletPublicKeyHash, wallet.walletPublicKey.toString())
      }
    }

    const pendingRedemptionsRequests = await Promise.all(
      chainEvents.map((ce) =>
        this.bridge.pendingRedemptions(
          // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
          walletCache.get(ce.walletPublicKeyHash)!,
          ce.redeemerOutputScript
        )
      )
    )

    return chainEvents
      .filter((ce, index) => {
        const pendingRedemptionRequest = pendingRedemptionsRequests[index]
        const chainEventTimestamp = chainEventsTimestamps[index]

        // To consider a redemption as stale, the redemption request must be
        // still pending after redemptionRequestStaleBlocks. As there can
        // be multiple redemption requests for the given wallet and
        // redeemer output script pair, we need to make sure the pending
        // redemption request timestamp matches the timestamp of the given
        // chain event emission block.
        return (
          pendingRedemptionRequest.requestedAt !== 0 &&
          pendingRedemptionRequest.requestedAt === chainEventTimestamp
        )
      })
      .map(StaleRedemption)
  }
}
