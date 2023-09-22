import { Hex } from "../../hex"
import {
  DkgResultApprovedEvent,
  DkgResultChallengedEvent,
  DkgResultSubmittedEvent,
} from "../../wallet"
import { GetEvents } from "./chain-event"

/**
 * Interface for communication with the WalletRegistry on-chain contract.
 */
export interface WalletRegistry {
  /**
   * Gets the public key for the given wallet.
   * @param walletID ID of the wallet.
   * @returns Uncompressed public key without the 04 prefix.
   */
  getWalletPublicKey(walletID: Hex): Promise<Hex>

  /**
   * Get emitted DkgResultSubmittedEvent events.
   * @see GetEventsFunction
   */
  getDkgResultSubmittedEvents: GetEvents.Function<DkgResultSubmittedEvent>

  /**
   * Get emitted DkgResultApprovedEvent events.
   * @see GetEventsFunction
   */
  getDkgResultApprovedEvents: GetEvents.Function<DkgResultApprovedEvent>

  /**
   * Get emitted DkgResultChallengedEvent events.
   * @see GetEventsFunction
   */
  getDkgResultChallengedEvents: GetEvents.Function<DkgResultChallengedEvent>
}
