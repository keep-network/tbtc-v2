import { BigNumber } from "ethers"
import { Hex } from "./hex"
import { Event } from "./chain"

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
} & Event

/**
 * Represents an event emitted when a DKG result is submitted to the on-chain
 * wallet registry.
 */
export type DkgResultSubmittedEvent = {
  /**
   * 32-byte hash of the submitted DKG result.
   */
  resultHash: Hex
  /**
   * 32-byte seed of the current DKG execution.
   */
  seed: Hex
  /**
   * DKG result object.
   */
  result: DkgResult
} & Event

/**
 * Represents a DKG on-chain result.
 */
export type DkgResult = {
  /**
   * Claimed submitter candidate group member index. Is in range [1, groupSize].
   */
  submitterMemberIndex: BigNumber
  /**
   * Generated group public key.
   */
  groupPubKey: Hex
  /**
   * Array of misbehaved members indices (disqualified or inactive). Indices
   * are in range [1, groupSize], unique, and sorted in ascending order.
   */
  misbehavedMembersIndices: number[]
  /**
   * Concatenation of signatures from members supporting the result.
   * The message to be signed by each member is keccak256 hash of the
   * calculated group public key, misbehaved members indices and DKG
   * start block. The calculated hash is also prefixed with
   * `\x19Ethereum signed message:\n` before signing.
   */
  signatures: Hex
  /**
   * Indices of members corresponding to each signature. Indices are
   * in range [1, groupSize], unique, and sorted in ascending order.
   */
  signingMembersIndices: BigNumber[]
  /**
   * Identifiers of candidate group members as outputted by the group
   * selection protocol.
   */
  members: number[]
  /**
   * Keccak256 hash of group members identifiers that actively took part
   * in DKG (excluding IA/DQ members).
   */
  membersHash: Hex
}
