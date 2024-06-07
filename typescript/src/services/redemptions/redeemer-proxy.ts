import { ChainIdentifier } from "../../lib/contracts"
import { Hex } from "../../lib/utils"

/**
 * Interface defining functions required to route tBTC redemption requests through
 * the tBTC bridge by custom integrators.
 */
export interface RedeemerProxy {
  /**
   * Chain identifier of the redeemer. This is the address that will be able to
   * claim the tBTC tokens if anything goes wrong during the redemption process.
   */
  redeemerAddress(): ChainIdentifier

  /**
   * Requests redemption of tBTC token with determined redemption data.
   * @param redemptionData Data required to redeem the tBTC tokens.
   * @returns Target chain hash of the request redemption transaction
   *          (for example, Ethereum transaction hash)
   */
  requestRedemption(redemptionData: Hex): Promise<Hex>
}
