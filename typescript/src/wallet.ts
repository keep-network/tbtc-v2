import { BigNumber } from "ethers"
import { Hex } from "./lib/utils"
import { Bridge, Event, Identifier } from "./lib/contracts"
import {
  Client as BitcoinClient,
  BitcoinNetwork,
  createOutputScriptFromAddress,
  encodeToBitcoinAddress,
  TransactionOutput,
  UnspentTransactionOutput,
} from "./lib/bitcoin"

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
 * Represents an event emitted when a DKG result is approved on the on-chain
 * wallet registry.
 */
export type DkgResultApprovedEvent = {
  /**
   * 32-byte hash of the submitted DKG result.
   */
  resultHash: Hex
  /**
   * Approver's chain identifier.
   */
  approver: Identifier
} & Event

/**
 * Represents an event emitted when a DKG result is challenged on the on-chain
 * wallet registry.
 */
export type DkgResultChallengedEvent = {
  /**
   * 32-byte hash of the submitted DKG result.
   */
  resultHash: Hex
  /**
   * Challenger's chain identifier.
   */
  challenger: Identifier
  /**
   * Reason of the challenge.
   */
  reason: string
} & Event

/**
 * Represents a DKG on-chain result.
 */
type DkgResult = {
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

/**
 * Determines the plain-text wallet main UTXO currently registered in the
 * Bridge on-chain contract. The returned main UTXO can be undefined if the
 * wallet does not have a main UTXO registered in the Bridge at the moment.
 *
 * WARNING: THIS FUNCTION CANNOT DETERMINE THE MAIN UTXO IF IT COMES FROM A
 * BITCOIN TRANSACTION THAT IS NOT ONE OF THE LATEST FIVE TRANSACTIONS
 * TARGETING THE GIVEN WALLET PUBLIC KEY HASH. HOWEVER, SUCH A CASE IS
 * VERY UNLIKELY.
 *
 * @param walletPublicKeyHash - Public key hash of the wallet.
 * @param bridge - The handle to the Bridge on-chain contract.
 * @param bitcoinClient - Bitcoin client used to interact with the network.
 * @param bitcoinNetwork - Bitcoin network.
 * @returns Promise holding the wallet main UTXO or undefined value.
 */
export async function determineWalletMainUtxo(
  walletPublicKeyHash: Hex,
  bridge: Bridge,
  bitcoinClient: BitcoinClient,
  bitcoinNetwork: BitcoinNetwork
): Promise<UnspentTransactionOutput | undefined> {
  const { mainUtxoHash } = await bridge.wallets(walletPublicKeyHash)

  // Valid case when the wallet doesn't have a main UTXO registered into
  // the Bridge.
  if (
    mainUtxoHash.equals(
      Hex.from(
        "0x0000000000000000000000000000000000000000000000000000000000000000"
      )
    )
  ) {
    return undefined
  }

  // Declare a helper function that will try to determine the main UTXO for
  // the given wallet address type.
  const determine = async (
    witnessAddress: boolean
  ): Promise<UnspentTransactionOutput | undefined> => {
    // Build the wallet Bitcoin address based on its public key hash.
    const walletAddress = encodeToBitcoinAddress(
      walletPublicKeyHash.toString(),
      witnessAddress,
      bitcoinNetwork
    )

    // Get the wallet transaction history. The wallet main UTXO registered in the
    // Bridge almost always comes from the latest BTC transaction made by the wallet.
    // However, there may be cases where the BTC transaction was made but their
    // SPV proof is not yet submitted to the Bridge thus the registered main UTXO
    // points to the second last BTC transaction. In theory, such a gap between
    // the actual latest BTC transaction and the registered main UTXO in the
    // Bridge may be even wider. The exact behavior is a wallet implementation
    // detail and not a protocol invariant so, it may be subject of changes.
    // To cover the worst possible cases, we always take the five latest
    // transactions made by the wallet for consideration.
    const walletTransactions = await bitcoinClient.getTransactionHistory(
      walletAddress,
      5
    )

    // Get the wallet script based on the wallet address. This is required
    // to find transaction outputs that lock funds on the wallet.
    const walletScript = createOutputScriptFromAddress(
      walletAddress,
      bitcoinNetwork
    )
    const isWalletOutput = (output: TransactionOutput) =>
      walletScript.equals(output.scriptPubKey)

    // Start iterating from the latest transaction as the chance it matches
    // the wallet main UTXO is the highest.
    for (let i = walletTransactions.length - 1; i >= 0; i--) {
      const walletTransaction = walletTransactions[i]

      // Find the output that locks the funds on the wallet. Only such an output
      // can be a wallet main UTXO.
      const outputIndex = walletTransaction.outputs.findIndex(isWalletOutput)

      // Should never happen as all transactions come from wallet history. Just
      // in case check whether the wallet output was actually found.
      if (outputIndex < 0) {
        console.error(
          `wallet output for transaction ${walletTransaction.transactionHash.toString()} not found`
        )
        continue
      }

      // Build a candidate UTXO instance based on the detected output.
      const utxo: UnspentTransactionOutput = {
        transactionHash: walletTransaction.transactionHash,
        outputIndex: outputIndex,
        value: walletTransaction.outputs[outputIndex].value,
      }

      // Check whether the candidate UTXO hash matches the main UTXO hash stored
      // on the Bridge.
      if (mainUtxoHash.equals(bridge.buildUtxoHash(utxo))) {
        return utxo
      }
    }

    return undefined
  }

  // The most common case is that the wallet uses a witness address for all
  // operations. Try to determine the main UTXO for that address first as the
  // chance for success is the highest here.
  const mainUtxo = await determine(true)

  // In case the main UTXO was not found for witness address, there is still
  // a chance it exists for the legacy wallet address.
  return mainUtxo ?? (await determine(false))
}
