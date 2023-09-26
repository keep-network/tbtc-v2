import { BigNumber } from "ethers"
import {
  BitcoinSpvProof,
  BitcoinUtxo,
  BitcoinRawTxVectors,
  BitcoinTxHash,
} from "../bitcoin"
import { Hex } from "../utils"
import { ChainEvent, GetChainEvents } from "./chain-event"
import { ChainIdentifier } from "./chain-identifier"
import { WalletRegistry } from "./wallet-registry"

/**
 * Interface for communication with the Bridge on-chain contract.
 */
export interface Bridge {
  /**
   * Get emitted DepositRevealed events.
   * @see GetEventsFunction
   */
  getDepositRevealedEvents: GetChainEvents.Function<DepositRevealedEvent>

  /**
   * Submits a deposit sweep transaction proof to the on-chain contract.
   * @param sweepTx - Sweep transaction data.
   * @param sweepProof - Sweep proof data.
   * @param mainUtxo - Data of the wallet's main UTXO.
   * @param vault - Optional identifier of the vault the swept deposits should
   *        be routed in.
   */
  submitDepositSweepProof(
    sweepTx: BitcoinRawTxVectors,
    sweepProof: BitcoinSpvProof,
    mainUtxo: BitcoinUtxo,
    vault?: ChainIdentifier
  ): Promise<void>

  /**
   * Reveals a given deposit to the on-chain contract.
   * @param depositTx - Deposit transaction data
   * @param depositOutputIndex - Index of the deposit transaction output that
   *        funds the revealed deposit
   * @param deposit - Data of the revealed deposit
   * @param vault - Optional parameter denoting the vault the given deposit
   *        should be routed to
   * @returns Transaction hash of the reveal deposit transaction as string
   */
  revealDeposit(
    depositTx: BitcoinRawTxVectors,
    depositOutputIndex: number,
    deposit: DepositReceipt,
    vault?: ChainIdentifier
  ): Promise<string> // TODO: Update to Hex

  /**
   * Gets a revealed deposit from the on-chain contract.
   * @param depositTxHash The revealed deposit transaction's hash.
   * @param depositOutputIndex Index of the deposit transaction output that
   *        funds the revealed deposit.
   * @returns Revealed deposit data.
   */
  deposits(
    depositTxHash: BitcoinTxHash,
    depositOutputIndex: number
  ): Promise<DepositRequest>

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
    mainUtxo: BitcoinUtxo,
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
    redemptionTx: BitcoinRawTxVectors,
    redemptionProof: BitcoinSpvProof,
    mainUtxo: BitcoinUtxo,
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
  getNewWalletRegisteredEvents: GetChainEvents.Function<NewWalletRegisteredEvent>

  /**
   * Returns the attached WalletRegistry instance.
   */
  walletRegistry(): Promise<WalletRegistry>

  /**
   * Gets details about a registered wallet.
   * @param walletPublicKeyHash The 20-byte wallet public key hash (computed
   * using Bitcoin HASH160 over the compressed ECDSA public key).
   * @returns Promise with the wallet details.
   */
  wallets(walletPublicKeyHash: Hex): Promise<Wallet>

  /**
   * Builds the UTXO hash based on the UTXO components.
   * @param utxo UTXO components.
   * @returns The hash of the UTXO.
   */
  buildUtxoHash(utxo: BitcoinUtxo): Hex

  /**
   * Get emitted RedemptionRequested events.
   * @see GetEventsFunction
   */
  getRedemptionRequestedEvents: GetChainEvents.Function<RedemptionRequestedEvent>
}

// TODO: Replace all properties that are expected to be un-prefixed hexadecimal
// strings with a Hex type.

/**
 * Represents a deposit receipt. The receipt holds all information required
 * to build a unique deposit address on Bitcoin chain.
 */
export interface DepositReceipt {
  /**
   * Depositor's chain identifier.
   */
  depositor: ChainIdentifier

  /**
   * An 8-byte blinding factor as an un-prefixed hex string. Must be unique
   * for the given depositor, wallet public key and refund public key.
   */
  blindingFactor: string

  /**
   * Public key hash of the wallet that is meant to receive the deposit. Must
   * be an unprefixed hex string (without 0x prefix).
   *
   * You can use `computeHash160` function to get the hash from a plain text public key.
   */
  walletPublicKeyHash: string

  /**
   * Public key hash that is meant to be used during deposit refund after the
   * locktime passes. Must be an unprefixed hex string (without 0x prefix).
   *
   * You can use `computeHash160` function to get the hash from a plain text public key.
   */
  refundPublicKeyHash: string

  /**
   * A 4-byte little-endian refund locktime as an un-prefixed hex string.
   */
  refundLocktime: string
}

/**
 * Represents a deposit request revealed to the on-chain bridge.
 */
export interface DepositRequest {
  /**
   * Depositor's chain identifier.
   */
  depositor: ChainIdentifier

  /**
   * Deposit amount in satoshis.
   */
  amount: BigNumber

  /**
   * Optional identifier of the vault the deposit should be routed in.
   */
  vault?: ChainIdentifier

  /**
   * UNIX timestamp the deposit was revealed at.
   */
  revealedAt: number
  /**
   * UNIX timestamp the request was swept at. If not swept yet, this parameter
   * should have zero as value.
   */
  sweptAt: number
  /**
   * Value of the treasury fee calculated for this revealed deposit.
   * Denominated in satoshi.
   */
  treasuryFee: BigNumber
}

/**
 * Represents an event emitted on deposit reveal to the on-chain bridge.
 */
export type DepositRevealedEvent = DepositReceipt &
  Pick<DepositRequest, "amount" | "vault"> & {
    fundingTxHash: BitcoinTxHash
    fundingOutputIndex: number
  } & ChainEvent

/**
 * Represents a redemption request.
 */
export interface RedemptionRequest {
  /**
   * On-chain identifier of the redeemer.
   */
  redeemer: ChainIdentifier

  /**
   * The output script the redeemed Bitcoin funds are locked to. It is un-prefixed
   * and is not prepended with length.
   */
  redeemerOutputScript: string

  /**
   * The amount of Bitcoins in satoshis that is requested to be redeemed.
   * The actual value of the output in the Bitcoin transaction will be decreased
   * by the sum of the fee share and the treasury fee for this particular output.
   */
  requestedAmount: BigNumber

  /**
   * The amount of Bitcoins in satoshis that is subtracted from the amount of
   * the redemption request and used to pay the treasury fee.
   * The value should be exactly equal to the value of treasury fee in the Bridge
   * on-chain contract at the time the redemption request was made.
   */
  treasuryFee: BigNumber

  /**
   * The maximum amount of Bitcoins in satoshis that can be subtracted from the
   * redemption's `requestedAmount` to pay the transaction network fee.
   */
  txMaxFee: BigNumber

  /**
   * UNIX timestamp the request was created at.
   */
  requestedAt: number
}

/**
 * Represents an event emitted on redemption request.
 */
export type RedemptionRequestedEvent = Omit<
  RedemptionRequest,
  "requestedAt"
> & {
  /**
   * Public key hash of the wallet that is meant to handle the redemption. Must
   * be an unprefixed hex string (without 0x prefix).
   */
  walletPublicKeyHash: string
} & ChainEvent

/* eslint-disable no-unused-vars */
export enum WalletState {
  /**
   * The wallet is unknown to the Bridge.
   */
  Unknown = 0,
  /**
   * The wallet can sweep deposits and accept redemption requests.
   */
  Live = 1,
  /**
   * The wallet was deemed unhealthy and is expected to move their outstanding
   * funds to another wallet. The wallet can still fulfill their pending redemption
   * requests although new redemption requests and new deposit reveals are not
   * accepted.
   */
  MovingFunds = 2,
  /**
   *  The wallet moved or redeemed all their funds and is in the
   * losing period where it is still a subject of fraud challenges
   * and must defend against them.
   *  */
  Closing = 3,
  /**
   * The wallet finalized the closing period successfully and can no longer perform
   * any action in the Bridge.
   * */
  Closed = 4,
  /**
   * The wallet committed a fraud that was reported, did not move funds to
   * another wallet before a timeout, or did not sweep funds moved to if from
   * another wallet before a timeout. The wallet is blocked and can not perform
   * any actions in the Bridge.
   */
  Terminated = 5,
}
/* eslint-enable no-unused-vars */

// eslint-disable-next-line @typescript-eslint/no-namespace
export namespace WalletState {
  export function parse(val: number): WalletState {
    return (
      (<never>WalletState)[
        Object.keys(WalletState)[
          Object.values(WalletState).indexOf(val as WalletState)
        ]
      ] ?? WalletState.Unknown
    )
  }
}

/**
 * Represents a deposit.
 */
export interface Wallet {
  /**
   * Identifier of a ECDSA Wallet registered in the ECDSA Wallet Registry.
   */
  ecdsaWalletID: Hex
  /**
   * Compressed public key of the ECDSA Wallet.
   */
  walletPublicKey: Hex
  /**
   * Latest wallet's main UTXO hash.
   */
  mainUtxoHash: Hex
  /**
   * The total redeemable value of pending redemption requests targeting that wallet.
   */
  pendingRedemptionsValue: BigNumber
  /**
   * UNIX timestamp the wallet was created at.
   */
  createdAt: number
  /**
   * UNIX timestamp indicating the moment the wallet was requested to move their
   * funds.
   */
  movingFundsRequestedAt: number
  /**
   * UNIX timestamp indicating the moment the wallet's closing period started.
   */
  closingStartedAt: number
  /**
   * Total count of pending moved funds sweep requests targeting this wallet.
   */
  pendingMovedFundsSweepRequestsCount: number
  /**
   * Current state of the wallet.
   */
  state: WalletState
  /**
   * Moving funds target wallet commitment submitted by the wallet.
   */
  movingFundsTargetWalletsCommitmentHash: Hex
}

/**
 * Represents an event emitted when new wallet is registered on the on-chain bridge.
 */
export type NewWalletRegisteredEvent = {
  /**
   * Identifier of a ECDSA Wallet registered in the ECDSA Wallet Registry.
   */
  ecdsaWalletID: Hex
  /**
   * 20-byte public key hash of the ECDSA Wallet. It is computed by applying
   * hash160 on the compressed public key of the ECDSA Wallet.
   */
  walletPublicKeyHash: Hex
} & ChainEvent
