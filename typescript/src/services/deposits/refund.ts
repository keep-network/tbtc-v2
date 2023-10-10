import bcoin from "bcoin"
import { BigNumber } from "ethers"
import {
  BitcoinRawTx,
  BitcoinClient,
  BitcoinTxHash,
  BitcoinUtxo,
  BitcoinHashUtils,
  BitcoinPublicKeyUtils,
} from "../../lib/bitcoin"
import { validateDepositReceipt } from "../../lib/contracts"
import { DepositScript } from "./"
import wif from "wif"

/**
 * Component allowing to craft and submit the Bitcoin refund transaction using
 * the given tBTC v2 deposit script.
 *
 * @experimental THIS IS EXPERIMENTAL CODE THAT CAN BE CHANGED OR REMOVED
 *               IN FUTURE RELEASES. IT SHOULD BE USED ONLY FOR INTERNAL
 *               PURPOSES AND EXTERNAL APPLICATIONS SHOULD NOT DEPEND ON IT.
 */
// TODO: Abstract away transaction signing so there is no need to deal with
//       private key directly.
export class DepositRefund {
  public readonly script: DepositScript

  private constructor(script: DepositScript) {
    this.script = script
  }

  static fromScript(script: DepositScript): DepositRefund {
    return new DepositRefund(script)
  }

  /**
   * Submits a deposit refund by creating and broadcasting a Bitcoin P2(W)PKH
   * deposit refund transaction.
   * @param bitcoinClient - Bitcoin client used to interact with the network.
   * @param fee - the value that will be subtracted from the deposit UTXO being
   *        refunded and used as the transaction fee.
   * @param utxo - UTXO that was created during depositing that needs be refunded.
   * @param refunderAddress - Recipient Bitcoin wallet address of the refunded
   *        deposit.
   * @param refunderPrivateKey - Bitcoin wallet private key of the refunder.
   *        It must correspond to the `refundPublicKeyHash` of the deposit script.
   * @returns The outcome is the deposit refund transaction hash.
   * @dev This function should be called by the refunder after `refundLocktime`
   *      passes plus 1 hour. The additional hour of waiting is the result of
   *      adopting BIP113 which compares the transaction's locktime against the
   *      median timestamp of the last 11 blocks. This median time lags
   *      the current unix time by about 1 hour.
   */
  async submitTransaction(
    bitcoinClient: BitcoinClient,
    fee: BigNumber,
    utxo: BitcoinUtxo,
    refunderAddress: string,
    refunderPrivateKey: string
  ): Promise<{ transactionHash: BitcoinTxHash }> {
    const utxoRawTransaction = await bitcoinClient.getRawTransaction(
      utxo.transactionHash
    )

    const utxoWithRaw = {
      ...utxo,
      transactionHex: utxoRawTransaction.transactionHex,
    }

    const { transactionHash, rawTransaction } = await this.assembleTransaction(
      fee,
      utxoWithRaw,
      refunderAddress,
      refunderPrivateKey
    )

    // Note that `broadcast` may fail silently (i.e. no error will be returned,
    // even if the transaction is rejected by other nodes and does not enter the
    // mempool, for example due to an UTXO being already spent).
    await bitcoinClient.broadcast(rawTransaction)

    return { transactionHash }
  }

  /**
   * Assembles a Bitcoin P2(W)PKH deposit refund transaction.
   * @param fee - the value that will be subtracted from the deposit UTXO being
   *        refunded and used as the transaction fee.
   * @param utxo - UTXO that was created during depositing that needs be refunded.
   * @param refunderAddress - Recipient Bitcoin wallet address of the refunded
   *        deposit.
   * @param refunderPrivateKey - Bitcoin wallet private key of the refunder.
   *        It must correspond to the `refundPublicKeyHash` of the deposit script.
   * @returns The outcome consisting of:
   *          - the deposit refund transaction hash,
   *          - the refund transaction in the raw format.
   */
  async assembleTransaction(
    fee: BigNumber,
    utxo: BitcoinUtxo & BitcoinRawTx,
    refunderAddress: string,
    refunderPrivateKey: string
  ): Promise<{
    transactionHash: BitcoinTxHash
    rawTransaction: BitcoinRawTx
  }> {
    validateDepositReceipt(this.script.receipt)

    const decodedPrivateKey = wif.decode(refunderPrivateKey)

    const refunderKeyRing = new bcoin.KeyRing({
      witness: true,
      privateKey: decodedPrivateKey.privateKey,
      compressed: decodedPrivateKey.compressed,
    })

    const transaction = new bcoin.MTX()

    transaction.addOutput({
      script: bcoin.Script.fromAddress(refunderAddress),
      value: utxo.value.toNumber(),
    })

    const inputCoin = bcoin.Coin.fromTX(
      bcoin.MTX.fromRaw(utxo.transactionHex, "hex"),
      utxo.outputIndex,
      -1
    )

    await transaction.fund([inputCoin], {
      changeAddress: refunderAddress,
      hardFee: fee.toNumber(),
      subtractFee: true,
    })

    if (transaction.outputs.length != 1) {
      throw new Error("Deposit refund transaction must have only one output")
    }

    // In order to be able to spend the UTXO being refunded the transaction's
    // locktime must be set to a value equal to or higher than the refund locktime.
    // Additionally, the input's sequence must be set to a value different than
    // `0xffffffff`. These requirements are the result of BIP-65.
    transaction.locktime = locktimeToUnixTimestamp(
      this.script.receipt.refundLocktime
    )
    transaction.inputs[0].sequence = 0xfffffffe

    // Sign the input
    const previousOutpoint = transaction.inputs[0].prevout
    const previousOutput = transaction.view.getOutput(previousOutpoint)
    const previousScript = previousOutput.script

    if (previousScript.isScripthash()) {
      // P2SH UTXO deposit input
      await this.signP2SHDepositInput(transaction, 0, refunderKeyRing)
    } else if (previousScript.isWitnessScripthash()) {
      // P2WSH UTXO deposit input
      await this.signP2WSHDepositInput(transaction, 0, refunderKeyRing)
    } else {
      throw new Error("Unsupported UTXO script type")
    }

    // Verify the transaction by executing its input scripts.
    const tx = transaction.toTX()
    if (!tx.verify(transaction.view)) {
      throw new Error("Transaction verification failure")
    }

    const transactionHash = BitcoinTxHash.from(transaction.txid())

    return {
      transactionHash,
      rawTransaction: {
        transactionHex: transaction.toRaw().toString("hex"),
      },
    }
  }

  /**
   * Creates data needed to sign a deposit input to be refunded.
   * @param transaction - Mutable transaction containing the input to be refunded.
   * @param inputIndex - Index that points to the input.
   * @param refunderKeyRing - Key ring created using the refunder's private key.
   * @returns Data needed to sign the input.
   */
  private async prepareInputSignData(
    transaction: any,
    inputIndex: number,
    refunderKeyRing: any
  ): Promise<{
    refunderPublicKey: string
    depositScript: any
    previousOutputValue: number
  }> {
    const previousOutpoint = transaction.inputs[inputIndex].prevout
    const previousOutput = transaction.view.getOutput(previousOutpoint)

    const refunderPublicKey = refunderKeyRing.getPublicKey("hex")
    if (
      BitcoinHashUtils.computeHash160(refunderKeyRing.getPublicKey("hex")) !=
      this.script.receipt.refundPublicKeyHash
    ) {
      throw new Error(
        "Refund public key does not correspond to the refunder private key"
      )
    }

    if (!BitcoinPublicKeyUtils.isCompressedPublicKey(refunderPublicKey)) {
      throw new Error("Refunder public key must be compressed")
    }

    const depositScript = bcoin.Script.fromRaw(
      Buffer.from(await this.script.getPlainText(), "hex")
    )

    return {
      refunderPublicKey: refunderPublicKey,
      depositScript: depositScript,
      previousOutputValue: previousOutput.value,
    }
  }

  /**
   * Creates and sets `scriptSig` for the transaction input at the given index by
   * combining signature, refunder's public key and deposit script.
   * @param transaction - Mutable transaction containing the input to be signed.
   * @param inputIndex - Index that points to the input to be signed.
   * @param refunderKeyRing - Key ring created using the refunder's private key.
   * @returns Empty return.
   */
  private async signP2SHDepositInput(
    transaction: any,
    inputIndex: number,
    refunderKeyRing: any
  ) {
    const { refunderPublicKey, depositScript, previousOutputValue } =
      await this.prepareInputSignData(transaction, inputIndex, refunderKeyRing)

    const signature: Buffer = transaction.signature(
      inputIndex,
      depositScript,
      previousOutputValue,
      refunderKeyRing.privateKey,
      bcoin.Script.hashType.ALL,
      0 // legacy sighash version
    )
    const scriptSig = new bcoin.Script()
    scriptSig.clear()
    scriptSig.pushData(signature)
    scriptSig.pushData(Buffer.from(refunderPublicKey, "hex"))
    scriptSig.pushData(depositScript.toRaw())
    scriptSig.compile()

    transaction.inputs[inputIndex].script = scriptSig
  }

  /**
   * Creates and sets witness script for the transaction input at the given index
   * by combining signature, refunder public key and deposit script.
   * @param transaction - Mutable transaction containing the input to be signed.
   * @param inputIndex - Index that points to the input to be signed.
   * @param refunderKeyRing - Key ring created using the refunder's private key.
   * @returns Empty return.
   */
  private async signP2WSHDepositInput(
    transaction: any,
    inputIndex: number,
    refunderKeyRing: any
  ) {
    const { refunderPublicKey, depositScript, previousOutputValue } =
      await this.prepareInputSignData(transaction, inputIndex, refunderKeyRing)

    const signature: Buffer = transaction.signature(
      inputIndex,
      depositScript,
      previousOutputValue,
      refunderKeyRing.privateKey,
      bcoin.Script.hashType.ALL,
      1 // segwit sighash version
    )

    const witness = new bcoin.Witness()
    witness.clear()
    witness.pushData(signature)
    witness.pushData(Buffer.from(refunderPublicKey, "hex"))
    witness.pushData(depositScript.toRaw())
    witness.compile()

    transaction.inputs[inputIndex].witness = witness
  }
}

/**
 * Converts locktime from the little endian hexstring format to the Unix
 * timestamp.
 * @param locktime - Locktime as a little endian hexstring.
 * @returns Locktime as a Unix timestamp.
 */
function locktimeToUnixTimestamp(locktime: string): number {
  const bigEndianLocktime = Buffer.from(locktime, "hex")
    .reverse()
    .toString("hex")

  return parseInt(bigEndianLocktime, 16)
}
