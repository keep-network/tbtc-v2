import {
  BitcoinClient,
  BitcoinHashUtils,
  BitcoinPrivateKeyUtils,
  BitcoinPublicKeyUtils,
  BitcoinRawTx,
  BitcoinTxHash,
  BitcoinUtxo,
} from "../../lib/bitcoin"
import { BigNumber } from "ethers"
import {
  DepositReceipt,
  RedemptionRequest,
  TBTCContracts,
} from "../../lib/contracts"
import bcoin from "bcoin"
import { DepositScript } from "../deposits"

/**
 * Wallet transactions builder. This feature set is supposed to be used only
 * for internal purposes like system tests. In real world, tBTC v2 wallets
 * are formed by peer-to-peer network participants that sign transactions
 * using threshold signature schemes.
 *
 * @experimental THIS IS EXPERIMENTAL CODE THAT CAN BE CHANGED OR REMOVED
 *               IN FUTURE RELEASES. IT SHOULD BE USED ONLY FOR INTERNAL
 *               PURPOSES AND EXTERNAL APPLICATIONS SHOULD NOT DEPEND ON IT.
 */
// TODO: Abstract away transaction signing so there is no need to deal with
//       private key directly.
export class WalletTx {
  public readonly depositSweep: DepositSweep
  public readonly redemption: Redemption

  constructor(
    tbtcContracts: TBTCContracts,
    bitcoinClient: BitcoinClient,
    witness: boolean = true
  ) {
    this.depositSweep = new DepositSweep(bitcoinClient, witness)
    this.redemption = new Redemption(tbtcContracts, bitcoinClient, witness)
  }
}

class DepositSweep {
  /**
   * Bitcoin client handle.
   */
  private readonly bitcoinClient: BitcoinClient
  /**
   * Flag indicating whether the generated Bitcoin deposit sweep transaction
   * should be a witness one.
   */
  private readonly witness: boolean

  constructor(bitcoinClient: BitcoinClient, witness: boolean = true) {
    this.bitcoinClient = bitcoinClient
    this.witness = witness
  }

  /**
   * Submits a deposit sweep by combining all the provided P2(W)SH UTXOs and
   * broadcasting a Bitcoin P2(W)PKH deposit sweep transaction.
   * @dev The caller is responsible for ensuring the provided UTXOs are correctly
   *      formed, can be spent by the wallet and their combined value is greater
   *      than the fee. Note that broadcasting transaction may fail silently (e.g.
   *      when the provided UTXOs are not spendable) and no error will be returned.
   * @param fee - the value that should be subtracted from the sum of the UTXOs
   *        values and used as the transaction fee.
   * @param walletPrivateKey - Bitcoin private key of the wallet in WIF format.
   * @param utxos - P2(W)SH UTXOs to be combined into one output.
   * @param deposits - Array of deposits. Each element corresponds to UTXO.
   *        The number of UTXOs and deposit elements must equal.
   * @param mainUtxo - main UTXO of the wallet, which is a P2WKH UTXO resulting
   *        from the previous wallet transaction (optional).
   * @returns The outcome consisting of:
   *          - the sweep transaction hash,
   *          - the new wallet's main UTXO produced by this transaction.
   */
  async submitTransaction(
    fee: BigNumber,
    walletPrivateKey: string,
    utxos: BitcoinUtxo[],
    deposits: DepositReceipt[],
    mainUtxo?: BitcoinUtxo
  ): Promise<{
    transactionHash: BitcoinTxHash
    newMainUtxo: BitcoinUtxo
  }> {
    const utxosWithRaw: (BitcoinUtxo & BitcoinRawTx)[] = []
    for (const utxo of utxos) {
      const utxoRawTransaction = await this.bitcoinClient.getRawTransaction(
        utxo.transactionHash
      )

      utxosWithRaw.push({
        ...utxo,
        transactionHex: utxoRawTransaction.transactionHex,
      })
    }

    let mainUtxoWithRaw

    if (mainUtxo) {
      const mainUtxoRawTransaction = await this.bitcoinClient.getRawTransaction(
        mainUtxo.transactionHash
      )
      mainUtxoWithRaw = {
        ...mainUtxo,
        transactionHex: mainUtxoRawTransaction.transactionHex,
      }
    }

    const { transactionHash, newMainUtxo, rawTransaction } =
      await this.assembleTransaction(
        fee,
        walletPrivateKey,
        utxosWithRaw,
        deposits,
        mainUtxoWithRaw
      )

    // Note that `broadcast` may fail silently (i.e. no error will be returned,
    // even if the transaction is rejected by other nodes and does not enter the
    // mempool, for example due to an UTXO being already spent).
    await this.bitcoinClient.broadcast(rawTransaction)

    return { transactionHash, newMainUtxo }
  }

  /**
   * Assembles a Bitcoin P2WPKH deposit sweep transaction.
   * @dev The caller is responsible for ensuring the provided UTXOs are correctly
   *      formed, can be spent by the wallet and their combined value is greater
   *      then the fee.
   * @param fee - the value that should be subtracted from the sum of the UTXOs
   *        values and used as the transaction fee.
   * @param walletPrivateKey - Bitcoin private key of the wallet in WIF format.
   * @param utxos - UTXOs from new deposit transactions. Must be P2(W)SH.
   * @param deposits - Array of deposits. Each element corresponds to UTXO.
   *        The number of UTXOs and deposit elements must equal.
   * @param mainUtxo - main UTXO of the wallet, which is a P2WKH UTXO resulting
   *        from the previous wallet transaction (optional).
   * @returns The outcome consisting of:
   *          - the sweep transaction hash,
   *          - the new wallet's main UTXO produced by this transaction.
   *          - the sweep transaction in the raw format
   */
  async assembleTransaction(
    fee: BigNumber,
    walletPrivateKey: string,
    utxos: (BitcoinUtxo & BitcoinRawTx)[],
    deposits: DepositReceipt[],
    mainUtxo?: BitcoinUtxo & BitcoinRawTx
  ): Promise<{
    transactionHash: BitcoinTxHash
    newMainUtxo: BitcoinUtxo
    rawTransaction: BitcoinRawTx
  }> {
    if (utxos.length < 1) {
      throw new Error("There must be at least one deposit UTXO to sweep")
    }

    if (utxos.length != deposits.length) {
      throw new Error(
        "Number of UTXOs must equal the number of deposit elements"
      )
    }

    const walletKeyRing = BitcoinPrivateKeyUtils.createKeyRing(
      walletPrivateKey,
      this.witness
    )
    const walletAddress = walletKeyRing.getAddress("string")

    const inputCoins = []
    let totalInputValue = BigNumber.from(0)

    if (mainUtxo) {
      inputCoins.push(
        bcoin.Coin.fromTX(
          bcoin.MTX.fromRaw(mainUtxo.transactionHex, "hex"),
          mainUtxo.outputIndex,
          -1
        )
      )
      totalInputValue = totalInputValue.add(mainUtxo.value)
    }

    for (const utxo of utxos) {
      inputCoins.push(
        bcoin.Coin.fromTX(
          bcoin.MTX.fromRaw(utxo.transactionHex, "hex"),
          utxo.outputIndex,
          -1
        )
      )
      totalInputValue = totalInputValue.add(utxo.value)
    }

    const transaction = new bcoin.MTX()

    transaction.addOutput({
      script: bcoin.Script.fromAddress(walletAddress),
      value: totalInputValue.toNumber(),
    })

    await transaction.fund(inputCoins, {
      changeAddress: walletAddress,
      hardFee: fee.toNumber(),
      subtractFee: true,
    })

    if (transaction.outputs.length != 1) {
      throw new Error("Deposit sweep transaction must have only one output")
    }

    // UTXOs must be mapped to deposits, as `fund` may arrange inputs in any
    // order
    const utxosWithDeposits: (BitcoinUtxo & BitcoinRawTx & DepositReceipt)[] =
      utxos.map((utxo, index) => ({
        ...utxo,
        ...deposits[index],
      }))

    for (let i = 0; i < transaction.inputs.length; i++) {
      const previousOutpoint = transaction.inputs[i].prevout
      const previousOutput = transaction.view.getOutput(previousOutpoint)
      const previousScript = previousOutput.script

      // P2(W)PKH (main UTXO)
      if (
        previousScript.isPubkeyhash() ||
        previousScript.isWitnessPubkeyhash()
      ) {
        await this.signMainUtxoInput(transaction, i, walletKeyRing)
        continue
      }

      const utxoWithDeposit = utxosWithDeposits.find(
        (u) =>
          u.transactionHash.toString() === previousOutpoint.txid() &&
          u.outputIndex == previousOutpoint.index
      )
      if (!utxoWithDeposit) {
        throw new Error("Unknown input")
      }

      if (previousScript.isScripthash()) {
        // P2SH (deposit UTXO)
        await this.signP2SHDepositInput(
          transaction,
          i,
          utxoWithDeposit,
          walletKeyRing
        )
      } else if (previousScript.isWitnessScripthash()) {
        // P2WSH (deposit UTXO)
        await this.signP2WSHDepositInput(
          transaction,
          i,
          utxoWithDeposit,
          walletKeyRing
        )
      } else {
        throw new Error("Unsupported UTXO script type")
      }
    }

    const transactionHash = BitcoinTxHash.from(transaction.txid())

    return {
      transactionHash,
      newMainUtxo: {
        transactionHash,
        outputIndex: 0, // There is only one output.
        value: BigNumber.from(transaction.outputs[0].value),
      },
      rawTransaction: {
        transactionHex: transaction.toRaw().toString("hex"),
      },
    }
  }

  /**
   * Creates script for the transaction input at the given index and signs the
   * input.
   * @param transaction - Mutable transaction containing the input to be signed.
   * @param inputIndex - Index that points to the input to be signed.
   * @param walletKeyRing - Key ring created using the wallet's private key.
   * @returns Empty promise.
   */
  private async signMainUtxoInput(
    transaction: any,
    inputIndex: number,
    walletKeyRing: any
  ) {
    const previousOutpoint = transaction.inputs[inputIndex].prevout
    const previousOutput = transaction.view.getOutput(previousOutpoint)
    if (!walletKeyRing.ownOutput(previousOutput)) {
      throw new Error("UTXO does not belong to the wallet")
    }
    // Build script and set it as input's witness
    transaction.scriptInput(inputIndex, previousOutput, walletKeyRing)
    // Build signature and add it in front of script in input's witness
    transaction.signInput(inputIndex, previousOutput, walletKeyRing)
  }

  /**
   * Creates and sets `scriptSig` for the transaction input at the given index by
   * combining signature, wallet public key and deposit script.
   * @param transaction - Mutable transaction containing the input to be signed.
   * @param inputIndex - Index that points to the input to be signed.
   * @param deposit - Data of the deposit.
   * @param walletKeyRing - Key ring created using the wallet's private key.
   * @returns Empty promise.
   */
  private async signP2SHDepositInput(
    transaction: any,
    inputIndex: number,
    deposit: DepositReceipt,
    walletKeyRing: any
  ): Promise<void> {
    const { walletPublicKey, depositScript, previousOutputValue } =
      await this.prepareInputSignData(
        transaction,
        inputIndex,
        deposit,
        walletKeyRing
      )

    const signature: Buffer = transaction.signature(
      inputIndex,
      depositScript,
      previousOutputValue,
      walletKeyRing.privateKey,
      bcoin.Script.hashType.ALL,
      0 // legacy sighash version
    )
    const scriptSig = new bcoin.Script()
    scriptSig.clear()
    scriptSig.pushData(signature)
    scriptSig.pushData(Buffer.from(walletPublicKey, "hex"))
    scriptSig.pushData(depositScript.toRaw())
    scriptSig.compile()

    transaction.inputs[inputIndex].script = scriptSig
  }

  /**
   * Creates and sets witness script for the transaction input at the given index
   * by combining signature, wallet public key and deposit script.
   * @param transaction - Mutable transaction containing the input to be signed.
   * @param inputIndex - Index that points to the input to be signed.
   * @param deposit - Data of the deposit.
   * @param walletKeyRing - Key ring created using the wallet's private key.
   * @returns Empty promise.
   */
  private async signP2WSHDepositInput(
    transaction: any,
    inputIndex: number,
    deposit: DepositReceipt,
    walletKeyRing: any
  ): Promise<void> {
    const { walletPublicKey, depositScript, previousOutputValue } =
      await this.prepareInputSignData(
        transaction,
        inputIndex,
        deposit,
        walletKeyRing
      )

    const signature: Buffer = transaction.signature(
      inputIndex,
      depositScript,
      previousOutputValue,
      walletKeyRing.privateKey,
      bcoin.Script.hashType.ALL,
      1 // segwit sighash version
    )

    const witness = new bcoin.Witness()
    witness.clear()
    witness.pushData(signature)
    witness.pushData(Buffer.from(walletPublicKey, "hex"))
    witness.pushData(depositScript.toRaw())
    witness.compile()

    transaction.inputs[inputIndex].witness = witness
  }

  /**
   * Creates data needed to sign a deposit input.
   * @param transaction - Mutable transaction containing the input.
   * @param inputIndex - Index that points to the input.
   * @param deposit - Data of the deposit.
   * @param walletKeyRing - Key ring created using the wallet's private key.
   * @returns Data needed to sign the input.
   */
  private async prepareInputSignData(
    transaction: any,
    inputIndex: number,
    deposit: DepositReceipt,
    walletKeyRing: any
  ): Promise<{
    walletPublicKey: string
    depositScript: any
    previousOutputValue: number
  }> {
    const previousOutpoint = transaction.inputs[inputIndex].prevout
    const previousOutput = transaction.view.getOutput(previousOutpoint)

    const walletPublicKey = walletKeyRing.getPublicKey("hex")
    if (
      BitcoinHashUtils.computeHash160(walletKeyRing.getPublicKey("hex")) !=
      deposit.walletPublicKeyHash
    ) {
      throw new Error(
        "Wallet public key does not correspond to wallet private key"
      )
    }

    if (!BitcoinPublicKeyUtils.isCompressedPublicKey(walletPublicKey)) {
      throw new Error("Wallet public key must be compressed")
    }

    const depositScript = bcoin.Script.fromRaw(
      Buffer.from(
        await DepositScript.fromReceipt(deposit).getPlainText(),
        "hex"
      )
    )

    return {
      walletPublicKey,
      depositScript: depositScript,
      previousOutputValue: previousOutput.value,
    }
  }
}

class Redemption {
  /**
   * Handle to tBTC contracts.
   */
  private readonly tbtcContracts: TBTCContracts
  /**
   * Bitcoin client handle.
   */
  private readonly bitcoinClient: BitcoinClient
  /**
   * Flag indicating whether the generated Bitcoin redemption transaction
   * should be a witness one.
   */
  private readonly witness: boolean

  constructor(
    tbtcContracts: TBTCContracts,
    bitcoinClient: BitcoinClient,
    witness: boolean = true
  ) {
    this.tbtcContracts = tbtcContracts
    this.bitcoinClient = bitcoinClient
    this.witness = witness
  }
  /**
   * Handles pending redemption requests by creating a redemption transaction
   * transferring Bitcoins from the wallet's main UTXO to the provided redeemer
   * output scripts and broadcasting it. The change UTXO resulting from the
   * transaction becomes the new main UTXO of the wallet.
   * @dev It is up to the caller to ensure the wallet key and each of the redeemer
   *      output scripts represent a valid pending redemption request in the Bridge.
   *      If this is not the case, an exception will be thrown.
   * @param walletPrivateKey - The private kay of the wallet in the WIF format
   * @param mainUtxo - The main UTXO of the wallet. Must match the main UTXO
   *        held by the on-chain Bridge contract
   * @param redeemerOutputScripts - The list of output scripts that the redeemed
   *        funds will be locked to. The output scripts must be un-prefixed and
   *        not prepended with length
   * @returns The outcome consisting of:
   *          - the redemption transaction hash,
   *          - the optional new wallet's main UTXO produced by this transaction.
   */
  async submitTransaction(
    walletPrivateKey: string,
    mainUtxo: BitcoinUtxo,
    redeemerOutputScripts: string[]
  ): Promise<{
    transactionHash: BitcoinTxHash
    newMainUtxo?: BitcoinUtxo
  }> {
    const mainUtxoRawTransaction = await this.bitcoinClient.getRawTransaction(
      mainUtxo.transactionHash
    )

    const mainUtxoWithRaw: BitcoinUtxo & BitcoinRawTx = {
      ...mainUtxo,
      transactionHex: mainUtxoRawTransaction.transactionHex,
    }

    const walletPublicKey = BitcoinPrivateKeyUtils.createKeyRing(
      walletPrivateKey
    )
      .getPublicKey()
      .toString("hex")

    const redemptionRequests: RedemptionRequest[] = []

    for (const redeemerOutputScript of redeemerOutputScripts) {
      const redemptionRequest =
        await this.tbtcContracts.bridge.pendingRedemptions(
          walletPublicKey,
          redeemerOutputScript
        )

      if (redemptionRequest.requestedAt == 0) {
        throw new Error("Redemption request does not exist")
      }

      redemptionRequests.push({
        ...redemptionRequest,
        redeemerOutputScript: redeemerOutputScript,
      })
    }

    const { transactionHash, newMainUtxo, rawTransaction } =
      await this.assembleTransaction(
        walletPrivateKey,
        mainUtxoWithRaw,
        redemptionRequests
      )

    // Note that `broadcast` may fail silently (i.e. no error will be returned,
    // even if the transaction is rejected by other nodes and does not enter the
    // mempool, for example due to an UTXO being already spent).
    await this.bitcoinClient.broadcast(rawTransaction)

    return { transactionHash, newMainUtxo }
  }

  /**
   * Assembles a Bitcoin redemption transaction.
   * The transaction will have a single input (main UTXO of the wallet making
   * the redemption), an output for each redemption request provided, and a change
   * output if the redemption requests do not consume the entire amount of the
   * single input.
   * @dev The caller is responsible for ensuring the redemption request list is
   *      correctly formed:
   *        - there is at least one redemption
   *        - the `requestedAmount` in each redemption request is greater than
   *          the sum of its `txFee` and `treasuryFee`
   * @param walletPrivateKey - The private key of the wallet in the WIF format
   * @param mainUtxo - The main UTXO of the wallet. Must match the main UTXO held
   *        by the on-chain Bridge contract
   * @param redemptionRequests - The list of redemption requests
   * @returns The outcome consisting of:
   *          - the redemption transaction hash,
   *          - the optional new wallet's main UTXO produced by this transaction.
   *          - the redemption transaction in the raw format
   */
  async assembleTransaction(
    walletPrivateKey: string,
    mainUtxo: BitcoinUtxo & BitcoinRawTx,
    redemptionRequests: RedemptionRequest[]
  ): Promise<{
    transactionHash: BitcoinTxHash
    newMainUtxo?: BitcoinUtxo
    rawTransaction: BitcoinRawTx
  }> {
    if (redemptionRequests.length < 1) {
      throw new Error("There must be at least one request to redeem")
    }

    const walletKeyRing = BitcoinPrivateKeyUtils.createKeyRing(
      walletPrivateKey,
      this.witness
    )
    const walletAddress = walletKeyRing.getAddress("string")

    // Use the main UTXO as the single transaction input
    const inputCoins = [
      bcoin.Coin.fromTX(
        bcoin.MTX.fromRaw(mainUtxo.transactionHex, "hex"),
        mainUtxo.outputIndex,
        -1
      ),
    ]

    const transaction = new bcoin.MTX()

    let txTotalFee = BigNumber.from(0)
    let totalOutputsValue = BigNumber.from(0)

    // Process the requests
    for (const request of redemptionRequests) {
      // Calculate the value of the output by subtracting tx fee and treasury
      // fee for this particular output from the requested amount
      const outputValue = request.requestedAmount
        .sub(request.txMaxFee)
        .sub(request.treasuryFee)

      // Add the output value to the total output value
      totalOutputsValue = totalOutputsValue.add(outputValue)

      // Add the fee for this particular request to the overall transaction fee
      // TODO: Using the maximum allowed transaction fee for the request (`txMaxFee`)
      //       as the transaction fee for now. In the future allow the caller to
      //       propose the value of the transaction fee. If the proposed transaction
      //       fee is smaller than the sum of fee shares from all the outputs then
      //       use the proposed fee and add the difference to outputs proportionally.
      txTotalFee = txTotalFee.add(request.txMaxFee)

      transaction.addOutput({
        script: bcoin.Script.fromRaw(
          Buffer.from(request.redeemerOutputScript, "hex")
        ),
        value: outputValue.toNumber(),
      })
    }

    // If there is a change output, add it explicitly to the transaction.
    // If we did not add this output explicitly, the bcoin library would add it
    // anyway during funding, but if the value of the change output was very low,
    // the library would consider it "dust" and add it to the fee rather than
    // create a new output.
    const changeOutputValue = mainUtxo.value
      .sub(totalOutputsValue)
      .sub(txTotalFee)
    if (changeOutputValue.gt(0)) {
      transaction.addOutput({
        script: bcoin.Script.fromAddress(walletAddress),
        value: changeOutputValue.toNumber(),
      })
    }

    await transaction.fund(inputCoins, {
      changeAddress: walletAddress,
      hardFee: txTotalFee.toNumber(),
      subtractFee: false,
    })

    transaction.sign(walletKeyRing)

    const transactionHash = BitcoinTxHash.from(transaction.txid())
    // If there is a change output, it will be the new wallet's main UTXO.
    const newMainUtxo = changeOutputValue.gt(0)
      ? {
          transactionHash,
          // It was the last output added to the transaction.
          outputIndex: transaction.outputs.length - 1,
          value: changeOutputValue,
        }
      : undefined

    return {
      transactionHash,
      newMainUtxo,
      rawTransaction: {
        transactionHex: transaction.toRaw().toString("hex"),
      },
    }
  }
}
