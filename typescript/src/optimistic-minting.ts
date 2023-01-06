import { BigNumber } from "ethers"
import { TransactionHash } from "./bitcoin"
import { Identifier, Event, TBTCVault } from "./chain"

export type OptimisticMintingRequestedEvent = {
  minter: Identifier
  depositKey: BigNumber
  depositor: Identifier
  amount: BigNumber
  fundingTxHash: TransactionHash
  fundingOutputIndex: number
} & Event

export type OptimisticMintingRequest = {
  requestedAt: number
  finalizedAt: number
}

/**
 * Requests optimistic minting for a deposit on chain.
 * @param depositTxHash The revealed deposit transaction's hash.
 * @param depositOutputIndex Index of the deposit transaction output that
 *        funds the revealed deposit.
 * @param tbtcVault Handle to the TBTCVault on-chain contract
 * @returns Transaction hash of the optimistic mint request transaction as string.
 */
export async function requestOptimisticMint(
  depositTxHash: TransactionHash,
  depositOutputIndex: number,
  tbtcVault: TBTCVault
): Promise<string> {
  return await tbtcVault.requestOptimisticMint(
    depositTxHash,
    depositOutputIndex
  )
}
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
