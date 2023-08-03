import { BigNumber } from "ethers"
import { TransactionHash } from "./bitcoin"
import { Identifier, Event, TBTCVault } from "./chain"
import { Hex } from "./hex"

/**
 * Represents an event that is emitted when a new optimistic minting is requested
 * on chain.
 */
export type OptimisticMintingRequestedEvent = {
  /**
   * Minter's chain identifier.
   */
  minter: Identifier
  /**
   * Unique deposit identifier.
   * @see Bridge.buildDepositKey
   */
  depositKey: Hex
  /**
   * Depositor's chain identifier.
   */
  depositor: Identifier
  /**
   * Amount of tokens requested to mint.
   * This value is in ERC 1e18 precision, it has to be converted before using
   * as Bitcoin value with 1e8 precision in satoshi.
   */
  // TODO: Consider adding a custom type to handle conversion from ERC with 1e18
  //       precision to Bitcoin in 1e8 precision (satoshi).
  amount: BigNumber
  /**
   * Hash of a Bitcoin transaction made to fund the deposit.
   */
  fundingTxHash: TransactionHash
  /**
   * Index of an output in the funding transaction made to fund the deposit.
   */
  fundingOutputIndex: number
} & Event

/**
 * Represents an event that is emitted when an optimistic minting request
 * is cancelled on chain.
 */
export type OptimisticMintingCancelledEvent = {
  /**
   * Guardian's chain identifier.
   */
  guardian: Identifier
  /**
   * Unique deposit identifier.
   * @see Bridge.buildDepositKey
   */
  depositKey: Hex
} & Event

/**
 * Represents an event that is emitted when an optimistic minting request
 * is finalized on chain.
 */
export type OptimisticMintingFinalizedEvent = {
  /**
   * Minter's chain identifier.
   */
  minter: Identifier
  /**
   * Unique deposit identifier.
   * @see Bridge.buildDepositKey
   */
  depositKey: Hex
  /**
   * Depositor's chain identifier.
   */
  depositor: Identifier
  /**
   * Value of the new optimistic minting debt of the depositor.
   * This value is in ERC 1e18 precision, it has to be converted before using
   * as Bitcoin value with 1e8 precision in satoshi.
   */
  // TODO: Consider adding a custom type to handle conversion from ERC with 1e18
  //       precision to Bitcoin in 1e8 precision (satoshi).
  optimisticMintingDebt: BigNumber
} & Event

/**
 * Represents optimistic minting request for the given deposit revealed to the
 * Bridge.
 */
export type OptimisticMintingRequest = {
  /**
   * UNIX timestamp at which the optimistic minting was requested.
   */
  requestedAt: number
  /**
   * UNIX timestamp at which the optimistic minting was finalized.
   * 0 if not yet finalized.
   */
  finalizedAt: number
}

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
