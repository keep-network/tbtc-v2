import { TransactionHash } from "./lib/bitcoin"
import { TBTCVault, OptimisticMintingRequest } from "./lib/contracts"
import { Hex } from "./lib/utils"

/**
 * Requests optimistic minting for a deposit on chain.
 * @param depositTxHash The revealed deposit transaction's hash.
 * @param depositOutputIndex Index of the deposit transaction output that
 *        funds the revealed deposit.
 * @param tbtcVault Handle to the TBTCVault on-chain contract
 * @returns Transaction hash of the optimistic mint request transaction.
 */
export async function requestOptimisticMint(
  depositTxHash: TransactionHash,
  depositOutputIndex: number,
  tbtcVault: TBTCVault
): Promise<Hex> {
  return await tbtcVault.requestOptimisticMint(
    depositTxHash,
    depositOutputIndex
  )
}

/**
 * Cancels optimistic minting for a deposit on chain.
 * @param depositTxHash The revealed deposit transaction's hash.
 * @param depositOutputIndex Index of the deposit transaction output that
 *        funds the revealed deposit.
 * @param tbtcVault Handle to the TBTCVault on-chain contract
 * @returns Transaction hash of the optimistic mint cancel transaction.
 */
export async function cancelOptimisticMint(
  depositTxHash: TransactionHash,
  depositOutputIndex: number,
  tbtcVault: TBTCVault
): Promise<Hex> {
  return await tbtcVault.cancelOptimisticMint(depositTxHash, depositOutputIndex)
}

/**
 * Finalizes optimistic minting for a deposit on chain.
 * @param depositTxHash The revealed deposit transaction's hash.
 * @param depositOutputIndex Index of the deposit transaction output that
 *        funds the revealed deposit.
 * @param tbtcVault Handle to the TBTCVault on-chain contract
 * @returns Transaction hash of the optimistic mint finalize transaction.
 */
export async function finalizeOptimisticMint(
  depositTxHash: TransactionHash,
  depositOutputIndex: number,
  tbtcVault: TBTCVault
): Promise<Hex> {
  return await tbtcVault.finalizeOptimisticMint(
    depositTxHash,
    depositOutputIndex
  )
}

/**
 * Gets optimistic minting request for a deposit from chain.
 * @param depositTxHash The revealed deposit transaction's hash.
 * @param depositOutputIndex Index of the deposit transaction output that
 *        funds the revealed deposit.
 * @param tbtcVault Handle to the TBTCVault on-chain contract
 * @returns Optimistic minting request.
 */
export async function getOptimisticMintingRequest(
  depositTxHash: TransactionHash,
  depositOutputIndex: number,
  tbtcVault: TBTCVault
): Promise<OptimisticMintingRequest> {
  return await tbtcVault.optimisticMintingRequests(
    depositTxHash,
    depositOutputIndex
  )
}
