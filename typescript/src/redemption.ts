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
  address: string

  /**
   * The amount of Bitcoins in satoshis that is requested to be redeemed.
   * The actual value of the output in the Bitcoin transaction will be decreased
   * by the sum of the fee share and the treasury fee for this particular output.
   */
  amount: BigNumber

  /**
   * The amount of Bitcoins in satoshis that is subtracted from the amount in
   * redemption request and used to pay for the transaction.
   * The value should not be greater than the max fee in the Bridge on-chain
   * contract at the time the redemption request was made.
   * The sum of all output fee values makes the total fee of the redemption
   * transaction.
   */
  feeShare: BigNumber

  /**
   * The amount of Bitcoins in satoshis that is subtracted from the amount in
   * redemption request and used to pay the treasury fee.
   * The value should be equal exactly the value of treasury fee in the Bridge
   * on-chain contract at the time the redemption request was made.
   */
  treasuryFee: BigNumber
}

// TODO: Description
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

// TODO: Description
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
    const outputValue = request.amount
      .sub(request.feeShare)
      .sub(request.treasuryFee)

    // Add the output value to the total output value
    totalOutputValue += outputValue.toNumber()

    // Add the fee for this particular request to the overall transaction fee
    txFee += request.feeShare.toNumber()

    // Only allow standard address type to receive the redeemed Bitcoins
    const address = bcoin.Address.fromString(request.address)
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

function buildOutputScript(address: string): string {
  const script = bcoin.Script.fromAddress(address)
  const scriptAsStr = script.toRaw().toString("hex")
  const scriptLength = scriptAsStr.length / 2 // get length in bytes

  return "0x" + scriptLength.toString(16) + scriptAsStr
}

function getWalletPublicKey(walletPrivateKey: string): string {
  const decodedWalletPrivateKey = wif.decode(walletPrivateKey)

  const walletKeyRing = new bcoin.KeyRing({
    privateKey: decodedWalletPrivateKey.privateKey,
    compressed: decodedWalletPrivateKey.compressed,
  })

  return walletKeyRing.getPublicKey().toString("hex")
}

async function prepareRedemptionRequests(
  bridge: Bridge,
  walletPrivateKey: string,
  redeemerAddresses: string[]
): Promise<RedemptionRequest[]> {
  const walletPublicKey = getWalletPublicKey(walletPrivateKey)

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
    if (pendingRedemption.requestedAt > 0) {
      redemptionRequests.push({
        address: redeemerAddress,
        amount: pendingRedemption.requestedAmount,
        // TODO: Use max fee for now.
        // In the future we could use a smaller amount if we know if the
        // transaction will be picked by the miners.
        feeShare: pendingRedemption.txMaxFee,
        treasuryFee: pendingRedemption.treasuryFee,
      })
    }
    // TODO: What should we do if the redemption is not found?
  }

  return redemptionRequests
}
