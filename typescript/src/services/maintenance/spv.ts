import {
  assembleBitcoinSpvProof,
  BitcoinClient,
  BitcoinTxHash,
  BitcoinUtxo,
  extractBitcoinRawTxVectors,
} from "../../lib/bitcoin"
import { ChainIdentifier, TBTCContracts } from "../../lib/contracts"

export class Spv {
  /**
   * Handle to tBTC contracts.
   */
  private readonly tbtcContracts: TBTCContracts
  /**
   * Bitcoin client handle.
   */
  private readonly bitcoinClient: BitcoinClient

  constructor(tbtcContracts: TBTCContracts, bitcoinClient: BitcoinClient) {
    this.tbtcContracts = tbtcContracts
    this.bitcoinClient = bitcoinClient
  }

  /**
   * Prepares the proof of a deposit sweep transaction and submits it to the
   * Bridge on-chain contract.
   * @param transactionHash - Hash of the transaction being proven.
   * @param mainUtxo - Recent main UTXO of the wallet as currently known on-chain.
   * @param vault - (Optional) The vault pointed by swept deposits.
   * @returns Empty promise.
   */
  async submitDepositSweepProof(
    transactionHash: BitcoinTxHash,
    mainUtxo: BitcoinUtxo,
    vault?: ChainIdentifier
  ): Promise<void> {
    const confirmations =
      await this.tbtcContracts.bridge.txProofDifficultyFactor()
    const proof = await assembleBitcoinSpvProof(
      transactionHash,
      confirmations,
      this.bitcoinClient
    )
    const rawTransaction = await this.bitcoinClient.getRawTransaction(
      transactionHash
    )
    const rawTransactionVectors = extractBitcoinRawTxVectors(rawTransaction)
    await this.tbtcContracts.bridge.submitDepositSweepProof(
      rawTransactionVectors,
      proof,
      mainUtxo,
      vault
    )
  }

  /**
   * Prepares the proof of a redemption transaction and submits it to the
   * Bridge on-chain contract.
   * @param transactionHash - Hash of the transaction being proven.
   * @param mainUtxo - Recent main UTXO of the wallet as currently known on-chain.
   * @param walletPublicKey - Bitcoin public key of the wallet. Must be in the
   *        compressed form (33 bytes long with 02 or 03 prefix).
   * @returns Empty promise.
   */
  async submitRedemptionProof(
    transactionHash: BitcoinTxHash,
    mainUtxo: BitcoinUtxo,
    walletPublicKey: string
  ): Promise<void> {
    const confirmations =
      await this.tbtcContracts.bridge.txProofDifficultyFactor()
    const proof = await assembleBitcoinSpvProof(
      transactionHash,
      confirmations,
      this.bitcoinClient
    )
    const rawTransaction = await this.bitcoinClient.getRawTransaction(
      transactionHash
    )
    const rawTransactionVectors = extractBitcoinRawTxVectors(rawTransaction)

    await this.tbtcContracts.bridge.submitRedemptionProof(
      rawTransactionVectors,
      proof,
      mainUtxo,
      walletPublicKey
    )
  }
}
