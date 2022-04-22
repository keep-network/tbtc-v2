// @ts-ignore
import bcoin from "bcoin"
// @ts-ignore
import wif from "wif"
// @ts-ignore
import hash160 from "bcrypto/lib/hash160"
import { BigNumber, utils } from "ethers"
import {
  RawTransaction,
  UnspentTransactionOutput,
  Client as BitcoinClient,
} from "./bitcoin"
import { Bridge } from "./bridge"

/**
 * Contains information needed to fulfill a redemption request.
 */
export interface RedemptionRequest {
  /**
   * The address that is the recipient of the redeemed Bitcoins.
   * The type of the address must be P2PKH, P2WPKH, P2SH or P2WSH.
   */
  redeemerAddress: string

  /**
   * The amount of Bitcoins in satoshis that is requested to be redeemed.
   * The actual value of the output in the Bitcoin transaction will be decreased
   * by the sum of the fee share and the treasury fee for this particular output.
   */
  requestedAmount: BigNumber

  /**
   * The amount of Bitcoins in satoshis that is subtracted from the amount in
   * redemption request and used to pay the treasury fee.
   * The value should be equal exactly the value of treasury fee in the Bridge
   * on-chain contract at the time the redemption request was made.
   */
  treasuryFee: BigNumber

  /**
   * The amount of Bitcoins in satoshis that is subtracted from the amount in
   * redemption request and used to pay for the transaction.
   * The value should not be greater than the max fee in the Bridge on-chain
   * contract at the time the redemption request was made.
   * The sum of all output fee values makes the total fee of the redemption
   * transaction.
   */
  feeShare: BigNumber
}

/**
 * Redeems deposited tBTC by creating a redemption transaction transferring
 * Bitcoins from the wallet's main UTXO to the redeemer addresses and
 * broadcasting it. The change UTXO resulting from the transaction becomes
 * the new main UTXO of the wallet.
 * @dev It is up to the caller to ensure the wallet key and each of the redeemer
 *      addresses represent a valid pending redemption request in the Bridge.
 * @param bitcoinClient - The Bitcoin client used to interact with the network.
 * @param bridge - The Interface used to interact with the Bridge on-chain contract.
 * @param walletPrivateKey = The private kay of the wallet in the WIF format.
 * @param mainUtxo - The main UTXO of the wallet.
 * @param redeemerAddresses - The list of redeemer addresses.
 * @param witness - The parameter used to decide the type of the change output.
 *                  P2WPKH if `true`, P2PKH if `false`.
 * @returns Empty promise.
 */
export async function redeemDeposits(
  bitcoinClient: BitcoinClient,
  bridge: Bridge,
  walletPrivateKey: string,
  mainUtxo: UnspentTransactionOutput,
  redeemerAddresses: string[],
  witness: boolean
): Promise<void> {
  const rawTransaction = await bitcoinClient.getRawTransaction(
    mainUtxo.transactionHash
  )

  const mainUtxoWithRaw: UnspentTransactionOutput & RawTransaction = {
    ...mainUtxo,
    transactionHex: rawTransaction.transactionHex,
  }

  const redemptionRequests = await prepareRedemptionRequests(
    bridge,
    walletPrivateKey,
    redeemerAddresses
  )

  const transaction = await createRedemptionTransaction(
    walletPrivateKey,
    mainUtxoWithRaw,
    redemptionRequests,
    witness
  )

  // Note that `broadcast` may fail silently (i.e. no error will be returned,
  // even if the transaction is rejected by other nodes and does not enter the
  // mempool, for example due to an UTXO being already spent).
  await bitcoinClient.broadcast(transaction)
}

/**
 * Creates a Bitcoin redemption transaction.
 * The transaction will have a single input (main UTXO) and an output for each
 * redemption request provided and a change output if the redemption requests
 * do not consume all the Bitcoins from the main UTXO.
 * @dev The caller is responsible for ensuring the redemption request list is
 *      correctly formed:
 *        - there is at least one redemption
 *        - the `requestedAmount` in each redemption request is greater than
 *          the sum of its `feeShare` and `treasuryFee`.
 *        - the redeemer address in each redemption request is of a standard
 *          type (P2PKH, P2WPKH, P2SH, P2WSH).
 * @param walletPrivateKey  - The private key of the wallet in the WIF format.
 * @param mainUtxo - The main UTXO of the wallet.
 * @param redemptionRequests - The list of redemption requests
 * @param witness - The parameter used to decide the type of the change output.
 *                  P2WPKH if `true`, P2PKH if `false`.
 * @returns Bitcoin redemption transaction in the raw format.
 */
export async function createRedemptionTransaction(
  walletPrivateKey: string,
  mainUtxo: UnspentTransactionOutput & RawTransaction,
  redemptionRequests: RedemptionRequest[],
  witness: boolean
): Promise<RawTransaction> {
  if (redemptionRequests.length < 1) {
    throw new Error("There must be at least one request to redeem")
  }

  const decodedWalletPrivateKey = wif.decode(walletPrivateKey)

  const walletKeyRing = new bcoin.KeyRing({
    witness: witness,
    privateKey: decodedWalletPrivateKey.privateKey,
    compressed: decodedWalletPrivateKey.compressed,
  })

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

  let txFee = 0
  let totalOutputValue = 0

  // Process the requests
  for (const request of redemptionRequests) {
    // Calculate the value of the output by subtracting fee share and treasury
    // fee for this particular output from the requested amount
    const outputValue = request.requestedAmount
      .sub(request.feeShare)
      .sub(request.treasuryFee)

    // Add the output value to the total output value
    totalOutputValue += outputValue.toNumber()

    // Add the fee for this particular request to the overall transaction fee
    txFee += request.feeShare.toNumber()

    // Only allow standard address type to receive the redeemed Bitcoins
    const address = bcoin.Address.fromString(request.redeemerAddress)
    if (
      address.isPubkeyhash() ||
      address.isWitnessPubkeyhash() ||
      address.isScripthash() ||
      address.isWitnessScripthash()
    ) {
      transaction.addOutput({
        script: bcoin.Script.fromAddress(address),
        value: outputValue.toNumber(),
      })
    } else {
      throw new Error("Redemption address must be P2PKH, P2WPKH, P2SH or P2WSH")
    }
  }

  // If there is a change output, add it explicitly to the transaction.
  // If we did not add this output explicitly, the bcoin library would add it
  // anyway during funding, but if the value of the change output was very low,
  // the library would consider it "dust" and add it to the fee rather than
  // create a new output.
  const changeOutputValue = mainUtxo.value - totalOutputValue - txFee
  if (changeOutputValue > 0) {
    transaction.addOutput({
      script: bcoin.Script.fromAddress(walletAddress),
      value: changeOutputValue,
    })
  }

  await transaction.fund(inputCoins, {
    changeAddress: walletAddress,
    hardFee: txFee,
    subtractFee: false,
  })

  transaction.sign(walletKeyRing)

  return {
    transactionHex: transaction.toRaw().toString("hex"),
  }
}
/**
 * Builds a length prefixed output script based on the provided address (P2PKH,
 * P2WPKH, P2SH or P2WSH).
 * @param address - Bitcoin address from which the output script will be build
 * @returns The output script as a string.
 */
function buildOutputScript(address: string): string {
  const script = bcoin.Script.fromAddress(address)
  const scriptAsStr = script.toRaw().toString("hex")
  const scriptLength = scriptAsStr.length / 2 // get length in bytes

  return "0x" + scriptLength.toString(16) + scriptAsStr
}

/**
 * Returns the Bitcoin public key in the compressed format corresponding to
 * the provided private key.
 * @param privateKey - The private key of in the WIF format.
 * @returns The public key of as a string.
 */
function getPublicKey(privateKey: string): string {
  const decodedPrivateKey = wif.decode(privateKey)

  const keyRing = new bcoin.KeyRing({
    privateKey: decodedPrivateKey.privateKey,
    compressed: decodedPrivateKey.compressed,
  })

  return keyRing.getPublicKey().toString("hex")
}

/**
 * Prepares a list of redemption requests based on the provided redeemer
 * addresses and the wallet key. The information on the redemption requests
 * is acquired by connecting to the provided Bridge contract interface.
 * @dev It is up to the caller of this function to ensure that each of the
 *      addresses represent a valid pending redemption request in the Bridge
 *      on-chain contract. If the given address (along with the wallet public
 *      key corresponding to the provided private key) does not represent a
 *      valid pending redemption, this address will be skipped.
 * @param bridge The interface to the Bridge on-chain contract.
 * @param walletPrivateKey The private key of the wallet in the WIF format.
 * @param redeemerAddresses The addresses that will be the recipients of the
 *                          redeemed Bitcoins.
 * @returns The list of redemption requests.
 */
async function prepareRedemptionRequests(
  bridge: Bridge,
  walletPrivateKey: string,
  redeemerAddresses: string[]
): Promise<RedemptionRequest[]> {
  const walletPublicKey = getPublicKey(walletPrivateKey)

  const walletPubKeyHash =
    "0x" + hash160.digest(Buffer.from(walletPublicKey, "hex")).toString("hex")

  const redemptionRequests: RedemptionRequest[] = []

  for (const redeemerAddress of redeemerAddresses) {
    const redeemerOutputScript = buildOutputScript(redeemerAddress)

    const redemptionKey = utils.solidityKeccak256(
      ["bytes20", "bytes"],
      [walletPubKeyHash, redeemerOutputScript]
    )

    const pendingRedemption = await bridge.getPendingRedemptions(redemptionKey)

    // If the pending redemption was found in the Bridge, add it to the list of
    // redemption requests. Otherwise, skip it.

    // TODO: Use `txMaxFee` as the `feeShare` for now.
    // In the future allow the caller to propose the value of transaction fee.
    // If the proposed transaction fee is smaller than the sum of fee shares from
    // all the outputs then use the proposed fee and add the difference to outputs
    // proportionally.
    if (pendingRedemption.requestedAt > 0) {
      redemptionRequests.push({
        redeemerAddress: redeemerAddress,
        requestedAmount: pendingRedemption.requestedAmount,
        feeShare: pendingRedemption.txMaxFee,
        treasuryFee: pendingRedemption.treasuryFee,
      })
    }
  }

  return redemptionRequests
}
