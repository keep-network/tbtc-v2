import { BigNumber } from "ethers"
import {
  Proof,
  UnspentTransactionOutput,
  DecomposedRawTransaction,
  TransactionHash,
} from "./bitcoin"
import {
  DepositRevealedEvent,
  DepositScriptParameters,
  RevealedDeposit,
} from "./deposit"
import {
  OptimisticMintingRequest,
  OptimisticMintingRequestedEvent,
} from "./optimistic-minting"
import { Hex } from "./hex"
import { RedemptionRequest } from "./redemption"

/**
 * Represents a generic chain identifier.
 */
export interface Identifier {
  /**
   * Identifier as an un-prefixed hex string.
   */
  identifierHex: string
  /**
   * Checks if two identifiers are equal.
   *
   * @param identifier Another identifier
   */
  equals(identifier: Identifier): boolean
}

/**
 * Represents a generic chain event.
 */
export interface Event {
  /**
   * Block number of the event emission.
   */
  blockNumber: number
  /**
   * Block hash of the event emission.
   */
  blockHash: Hex
  /**
   * Transaction hash within which the event was emitted.
   */
  transactionHash: Hex
}

/**
 * Represents a generic function to get events emitted on the chain.
 */
export interface GetEventsFunction<T extends Event> {
  /**
   * Get emitted events.
   * @param fromBlock Block number from which events should be queried.
   *        If not defined a block number of a contract deployment is used.
   * @param toBlock Block number to which events should be queried.
   *        If not defined the latest block number will be used.
   * @param filterArgs Arguments for events filtering.
   * @returns Array of found events.
   */
  (fromBlock?: number, toBlock?: number, ...filterArgs: Array<any>): Promise<
    T[]
  >
}

/**
 * Interface for communication with the Bridge on-chain contract.
 */
export interface Bridge {
  /**
   * Get emitted DepositRevealed events.
   * @see GetEventsFunction
   */
  getDepositRevealedEvents: GetEventsFunction<DepositRevealedEvent>

  /**
   * Submits a deposit sweep transaction proof to the on-chain contract.
   * @param sweepTx - Sweep transaction data.
   * @param sweepProof - Sweep proof data.
   * @param mainUtxo - Data of the wallet's main UTXO.
   * @param vault - Optional identifier of the vault the swept deposits should
   *        be routed in.
   */
  submitDepositSweepProof(
    sweepTx: DecomposedRawTransaction,
    sweepProof: Proof,
    mainUtxo: UnspentTransactionOutput,
    vault?: Identifier
  ): Promise<void>

  /**
   * Reveals a given deposit to the on-chain contract.
   * @param depositTx - Deposit transaction data
   * @param depositOutputIndex - Index of the deposit transaction output that
   *        funds the revealed deposit
   * @param deposit - Data of the revealed deposit
   * @returns Transaction hash of the reveal deposit transaction as string
   */
  revealDeposit(
    depositTx: DecomposedRawTransaction,
    depositOutputIndex: number,
    deposit: DepositScriptParameters,
    vault?: Identifier
  ): Promise<string> // TODO: Update to Hex

  /**
   * Gets a revealed deposit from the on-chain contract.
   * @param depositTxHash The revealed deposit transaction's hash.
   * @param depositOutputIndex Index of the deposit transaction output that
   *        funds the revealed deposit.
   * @returns Revealed deposit data.
   */
  deposits(
    depositTxHash: TransactionHash,
    depositOutputIndex: number
  ): Promise<RevealedDeposit>

  /**
   * Requests a redemption from the on-chain contract.
   * @param walletPublicKey - The Bitcoin public key of the wallet. Must be in the
   *        compressed form (33 bytes long with 02 or 03 prefix).
   * @param mainUtxo - The main UTXO of the wallet. Must match the main UTXO
   *        held by the on-chain contract.
   * @param redeemerOutputScript - The output script that the redeemed funds will
   *        be locked to. Must be un-prefixed and not prepended with length.
   * @param amount - The amount to be redeemed in satoshis.
   * @returns Empty promise.
   */
  requestRedemption(
    walletPublicKey: string,
    mainUtxo: UnspentTransactionOutput,
    redeemerOutputScript: string,
    amount: BigNumber
  ): Promise<void>

  /**
   * Submits a redemption transaction proof to the on-chain contract.
   * @param redemptionTx - Redemption transaction data
   * @param redemptionProof - Redemption proof data
   * @param mainUtxo - Data of the wallet's main UTXO
   * @param walletPublicKey - Bitcoin public key of the wallet. Must be in the
   *        compressed form (33 bytes long with 02 or 03 prefix).
   */
  submitRedemptionProof(
    redemptionTx: DecomposedRawTransaction,
    redemptionProof: Proof,
    mainUtxo: UnspentTransactionOutput,
    walletPublicKey: string
  ): Promise<void>

  /**
   * Gets transaction proof difficulty factor from the on-chain contract.
   * @dev This number signifies how many confirmations a transaction has to
   *      accumulate before it can be proven on-chain.
   * @returns Proof difficulty factor.
   */
  txProofDifficultyFactor(): Promise<number>

  /**
   * Gets a pending redemption from the on-chain contract.
   * @param walletPublicKey Bitcoin public key of the wallet the request is
   *        targeted to. Must be in the compressed form (33 bytes long with 02
   *        or 03 prefix).
   * @param redeemerOutputScript The redeemer output script the redeemed funds
   *        are supposed to be locked on. Must be un-prefixed and not prepended
   *        with length.
   * @returns Promise with the pending redemption.
   */
  pendingRedemptions(
    walletPublicKey: string,
    redeemerOutputScript: string
  ): Promise<RedemptionRequest>

  /**
   * Gets a timed-out redemption from the on-chain contract.
   * @param walletPublicKey Bitcoin public key of the wallet the request is
   *        targeted to. Must be in the compressed form (33 bytes long with 02
   *        or 03 prefix).
   * @param redeemerOutputScript The redeemer output script the redeemed funds
   *        are supposed to be locked on. Must be un-prefixed and not prepended
   *        with length.
   * @returns Promise with the pending redemption.
   */
  timedOutRedemptions(
    walletPublicKey: string,
    redeemerOutputScript: string
  ): Promise<RedemptionRequest>

  /**
   * Gets the public key of the current active wallet.
   * @returns Compressed (33 bytes long with 02 or 03 prefix) active wallet's
   *          public key. If there is no active wallet at the moment, undefined
   *          is returned.
   */
  activeWalletPublicKey(): Promise<string | undefined>
}

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
   * @param tbtcVault Handle to the TBTCVault on-chain contract
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
  getOptimisticMintingRequestedEvents: GetEventsFunction<OptimisticMintingRequestedEvent>
}
