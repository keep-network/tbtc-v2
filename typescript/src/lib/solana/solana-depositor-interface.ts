import axios from "axios"
import { ChainIdentifier, BitcoinDepositor, DepositReceipt } from "../contracts"
import {
  CrossChainExtraDataEncoder,
  packRevealDepositParameters,
} from "../ethereum"
import { Hex } from "../utils"
import { BitcoinRawTxVectors } from "../bitcoin"

/**
 * Implementation of the Solana Depositor Interface handle.
 * @see {BitcoinDepositor} for reference.
 */
export class SolanaDepositorInterface implements BitcoinDepositor {
  readonly #extraDataEncoder: CrossChainExtraDataEncoder
  #depositOwner: ChainIdentifier | undefined

  constructor() {
    this.#extraDataEncoder = new CrossChainExtraDataEncoder()
  }

  // eslint-disable-next-line valid-jsdoc
  /**
   * @see {BitcoinDepositor#getDepositOwner}
   */
  getDepositOwner(): ChainIdentifier | undefined {
    return this.#depositOwner
  }

  // eslint-disable-next-line valid-jsdoc
  /**
   * @see {BitcoinDepositor#setDepositOwner}
   */
  setDepositOwner(depositOwner: ChainIdentifier | undefined): void {
    this.#depositOwner = depositOwner
  }

  // eslint-disable-next-line valid-jsdoc
  /**
   * @see {BitcoinDepositor#extraDataEncoder}
   */
  extraDataEncoder(): CrossChainExtraDataEncoder {
    return this.#extraDataEncoder
  }

  // eslint-disable-next-line valid-jsdoc
  /**
   * @see {BitcoinDepositor#initializeDeposit}
   *
   * This method calls the external service at `https://api.tbtcscan.org/reveal`
   * to trigger the deposit transaction via a relayer off-chain process.
   * It returns the resulting transaction hash as a Hex.
   */
  async initializeDeposit(
    depositTx: BitcoinRawTxVectors,
    depositOutputIndex: number,
    deposit: DepositReceipt,
    vault?: ChainIdentifier
  ): Promise<Hex> {
    const { fundingTx, reveal, extraData } = packRevealDepositParameters(
      depositTx,
      depositOutputIndex,
      deposit,
      vault
    )

    if (!extraData) {
      throw new Error("Extra data is required.")
    }

    try {
      const response = await axios.post("http://localhost:3000/api/reveal", {
        fundingTx,
        reveal,
        l2DepositOwner: extraData,
        l2Sender: `0x${this.#depositOwner?.identifierHex}`,
      })

      const { data } = response
      if (!data?.tx?.hash) {
        throw new Error(
          `Unexpected response from /api/reveal: ${JSON.stringify(data)}`
        )
      }

      return Hex.from(data.tx.hash)
    } catch (error) {
      // You can add logging, rethrow, etc.
      console.error("Error calling /api/reveal endpoint:", error)
      throw error
    }
  }
}
