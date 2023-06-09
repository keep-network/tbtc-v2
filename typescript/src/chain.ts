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
  OptimisticMintingCancelledEvent,
  OptimisticMintingFinalizedEvent,
  OptimisticMintingRequest,
  OptimisticMintingRequestedEvent,
} from "./optimistic-minting"
import { Hex } from "./hex"
import { RedemptionRequest } from "./redemption"
import {
  DkgResultApprovedEvent,
  DkgResultChallengedEvent,
  DkgResultSubmittedEvent,
  NewWalletRegisteredEvent,
} from "./wallet"
import type { ExecutionLoggerFn } from "./backoff"

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

export namespace GetEvents {
  /**
   * Represents generic options used for getting events from the chain.
   */
  export interface Options {
    /**
     * Block number from which events should be queried.
     * If not defined a block number of a contract deployment is used.
     */
    fromBlock?: number
    /**
     * Block number to which events should be queried.
     * If not defined the latest block number will be used.
     */
    toBlock?: number
    /**
     * Number of retries in case of an error getting the events.
     */
    retries?: number
    /**
     * Number of blocks for interval length in partial events pulls.
     */
    batchedQueryBlockInterval?: number
    /**
     * A logger function to pass execution messages.
     */
    logger?: ExecutionLoggerFn
  }

  /**
   * Represents a generic function to get events emitted on the chain.
   */
  export interface Function<T extends Event> {
    /**
     * Get emitted events.
     * @param options Options for getting events.
     * @param filterArgs Arguments for events filtering.
     * @returns Array of found events.
     */
    (options?: Options, ...filterArgs: Array<any>): Promise<T[]>
  }
}

/**
 * Interface for communication with the Bridge on-chain contract.
 */
export interface Bridge {
  /**
   * Get emitted DepositRevealed events.
   * @see GetEventsFunction
   */
  getDepositRevealedEvents: GetEvents.Function<DepositRevealedEvent>

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

  /**
   * Get emitted NewWalletRegisteredEvent events.
   * @see GetEventsFunction
   */
  getNewWalletRegisteredEvents: GetEvents.Function<NewWalletRegisteredEvent>

  /**
   * Returns the attached WalletRegistry instance.
   */
  walletRegistry(): Promise<WalletRegistry>

  /**
   * Builds the redemption data required to request a redemption via
   * @see TBTCToken#approveAndCall - the built data should be passed as
   * `extraData` the @see TBTCToken#approveAndCall function.
   * @param redeemer On-chain identifier of the redeemer.
   * @param walletPublicKey The Bitcoin public key of the wallet. Must be in the
   *        compressed form (33 bytes long with 02 or 03 prefix).
   * @param mainUtxo The main UTXO of the wallet. Must match the main UTXO
   *        held by the on-chain Bridge contract.
   * @param redeemerOutputScript The output script that the redeemed funds will
   *        be locked to. Must be un-prefixed and not prepended with length.
   * @returns The
   */
  buildRedemptionData(
    redeemer: Identifier,
    walletPublicKey: string,
    mainUtxo: UnspentTransactionOutput,
    redeemerOutputScript: string
  ): Hex
}

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

/**
 * Interface for communication with the TBTC v2 token on-chain contract.
 */
export interface TBTCToken {
  /**
   * Gets the total supply of the TBTC v2 token. The returned value is in
   * ERC 1e18 precision, it has to be converted before using as Bitcoin value
   * with 1e8 precision in satoshi.
   * @param blockNumber Optional parameter determining the block the total
   *        supply should be fetched for. If this parameter is not set, the
   *        total supply is taken for the latest block.
   */
  // TODO: Consider adding a custom type to handle conversion from ERC with 1e18
  //       precision to Bitcoin in 1e8 precision (satoshi).
  totalSupply(blockNumber?: number): Promise<BigNumber>

  /**
   * Calls `receiveApproval` function on spender previously approving the spender
   * to withdraw from the caller multiple times, up to the `amount` amount. If
   * this function is called again, it overwrites the current allowance with
   * `amount`.
   * @param spender Address of contract authorized to spend.
   * @param amount The max amount they can spend.
   * @param extraData Extra information to send to the approved contract.
   * @returns Transaction hash of the approve and call transaction.
   */
  approveAndCall(
    spender: Identifier,
    amount: BigNumber,
    extraData: Hex
  ): Promise<Hex>
}
