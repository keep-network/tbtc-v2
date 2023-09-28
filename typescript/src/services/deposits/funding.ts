import { DepositScript } from "./deposit"
import {
  BitcoinClient,
  BitcoinPrivateKeyUtils,
  BitcoinRawTx,
  BitcoinTxHash,
  BitcoinUtxo,
} from "../../lib/bitcoin"
import { BigNumber } from "ethers"
import bcoin from "bcoin"

/**
 * Component allowing to craft and submit the Bitcoin funding transaction using
 * the given tBTC v2 deposit script.
 *
 * @experimental THIS IS EXPERIMENTAL CODE THAT CAN BE CHANGED OR REMOVED
 *               IN FUTURE RELEASES. IT SHOULD BE USED ONLY FOR INTERNAL
 *               PURPOSES AND EXTERNAL APPLICATIONS SHOULD NOT DEPEND ON IT.
 */
// TODO: Abstract away transaction signing so there is no need to deal with
//       private key directly.
export class DepositFunding {
  public readonly script: DepositScript

  private constructor(script: DepositScript) {
    this.script = script
  }

  static fromScript(script: DepositScript): DepositFunding {
    return new DepositFunding(script)
  }

  /**
   * Assembles and signs the Bitcoin P2(W)SH funding transaction using
   * the underlying deposit script.
   * @dev It is up to the caller to ensure that input UTXOs are valid and
   *      can be unlocked using the depositor's private key. It is also
   *      caller's responsibility to ensure the given deposit is funded exactly
   *      once.
   * @param amount Deposit amount in satoshis.
   * @param inputUtxos UTXOs that should be used as transaction inputs.
   * @param depositorPrivateKey Bitcoin private key of the depositor. Must
   *        be able to unlock input UTXOs.
   * @returns The outcome consisting of:
   *          - the deposit transaction hash,
   *          - the deposit UTXO produced by this transaction.
   *          - the deposit transaction in the raw format
   */
  async assembleTransaction(
    amount: BigNumber,
    inputUtxos: (BitcoinUtxo & BitcoinRawTx)[],
    depositorPrivateKey: string
  ): Promise<{
    transactionHash: BitcoinTxHash
    depositUtxo: BitcoinUtxo
    rawTransaction: BitcoinRawTx
  }> {
    const depositorKeyRing =
      BitcoinPrivateKeyUtils.createKeyRing(depositorPrivateKey)
    const depositorAddress = depositorKeyRing.getAddress("string")

    const inputCoins = inputUtxos.map((utxo) =>
      bcoin.Coin.fromTX(
        bcoin.MTX.fromRaw(utxo.transactionHex, "hex"),
        utxo.outputIndex,
        -1
      )
    )

    const transaction = new bcoin.MTX()

    const scriptHash = await this.script.getHash()

    transaction.addOutput({
      script: this.script.witness
        ? bcoin.Script.fromProgram(0, scriptHash)
        : bcoin.Script.fromScripthash(scriptHash),
      value: amount.toNumber(),
    })

    await transaction.fund(inputCoins, {
      rate: null, // set null explicitly to always use the default value
      changeAddress: depositorAddress,
      subtractFee: false, // do not subtract the fee from outputs
    })

    transaction.sign(depositorKeyRing)

    const transactionHash = BitcoinTxHash.from(transaction.txid())

    return {
      transactionHash,
      depositUtxo: {
        transactionHash,
        outputIndex: 0, // The deposit is always the first output.
        value: amount,
      },
      rawTransaction: {
        transactionHex: transaction.toRaw().toString("hex"),
      },
    }
  }

  /**
   * Assembles, signs and submits the Bitcoin P2(W)SH funding transaction
   * using the underlying deposit script.
   * @dev It is up to the caller to ensure that depositor's private key controls
   *      some UTXOs that can be used as input. It is also caller's responsibility
   *      to ensure the given deposit is funded exactly once.
   * @param amount Deposit amount in satoshis.
   * @param depositorPrivateKey Bitcoin private key of the depositor.
   * @param bitcoinClient Bitcoin client used to interact with the network.
   * @returns The outcome consisting of:
   *          - the deposit transaction hash,
   *          - the deposit UTXO produced by this transaction.
   */
  async submitTransaction(
    amount: BigNumber,
    depositorPrivateKey: string,
    bitcoinClient: BitcoinClient
  ): Promise<{
    transactionHash: BitcoinTxHash
    depositUtxo: BitcoinUtxo
  }> {
    const depositorKeyRing =
      BitcoinPrivateKeyUtils.createKeyRing(depositorPrivateKey)
    const depositorAddress = depositorKeyRing.getAddress("string")

    const utxos = await bitcoinClient.findAllUnspentTransactionOutputs(
      depositorAddress
    )

    const utxosWithRaw: (BitcoinUtxo & BitcoinRawTx)[] = []
    for (const utxo of utxos) {
      const utxoRawTransaction = await bitcoinClient.getRawTransaction(
        utxo.transactionHash
      )

      utxosWithRaw.push({
        ...utxo,
        transactionHex: utxoRawTransaction.transactionHex,
      })
    }

    const { transactionHash, depositUtxo, rawTransaction } =
      await this.assembleTransaction(amount, utxosWithRaw, depositorPrivateKey)

    await bitcoinClient.broadcast(rawTransaction)

    return {
      transactionHash,
      depositUtxo,
    }
  }
}
