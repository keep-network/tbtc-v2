import { BytesLike } from "ethers"
import {
  Proof,
  UnspentTransactionOutput,
  DecomposedRawTransaction,
} from "./bitcoin"
import { Deposit } from "./deposit"
import { RedemptionRequest } from "./redemption"

/**
 * Represents a generic chain identifier.
 */
export interface Identifier {
  /**
   * Identifier as an un-prefixed hex string.
   */
  identifierHex: string
}

/**
 * Interface for communication with the Bridge on-chain contract.
 */
export interface Bridge {
  /**
   * Submits a deposit sweep transaction proof to the on-chain contract.
   * @param sweepTx - Sweep transaction data.
   * @param sweepProof - Sweep proof data.
   * @param mainUtxo - Data of the wallet's main UTXO.
   */
  submitDepositSweepProof(
    sweepTx: DecomposedRawTransaction,
    sweepProof: Proof,
    mainUtxo: UnspentTransactionOutput
  ): Promise<void>

  /**
   * Reveals a given deposit to the on-chain contract.
   * @param depositTx - Deposit transaction data
   * @param depositOutputIndex - Index of the deposit transaction output that
   *        funds the revealed deposit
   * @param deposit - Data of the revealed deposit
   */
  revealDeposit(
    depositTx: DecomposedRawTransaction,
    depositOutputIndex: number,
    deposit: Deposit
  ): Promise<void>

  /**
   * Submits a redemption transaction proof to the on-chain contract.
   * @param redemptionTx - Redemption transaction data
   * @param redemptionProof - Redemption proof data
   * @param mainUtxo - Data of the wallet's main UTXO
   * @param walletPubKeyHash - 20-byte public key hash of the wallet
   */
  submitRedemptionProof(
    redemptionTx: DecomposedRawTransaction,
    redemptionProof: Proof,
    mainUtxo: UnspentTransactionOutput,
    walletPubKeyHash: BytesLike
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
   * @param walletPubKeyHash The wallet public key hash that identifies the
   *        pending redemption (along with the redeemer output script). Must be
   *        unprefixed
   * @param redeemerOutputScript The redeemer output script that identifies the
   *        pending redemption (along with the wallet public key hash). Must be
   *        un-prefixed and not prepended with length
   * @returns Promise with the pending redemption.
   */
  pendingRedemptions(
    walletPubKeyHash: string,
    redeemerOutputScript: string
  ): Promise<RedemptionRequest>
}
