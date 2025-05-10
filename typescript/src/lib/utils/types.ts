import { BitcoinUtxo } from "../../lib/bitcoin"
import { BigNumber } from "ethers"
import { Hex } from "./hex"

export interface ValidRedemptionWallet {
  /**
   * Index of the wallet in the list of wallets.
   */
  index: number

  /**
   * Public key of the wallet.
   */
  walletPublicKey: Hex

  /**
   * Main UTXO of the wallet.
   */
  mainUtxo: BitcoinUtxo

  /**
   * Balance of the wallet in BTC.
   */
  walletBTCBalance: BigNumber
}

export interface SerializableWallet {
  /**
   * Index of the wallet in the list of wallets.
   */
  index: number

  /**
   * Public key of the wallet.
   */
  walletPublicKey: string

  /**
   * Main UTXO of the wallet.
   */
  mainUtxo: {
    /**
     * Transaction hash of the UTXO.
     */
    transactionHash: string

    /**
     * Output index of the UTXO.
     */
    outputIndex: number

    /**
     * Value of the UTXO in satoshis.
     */
    value: string
  }

  /**
   * Balance of the wallet in BTC.
   */
  walletBTCBalance: string
}
