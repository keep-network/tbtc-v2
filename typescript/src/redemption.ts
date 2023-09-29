import bcoin from "bcoin"
import { BigNumber } from "ethers"
import {
  assembleBitcoinSpvProof,
  BitcoinPrivateKeyUtils,
  extractBitcoinRawTxVectors,
  BitcoinRawTx,
  BitcoinUtxo,
  BitcoinClient,
  BitcoinTxHash,
} from "./lib/bitcoin"
import { Bridge, RedemptionRequest } from "./lib/contracts"

/**
 * Handles pending redemption requests by creating a redemption transaction
 * transferring Bitcoins from the wallet's main UTXO to the provided redeemer
 * output scripts and broadcasting it. The change UTXO resulting from the
 * transaction becomes the new main UTXO of the wallet.
 * @dev It is up to the caller to ensure the wallet key and each of the redeemer
 *      output scripts represent a valid pending redemption request in the Bridge.
 *      If this is not the case, an exception will be thrown.
 * @param bitcoinClient - The Bitcoin client used to interact with the network
 * @param bridge - The handle to the Bridge on-chain contract
 * @param walletPrivateKey - The private kay of the wallet in the WIF format
 * @param mainUtxo - The main UTXO of the wallet. Must match the main UTXO
 *        held by the on-chain Bridge contract
 * @param redeemerOutputScripts - The list of output scripts that the redeemed
 *        funds will be locked to. The output scripts must be un-prefixed and
 *        not prepended with length
 * @param witness - The parameter used to decide about the type of the change
 *        output. P2WPKH if `true`, P2PKH if `false`
 * @returns The outcome consisting of:
 *          - the redemption transaction hash,
 *          - the optional new wallet's main UTXO produced by this transaction.
 */
export async function submitRedemptionTransaction(
  bitcoinClient: BitcoinClient,
  bridge: Bridge,
  walletPrivateKey: string,
  mainUtxo: BitcoinUtxo,
  redeemerOutputScripts: string[],
  witness: boolean
): Promise<{
  transactionHash: BitcoinTxHash
  newMainUtxo?: BitcoinUtxo
}> {
  const mainUtxoRawTransaction = await bitcoinClient.getRawTransaction(
    mainUtxo.transactionHash
  )

  const mainUtxoWithRaw: BitcoinUtxo & BitcoinRawTx = {
    ...mainUtxo,
    transactionHex: mainUtxoRawTransaction.transactionHex,
  }

  const walletPublicKey = BitcoinPrivateKeyUtils.createKeyRing(walletPrivateKey)
    .getPublicKey()
    .toString("hex")

  const redemptionRequests: RedemptionRequest[] = []

  for (const redeemerOutputScript of redeemerOutputScripts) {
    const redemptionRequest = await bridge.pendingRedemptions(
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
    await assembleRedemptionTransaction(
      walletPrivateKey,
      mainUtxoWithRaw,
      redemptionRequests,
      witness
    )

  // Note that `broadcast` may fail silently (i.e. no error will be returned,
  // even if the transaction is rejected by other nodes and does not enter the
  // mempool, for example due to an UTXO being already spent).
  await bitcoinClient.broadcast(rawTransaction)

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
 * @param witness - The parameter used to decide the type of the change output.
 *        P2WPKH if `true`, P2PKH if `false`
 * @returns The outcome consisting of:
 *          - the redemption transaction hash,
 *          - the optional new wallet's main UTXO produced by this transaction.
 *          - the redemption transaction in the raw format
 */
export async function assembleRedemptionTransaction(
  walletPrivateKey: string,
  mainUtxo: BitcoinUtxo & BitcoinRawTx,
  redemptionRequests: RedemptionRequest[],
  witness: boolean
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
    witness
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

/**
 * Prepares the proof of a redemption transaction and submits it to the
 * Bridge on-chain contract.
 * @param transactionHash - Hash of the transaction being proven.
 * @param mainUtxo - Recent main UTXO of the wallet as currently known on-chain.
 * @param walletPublicKey - Bitcoin public key of the wallet. Must be in the
 *        compressed form (33 bytes long with 02 or 03 prefix).
 * @param bridge - Handle to the Bridge on-chain contract.
 * @param bitcoinClient - Bitcoin client used to interact with the network.
 * @returns Empty promise.
 */
export async function submitRedemptionProof(
  transactionHash: BitcoinTxHash,
  mainUtxo: BitcoinUtxo,
  walletPublicKey: string,
  bridge: Bridge,
  bitcoinClient: BitcoinClient
): Promise<void> {
  const confirmations = await bridge.txProofDifficultyFactor()
  const proof = await assembleBitcoinSpvProof(
    transactionHash,
    confirmations,
    bitcoinClient
  )
  // TODO: Write a converter and use it to convert the transaction part of the
  // proof to the decomposed transaction data (version, inputs, outputs, locktime).
  // Use raw transaction data for now.
  const rawTransaction = await bitcoinClient.getRawTransaction(transactionHash)
  const rawTransactionVectors = extractBitcoinRawTxVectors(rawTransaction)

  await bridge.submitRedemptionProof(
    rawTransactionVectors,
    proof,
    mainUtxo,
    walletPublicKey
  )
}
