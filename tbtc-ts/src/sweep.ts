// @ts-ignore
import bcoin from "bcoin"
// @ts-ignore
import wif from "wif"
import { BigNumber } from "ethers"
import {
  RawTransaction,
  UnspentTransactionOutput,
  Client as BitcoinClient,
  isCompressedPublicKey,
} from "./bitcoin"
import {
  createDepositScript,
  getActiveWalletPublicKey,
  DepositData,
} from "./deposit"

// TODO: Add description
export async function createScriptSig(
  signature: Buffer,
  depositScript: Buffer
): Promise<bcoin.Script> {
  // Get the active wallet public key and use it as signing group public key.
  const signingGroupPublicKey = await getActiveWalletPublicKey()
  if (!isCompressedPublicKey(signingGroupPublicKey)) {
    throw new Error("Signing group public key must be compressed")
  }
  const scriptSig = new bcoin.Script()
  scriptSig.clear()
  scriptSig.pushData(signature)
  scriptSig.pushData(Buffer.from(signingGroupPublicKey, "hex"))
  scriptSig.pushData(depositScript)
  scriptSig.compile()
  return scriptSig
}

/**
 * Sweeps UTXOs by combining all the provided UTXOs and broadcasting a Bitcoin
 * P2WPKH sweep transaction.
 * @dev The caller is responsible for ensuring the provided UTXOs are correctly
 *      formed, can be spent by the wallet and their combined value is greater
 *      then the fee.
 * @param utxos - UTXOs to be combined into one output.
 * @param depositData - data on deposits. Each elements corresponds to UTXO. The
 *                      number of UTXOs and deposit data elements must equal.
 * @param fee - the value that should be subtracted from the sum of the UTXOs
 *              values and used as the transaction fee.
 * @param walletPrivateKey - Bitcoin private key of the wallet.
 * @param bitcoinClient - Bitcoin client used to interact with the network.
 * @returns Empty promise.
 */
export async function sweepDeposits(
  utxos: UnspentTransactionOutput[],
  depositData: DepositData[],
  fee: BigNumber,
  walletPrivateKey: string,
  bitcoinClient: BitcoinClient
): Promise<void> {
  if (utxos.length != depositData.length) {
    throw new Error(
      "Number of UTXOs must equal the number of deposit data elements"
    )
  }

  const utxosWithRaw: (UnspentTransactionOutput & RawTransaction)[] = []
  for (const utxo of utxos) {
    const rawTransaction = await bitcoinClient.getRawTransaction(
      utxo.transactionHash
    )

    utxosWithRaw.push({
      ...utxo,
      transactionHex: rawTransaction.transactionHex,
    })
  }

  const transaction = await createSweepTransaction(
    utxosWithRaw,
    depositData,
    fee,
    walletPrivateKey
  )

  await bitcoinClient.broadcast(transaction)
}

/**
 * Creates a Bitcoin P2WPKH sweep transaction.
 * @param utxos - UTXOs that should be used as transaction inputs.
 * @param depositData - data on deposits. Each elements corresponds to UTXO. The
 *                      number of UTXOs and deposit data elements must equal.
 * @param fee - the value that should be subtracted from the sum of the UTXOs
 *              values and used as the transaction fee.
 * @param walletPrivateKey - Bitcoin private key of the wallet.
 * @returns Bitcoin sweep transaction in raw format.
 */
export async function createSweepTransaction(
  utxos: (UnspentTransactionOutput & RawTransaction)[],
  depositData: DepositData[],
  fee: BigNumber,
  walletPrivateKey: string
): Promise<RawTransaction> {
  const decodedWalletPrivateKey = wif.decode(walletPrivateKey)

  const walletKeyRing = new bcoin.KeyRing({
    witness: true,
    privateKey: decodedWalletPrivateKey.privateKey,
    compressed: decodedWalletPrivateKey.compressed,
  })

  const walletAddress = walletKeyRing.getAddress("string")

  const inputCoins = []
  let totalInputValue = BigNumber.from(0)

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

  for (let i = 0; i < transaction.inputs.length; i++) {
    const previousOutpoint = transaction.inputs[i].prevout
    const previousOutput = transaction.view.getOutput(previousOutpoint)
    const depositScript = bcoin.Script.fromRaw(
      Buffer.from(await createDepositScript(depositData[i]), "hex")
    )
    const signature: Buffer = transaction.signature(
      i,
      depositScript,
      previousOutput.value,
      walletKeyRing.privateKey,
      null,
      0
    )
    const scriptSig = await createScriptSig(signature, depositScript)
    transaction.inputs[i].script = scriptSig
  }

  return {
    transactionHex: transaction.toRaw().toString("hex"),
  }
}
