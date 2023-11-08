import { TBTCContracts } from "../../lib/contracts"
import { BitcoinClient } from "../../lib/bitcoin"
import { OptimisticMinting } from "./optimistic-minting"
import { Spv } from "./spv"

/**
 * Service exposing features relevant to authorized maintainers and
 * operators of the tBTC v2 system.
 */
export class MaintenanceService {
  /**
   * Features for optimistic minting maintainers.
   */
  public readonly optimisticMinting: OptimisticMinting
  /**
   * Features for SPV proof maintainers.
   */
  public readonly spv: Spv

  constructor(tbtcContracts: TBTCContracts, bitcoinClient: BitcoinClient) {
    this.optimisticMinting = new OptimisticMinting(tbtcContracts)
    this.spv = new Spv(tbtcContracts, bitcoinClient)
  }
}
