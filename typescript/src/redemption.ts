import bcoin from "bcoin"
import { BigNumber } from "ethers"
import {
  createKeyRing,
  decomposeRawTransaction,
  RawTransaction,
  UnspentTransactionOutput,
  Client as BitcoinClient,
  TransactionHash,
} from "./bitcoin"
import { Bridge, Identifier, TBTCToken } from "./chain"
import { assembleTransactionProof } from "./proof"
import { determineWalletMainUtxo, WalletState } from "./wallet"
import { BitcoinNetwork } from "./bitcoin-network"
import { Hex } from "./hex"

/**
 * Represents a redemption request.
 */
export interface RedemptionRequest {
  /**
   * On-chain identifier of the redeemer.
   */
  redeemer: Identifier

  /**
   * The output script the redeemed Bitcoin funds are locked to. It is un-prefixed
   * and is not prepended with length.
   */
  redeemerOutputScript: string

  /**
   * The amount of Bitcoins in satoshis that is requested to be redeemed.
   * The actual value of the output in the Bitcoin transaction will be decreased
   * by the sum of the fee share and the treasury fee for this particular output.
   */
  requestedAmount: BigNumber

  /**
   * The amount of Bitcoins in satoshis that is subtracted from the amount of
   * the redemption request and used to pay the treasury fee.
   * The value should be exactly equal to the value of treasury fee in the Bridge
   * on-chain contract at the time the redemption request was made.
   */
  treasuryFee: BigNumber

  /**
   * The maximum amount of Bitcoins in satoshis that can be subtracted from the
   * redemption's `requestedAmount` to pay the transaction network fee.
   */
  txMaxFee: BigNumber

  /**
   * UNIX timestamp the request was created at.
   */
  requestedAt: number
}

/**
 * Requests a redemption of tBTC into BTC.
 * @param walletPublicKey - The Bitcoin public key of the wallet. Must be in the
 *        compressed form (33 bytes long with 02 or 03 prefix).
 * @param mainUtxo - The main UTXO of the wallet. Must match the main UTXO held
 *        by the on-chain Bridge contract.
 * @param redeemerOutputScript - The output script that the redeemed funds will
 *        be locked to. Must be un-prefixed and not prepended with length.
 * @param amount - The amount to be redeemed with the precision of the tBTC
 *        on-chain token contract.
 * @param tBTCToken - Handle to the TBTCToken on-chain contract.
 * @returns Transaction hash of the request redemption transaction.
 */
export async function requestRedemption(
  walletPublicKey: string,
  mainUtxo: UnspentTransactionOutput,
  redeemerOutputScript: string,
  amount: BigNumber,
  tBTCToken: TBTCToken
): Promise<Hex> {
  return await tBTCToken.requestRedemption(
    walletPublicKey,
    mainUtxo,
    redeemerOutputScript,
    amount
  )
}

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
  mainUtxo: UnspentTransactionOutput,
  redeemerOutputScripts: string[],
  witness: boolean
): Promise<{
  transactionHash: TransactionHash
  newMainUtxo?: UnspentTransactionOutput
}> {
  const mainUtxoRawTransaction = await bitcoinClient.getRawTransaction(
    mainUtxo.transactionHash
  )

  const mainUtxoWithRaw: UnspentTransactionOutput & RawTransaction = {
    ...mainUtxo,
    transactionHex: mainUtxoRawTransaction.transactionHex,
  }

  const redemptionRequests = await getWalletRedemptionRequests(
    bridge,
    createKeyRing(walletPrivateKey).getPublicKey().toString("hex"),
    redeemerOutputScripts,
    "pending"
  )

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
 * Gets a list of wallet's redemption requests from the provided Bridge
 * on-chain contract handle.
 * @dev It is up to the caller of this function to ensure that each of the
 *      redeemer output scripts represents a valid redemption request
 *      in the Bridge on-chain contract. An exception will be thrown if any of
 *      the redeemer output scripts (along with the wallet public key
 *      corresponding to the provided private key) does not represent a valid
 *      redemption request.
 * @param bridge - The handle to the Bridge on-chain contract
 * @param walletPublicKey - Bitcoin public key of the wallet. Must be in the
 *        compressed form (33 bytes long with 02 or 03 prefix).
 * @param redeemerOutputScripts - The list of output scripts that the redeemed
 *        funds are locked to. The output scripts must be un-prefixed and
 *        not prepended with length
 * @param type Type of redemption requests the function will look for. Can be
 *        either `pending` or `timedOut`.
 * @returns The list of redemption requests.
 */
async function getWalletRedemptionRequests(
  bridge: Bridge,
  walletPublicKey: string,
  redeemerOutputScripts: string[],
  type: "pending" | "timedOut"
): Promise<RedemptionRequest[]> {
  const redemptionRequests: RedemptionRequest[] = []

  for (const redeemerOutputScript of redeemerOutputScripts) {
    let redemptionRequest: RedemptionRequest

    switch (type) {
      case "pending": {
        redemptionRequest = await bridge.pendingRedemptions(
          walletPublicKey,
          redeemerOutputScript
        )
        break
      }
      case "timedOut": {
        redemptionRequest = await bridge.timedOutRedemptions(
          walletPublicKey,
          redeemerOutputScript
        )
        break
      }
      default: {
        throw new Error("Unsupported redemption request type")
      }
    }

    if (redemptionRequest.requestedAt == 0) {
      // The requested redemption does not exist among `pendingRedemptions`
      // in the Bridge.
      throw new Error(
        "Provided redeemer output script and wallet public key do not identify a redemption request"
      )
    }

    // Redemption exists in the Bridge. Add it to the list.
    redemptionRequests.push({
      ...redemptionRequest,
      redeemerOutputScript: redeemerOutputScript,
    })
  }

  return redemptionRequests
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
  mainUtxo: UnspentTransactionOutput & RawTransaction,
  redemptionRequests: RedemptionRequest[],
  witness: boolean
): Promise<{
  transactionHash: TransactionHash
  newMainUtxo?: UnspentTransactionOutput
  rawTransaction: RawTransaction
}> {
  if (redemptionRequests.length < 1) {
    throw new Error("There must be at least one request to redeem")
  }

  const walletKeyRing = createKeyRing(walletPrivateKey, witness)
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

  const transactionHash = TransactionHash.from(transaction.txid())
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
  transactionHash: TransactionHash,
  mainUtxo: UnspentTransactionOutput,
  walletPublicKey: string,
  bridge: Bridge,
  bitcoinClient: BitcoinClient
): Promise<void> {
  const confirmations = await bridge.txProofDifficultyFactor()
  const proof = await assembleTransactionProof(
    transactionHash,
    confirmations,
    bitcoinClient
  )
  // TODO: Write a converter and use it to convert the transaction part of the
  // proof to the decomposed transaction data (version, inputs, outputs, locktime).
  // Use raw transaction data for now.
  const rawTransaction = await bitcoinClient.getRawTransaction(transactionHash)
  const decomposedRawTransaction = decomposeRawTransaction(rawTransaction)

  await bridge.submitRedemptionProof(
    decomposedRawTransaction,
    proof,
    mainUtxo,
    walletPublicKey
  )
}

/**
 * Gets a redemption request from the bridge.
 * @param walletPublicKey Bitcoin public key of the wallet the request is
 *        targeted to. Must be in the compressed form (33 bytes long with 02
 *        or 03 prefix).
 * @param redeemerOutputScript The redeemer output script the redeemed funds
 *        are supposed to be locked on. Must be un-prefixed and not prepended
 *        with length.
 * @param type Type of the redemption request the function will look for. Can be
 *        either `pending` or `timedOut`.
 * @param bridge The handle to the Bridge on-chain contract
 * @returns The resulting redemption request.
 */
export async function getRedemptionRequest(
  walletPublicKey: string,
  redeemerOutputScript: string,
  type: "pending" | "timedOut",
  bridge: Bridge
): Promise<RedemptionRequest> {
  const redemptionRequests = await getWalletRedemptionRequests(
    bridge,
    walletPublicKey,
    [redeemerOutputScript],
    type
  )

  if (redemptionRequests.length != 1) {
    throw new Error(`Returned an incorrect number of redemption requests`)
  }

  return redemptionRequests[0]
}

/**
 * Finds the oldest active wallet that has enough BTC to handle a redemption request.
 * @param amount The amount to be redeemed in satoshis.
 * @param redeemerOutputScript The redeemer output script the redeemed funds
 *        are supposed to be locked on. Must be un-prefixed and not prepended
 *        with length.
 * @param bitcoinNetwork Bitcoin network.
 * @param bridge The handle to the Bridge on-chain contract.
 * @param bitcoinClient Bitcoin client used to interact with the network.
 * @returns Promise with the wallet details needed to request a redemption.
 */
export async function findWalletForRedemption(
  amount: BigNumber,
  redeemerOutputScript: string,
  bitcoinNetwork: BitcoinNetwork,
  bridge: Bridge,
  bitcoinClient: BitcoinClient
): Promise<{
  walletPublicKey: string
  mainUtxo: UnspentTransactionOutput
}> {
  const wallets = await bridge.getNewWalletRegisteredEvents()

  let walletData:
    | {
        walletPublicKey: string
        mainUtxo: UnspentTransactionOutput
      }
    | undefined = undefined
  let maxAmount = BigNumber.from(0)

  for (const wallet of wallets) {
    const { walletPublicKeyHash } = wallet
    const { state, walletPublicKey, pendingRedemptionsValue } =
      await bridge.wallets(walletPublicKeyHash)

    // Wallet must be in Live state.
    if (state !== WalletState.Live) {
      console.debug(
        `Wallet is not in Live state ` +
          `(wallet public key hash: ${walletPublicKeyHash.toString()}). ` +
          `Continue the loop execution to the next wallet...`
      )
      continue
    }

    // Wallet must have a main UTXO that can be determined.
    const mainUtxo = await determineWalletMainUtxo(
      walletPublicKeyHash,
      bridge,
      bitcoinClient,
      bitcoinNetwork
    )
    if (!mainUtxo) {
      console.debug(
        `Could not find matching UTXO on chains ` +
          `for wallet public key hash (${walletPublicKeyHash.toString()}). ` +
          `Continue the loop execution to the next wallet...`
      )
      continue
    }

    const pendingRedemption = await bridge.pendingRedemptions(
      walletPublicKey.toString(),
      redeemerOutputScript
    )

    if (pendingRedemption.requestedAt != 0) {
      console.debug(
        `There is a pending redemption request from this wallet to the ` +
          `same Bitcoin address. Given wallet public key hash` +
          `(${walletPublicKeyHash.toString()}) and redeemer output script ` +
          `(${redeemerOutputScript}) pair can be used for only one ` +
          `pending request at the same time. ` +
          `Continue the loop execution to the next wallet...`
      )
      continue
    }

    const walletBTCBalance = mainUtxo.value.sub(pendingRedemptionsValue)

    // Save the max possible redemption amount.
    maxAmount = walletBTCBalance.gt(maxAmount) ? walletBTCBalance : maxAmount

    if (walletBTCBalance.gte(amount)) {
      walletData = {
        walletPublicKey: walletPublicKey.toString(),
        mainUtxo,
      }

      break
    }

    console.debug(
      `The wallet (${walletPublicKeyHash.toString()})` +
        `cannot handle the redemption request. ` +
        `Continue the loop execution to the next wallet...`
    )
  }

  if (!walletData)
    throw new Error(
      `Could not find a wallet with enough funds. Maximum redemption amount is ${maxAmount} Satoshi.`
    )

  return walletData
}
