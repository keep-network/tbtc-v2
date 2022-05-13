import {
  Proof,
  UnspentTransactionOutput,
  DecomposedRawTransaction,
} from "./bitcoin"

import { BigNumber } from "ethers"

export interface PendingRedemption {
  redeemer: string
  requestedAmount: BigNumber
  treasuryFee: BigNumber
  txMaxFee: BigNumber
  requestedAt: number
}

/**
 * Interface for communication with the Bridge on-chain contract.
 */
export interface Bridge {
  /**
   * Submits a deposit sweep transaction proof to the on-chain contract.
   * @param sweepTx - Sweep transaction data.
   * @param sweepProof - Sweep proof data.
   * @param mainUtxo - Data of the wallets main UTXO.
   */
  submitDepositSweepProof(
    sweepTx: DecomposedRawTransaction,
    sweepProof: Proof,
    mainUtxo: UnspentTransactionOutput
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
   *        pending redemption (along with the redeemer output script)
   * @param redeemerOutputScript The redeemer output script that identifies the
   *        pending redemption (along with the wallet public key)
   * @returns Promise with the pending redemption.
   */
  getPendingRedemptions(
    walletPubKeyHash: string,
    redeemerOutputScript: string
  ): Promise<PendingRedemption>
}
