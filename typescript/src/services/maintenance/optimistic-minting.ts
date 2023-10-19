import { BitcoinTxHash } from "../../lib/bitcoin"
import { OptimisticMintingRequest } from "../../lib/contracts"
import { Hex } from "../../lib/utils"
import { TBTCContracts } from "../../lib/contracts"

export class OptimisticMinting {
  private readonly tbtcContracts: TBTCContracts

  constructor(tbtcContracts: TBTCContracts) {
    this.tbtcContracts = tbtcContracts
  }

  /**
   * Requests optimistic minting for a deposit on chain.
   * @param depositTxHash The revealed deposit transaction's hash.
   * @param depositOutputIndex Index of the deposit transaction output that
   *        funds the revealed deposit.
   * @returns Transaction hash of the optimistic mint request transaction.
   */
  async requestMint(
    depositTxHash: BitcoinTxHash,
    depositOutputIndex: number
  ): Promise<Hex> {
    return this.tbtcContracts.tbtcVault.requestOptimisticMint(
      depositTxHash,
      depositOutputIndex
    )
  }

  /**
   * Cancels optimistic minting for a deposit on chain.
   * @param depositTxHash The revealed deposit transaction's hash.
   * @param depositOutputIndex Index of the deposit transaction output that
   *        funds the revealed deposit.
   * @returns Transaction hash of the optimistic mint cancel transaction.
   */
  async cancelMint(
    depositTxHash: BitcoinTxHash,
    depositOutputIndex: number
  ): Promise<Hex> {
    return this.tbtcContracts.tbtcVault.cancelOptimisticMint(
      depositTxHash,
      depositOutputIndex
    )
  }

  /**
   * Finalizes optimistic minting for a deposit on chain.
   * @param depositTxHash The revealed deposit transaction's hash.
   * @param depositOutputIndex Index of the deposit transaction output that
   *        funds the revealed deposit.
   * @returns Transaction hash of the optimistic mint finalize transaction.
   */
  async finalizeMint(
    depositTxHash: BitcoinTxHash,
    depositOutputIndex: number
  ): Promise<Hex> {
    return this.tbtcContracts.tbtcVault.finalizeOptimisticMint(
      depositTxHash,
      depositOutputIndex
    )
  }

  /**
   * Gets optimistic minting request for a deposit from chain.
   * @param depositTxHash The revealed deposit transaction's hash.
   * @param depositOutputIndex Index of the deposit transaction output that
   *        funds the revealed deposit.
   * @returns Optimistic minting request.
   */
  async getMintingRequest(
    depositTxHash: BitcoinTxHash,
    depositOutputIndex: number
  ): Promise<OptimisticMintingRequest> {
    return this.tbtcContracts.tbtcVault.optimisticMintingRequests(
      depositTxHash,
      depositOutputIndex
    )
  }
}
