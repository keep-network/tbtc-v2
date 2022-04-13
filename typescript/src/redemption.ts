// @ts-ignore
import bcoin from "bcoin"
// @ts-ignore
import wif from "wif"
import { BigNumber } from "ethers"
import {
  RawTransaction,
  UnspentTransactionOutput,
  Client as BitcoinClient,
} from "./bitcoin"

/**
 * Contains information needed to fulfill a redemption request.
 */
export interface RedemptionRequest {
  /**
   * The address that is the recipient of the redeemed Bitcoins.
   * The type of the address may be:
   *  - public key hash,
   *  - script hash,
   *  - witness public key hash,
   *  - witness script hash.
   */
  address: string

  /**
   * The amount of Bitcoins in satoshis that is requested to be redeemed.
   * The actual value of the output in the Bitcoin transaction will be decreased
   * by the fee.
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
  outputFee: BigNumber
}

export async function redeemDeposits(
  bitcoinClient: BitcoinClient,
  walletPrivateKey: string,
  mainUtxo: UnspentTransactionOutput,
  redemptionRequests: RedemptionRequest[]
): Promise<void> {
  console.log("redeemDeposits called")

  const rawTransaction = await bitcoinClient.getRawTransaction(
    mainUtxo.transactionHash
  )

  const mainUtxoWithRaw: UnspentTransactionOutput & RawTransaction = {
    ...mainUtxo,
    transactionHex: rawTransaction.transactionHex,
  }

  const transaction = await createRedemptionTransaction(
    walletPrivateKey,
    mainUtxoWithRaw,
    redemptionRequests
  )

  // Note that `broadcast` may fail silently (i.e. no error will be returned,
  // even if the transaction is rejected by other nodes and does not enter the
  // mempool, for example due to an UTXO being already spent).
  await bitcoinClient.broadcast(transaction)
}

export async function createRedemptionTransaction(
  walletPrivateKey: string,
  mainUtxo: UnspentTransactionOutput & RawTransaction,
  redemptionRequests: RedemptionRequest[]
): Promise<RawTransaction> {
  if (redemptionRequests.length < 1) {
    throw new Error("There must be at least one request to redeem")
  }

  const decodedWalletPrivateKey = wif.decode(walletPrivateKey)

  const walletKeyRing = new bcoin.KeyRing({
    witness: true,
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
  for (const request of redemptionRequests) {
    // TODO: Check the address is one of the four supported types
    // (PKH, SH, WPKH, WSH)
    txFee += request.outputFee.toNumber()
    const outputValue = request.amount.sub(request.outputFee)

    transaction.addOutput({
      script: bcoin.Script.fromAddress(request.address),
      value: outputValue.toNumber(),
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
