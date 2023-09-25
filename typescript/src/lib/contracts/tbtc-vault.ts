import { TransactionHash } from "../bitcoin"
import { Hex } from "../utils"
import {
  OptimisticMintingCancelledEvent,
  OptimisticMintingFinalizedEvent,
  OptimisticMintingRequest,
  OptimisticMintingRequestedEvent,
} from "../../optimistic-minting"
import { Identifier } from "./chain-identifier"
import { GetEvents } from "./chain-event"

/**
 * Interface for communication with the TBTCVault on-chain contract.
 */
export interface TBTCVault {
  /**
   * Gets optimistic minting delay.
   *
   * The time that needs to pass between the moment the optimistic minting is
   * requested and the moment optimistic minting is finalized with minting TBTC.
   * @returns Optimistic Minting Delay in seconds.
   */
  optimisticMintingDelay(): Promise<number>

  /**
   * Gets currently registered minters.
   *
   * @returns Array containing identifiers of all currently registered minters.
   */
  getMinters(): Promise<Identifier[]>

  /**
   * Checks if given identifier is registered as minter.
   *
   * @param identifier Chain identifier to check.
   */
  isMinter(identifier: Identifier): Promise<boolean>

  /**
   * Checks if given identifier is registered as guardian.
   *
   * @param identifier Chain identifier to check.
   */
  isGuardian(identifier: Identifier): Promise<boolean>

  /**
   * Requests optimistic minting for a deposit in an on-chain contract.
   *
   * @param depositTxHash The revealed deposit transaction's hash.
   * @param depositOutputIndex Index of the deposit transaction output that
   *        funds the revealed deposit.
   * @returns Transaction hash of the optimistic mint request transaction.
   */
  requestOptimisticMint(
    depositTxHash: TransactionHash,
    depositOutputIndex: number
  ): Promise<Hex>

  /**
   * Cancels optimistic minting for a deposit in an on-chain contract.
   *
   * @param depositTxHash The revealed deposit transaction's hash.
   * @param depositOutputIndex Index of the deposit transaction output that
   *        funds the revealed deposit.
   * @returns Transaction hash of the optimistic mint cancel transaction.
   */
  cancelOptimisticMint(
    depositTxHash: TransactionHash,
    depositOutputIndex: number
  ): Promise<Hex>

  /**
   * Finalizes optimistic minting for a deposit in an on-chain contract.
   *
   * @param depositTxHash The revealed deposit transaction's hash.
   * @param depositOutputIndex Index of the deposit transaction output that
   *        funds the revealed deposit.
   * @returns Transaction hash of the optimistic mint finalize transaction.
   */
  finalizeOptimisticMint(
    depositTxHash: TransactionHash,
    depositOutputIndex: number
  ): Promise<Hex>

  /**
   * Gets optimistic minting request for a deposit.
   * @param depositTxHash The revealed deposit transaction's hash.
   * @param depositOutputIndex Index of the deposit transaction output that
   *        funds the revealed deposit.
   * @returns Optimistic minting request.
   */
  optimisticMintingRequests(
    depositTxHash: TransactionHash,
    depositOutputIndex: number
  ): Promise<OptimisticMintingRequest>

  /**
   * Get emitted OptimisticMintingRequested events.
   * @see GetEventsFunction
   */
  getOptimisticMintingRequestedEvents: GetEvents.Function<OptimisticMintingRequestedEvent>

  /**
   * Get emitted OptimisticMintingCancelled events.
   * @see GetEventsFunction
   */
  getOptimisticMintingCancelledEvents: GetEvents.Function<OptimisticMintingCancelledEvent>

  /**
   * Get emitted OptimisticMintingFinalized events.
   * @see GetEventsFunction
   */
  getOptimisticMintingFinalizedEvents: GetEvents.Function<OptimisticMintingFinalizedEvent>
}
