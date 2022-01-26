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

async function resolvePreviousSweepScript(
  transaction: bcoin.MTX,
  inputIndex: number,
  walletKeyRing: bcoin.KeyRing
) {
  const previousOutpoint = transaction.inputs[inputIndex].prevout
  const previousOutput = transaction.view.getOutput(previousOutpoint)
  transaction.scriptInput(inputIndex, previousOutput, walletKeyRing)
  transaction.signInput(inputIndex, previousOutput, walletKeyRing)
}

/**
 * Creates and sets `scriptSig` for the transaction input at the given index by
 * combining signature, signing group public key and deposit script.
 * @param transaction - Mutable transaction containing the input to be signed
 * @param inputIndex - Index that points to the input to be signed
 * @param depositData - Array of deposit data
 * @param walletPrivateKey - Bitcoin private key of the wallet.
 * @returns Empty promise.
 */
async function resolveDepositScriptHash(
  transaction: bcoin.MTX,
  inputIndex: number,
  depositData: DepositData,
  walletPrivateKey: bcoin.KeyRing
): Promise<void> {
  const previousOutpoint = transaction.inputs[inputIndex].prevout
  const previousOutput = transaction.view.getOutput(previousOutpoint)

  if (previousOutput.value != depositData.amount.toNumber()) {
    throw new Error("Mismatch between amount in deposit data and deposit tx")
  }

  const depositScript = bcoin.Script.fromRaw(
    Buffer.from(await createDepositScript(depositData), "hex")
  )

  const signingGroupPublicKey = await getActiveWalletPublicKey()
  if (!isCompressedPublicKey(signingGroupPublicKey)) {
    throw new Error("Signing group public key must be compressed")
  }

  const signature: Buffer = transaction.signature(
    inputIndex,
    depositScript,
    previousOutput.value,
    walletPrivateKey.privateKey,
    bcoin.Script.hashType.ALL,
    0
  )
  const scriptSig = new bcoin.Script()
  scriptSig.clear()
  scriptSig.pushData(signature)
  scriptSig.pushData(Buffer.from(signingGroupPublicKey, "hex"))
  scriptSig.pushData(depositScript.toRaw())
  scriptSig.compile()

  transaction.inputs[inputIndex].script = scriptSig
}

/**
 * Creates and sets `scriptSig` for the transaction input at the given index by
 * combining signature, signing group public key and deposit script.
 * @param transaction - Mutable transaction containing the input to be signed
 * @param inputIndex - Index that points to the input to be signed
 * @param depositData - Array of deposit data
 * @param walletPrivateKey - Bitcoin private key of the wallet.
 * @returns Empty promise.
 */
async function resolveDepositWitnessScriptHash(
  transaction: bcoin.MTX,
  inputIndex: number,
  depositData: DepositData,
  walletPrivateKey: bcoin.KeyRing
): Promise<void> {
  const previousOutpoint = transaction.inputs[inputIndex].prevout
  const previousOutput = transaction.view.getOutput(previousOutpoint)

  if (previousOutput.value != depositData.amount.toNumber()) {
    throw new Error("Mismatch between amount in deposit data and deposit tx")
  }

  const depositScript = bcoin.Script.fromRaw(
    Buffer.from(await createDepositScript(depositData), "hex")
  )

  const signingGroupPublicKey = await getActiveWalletPublicKey()
  if (!isCompressedPublicKey(signingGroupPublicKey)) {
    throw new Error("Signing group public key must be compressed")
  }

  const signature: Buffer = transaction.signature(
    inputIndex,
    depositScript,
    previousOutput.value,
    walletPrivateKey.privateKey,
    bcoin.Script.hashType.ALL,
    1
  )

  const witness = new bcoin.Witness()
  witness.clear()
  witness.pushData(signature)
  witness.pushData(Buffer.from(signingGroupPublicKey, "hex"))
  witness.pushData(depositScript.toRaw())
  witness.compile()

  transaction.inputs[inputIndex].witness = witness
}

/**
 * Sweeps UTXOs by combining all the provided UTXOs and broadcasting a Bitcoin
 * P2WPKH sweep transaction.
 * @dev The caller is responsible for ensuring the provided UTXOs are correctly
 *      formed, can be spent by the wallet and their combined value is greater
 *      then the fee.
 * @param bitcoinClient - Bitcoin client used to interact with the network.
 * @param fee - the value that should be subtracted from the sum of the UTXOs
 *              values and used as the transaction fee.
 * @param walletPrivateKey - Bitcoin private key of the wallet.
 * @param utxos - UTXOs to be combined into one output.
 * @param depositData - data on deposits. Each elements corresponds to UTXO.
 *                      The number of UTXOs and deposit data elements must
 *                      equal.
 * @param previousSweepUtxo - UTXO from the previous sweep transaction
 *                            (optional).
 * @returns Empty promise.
 */
export async function sweepDeposits(
  bitcoinClient: BitcoinClient,
  fee: BigNumber,
  walletPrivateKey: string,
  utxos: UnspentTransactionOutput[], // TODO: Update description: utxo can be either P2SH or P2WSH
  depositData: DepositData[],
  previousSweepUtxo?: UnspentTransactionOutput
): Promise<void> {
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

  const rawTransaction = previousSweepUtxo
    ? await bitcoinClient.getRawTransaction(previousSweepUtxo.transactionHash)
    : { transactionHex: "" }

  const previousUtxoWithRaw = previousSweepUtxo
    ? {
        ...previousSweepUtxo,
        transactionHex: rawTransaction.transactionHex,
      }
    : {
        transactionHash: "",
        outputIndex: 0,
        value: 0,
        transactionHex: "",
      }

  const transaction = previousSweepUtxo
    ? await createSweepTransaction(
        fee,
        walletPrivateKey,
        utxosWithRaw,
        depositData,
        previousUtxoWithRaw
      )
    : await createSweepTransaction(
        fee,
        walletPrivateKey,
        utxosWithRaw,
        depositData
      )

  await bitcoinClient.broadcast(transaction)
}

function mapUtxoToDepositData(
  utxos: UnspentTransactionOutput[],
  depositData: DepositData[]
): Map<string, DepositData> {
  if (utxos.length != depositData.length) {
    throw new Error(
      "Number of UTXOs must equal the number of deposit data elements"
    )
  }

  const map = new Map<string, DepositData>()
  for (let i = 0; i < utxos.length; i++) {
    const key = utxos[i].transactionHash + "/" + utxos[i].outputIndex.toString()
    map.set(key, depositData[i])
  }

  return map
}

function buildKey(input: bcoin.Input): string {
  return input.prevout.txid() + "/" + input.prevout.index
}

/**
 * Creates a Bitcoin P2WPKH sweep transaction.
 * @param fee - the value that should be subtracted from the sum of the UTXOs
 *              values and used as the transaction fee.
 * @param walletPrivateKey - Bitcoin private key of the wallet.
 * @param utxos - UTXOs from new deposit transactions.
 * @param depositData - data on deposits. Each elements corresponds to UTXO. The
 *                      number of UTXOs and deposit data elements must equal.
 * @param previousUtxo - UTXO from the previous sweep transaction (optional).
 * @returns Bitcoin sweep transaction in raw format.
 */
export async function createSweepTransaction(
  fee: BigNumber,
  walletPrivateKey: string,
  utxos: (UnspentTransactionOutput & RawTransaction)[],
  depositData: DepositData[],
  previousUtxo?: UnspentTransactionOutput & RawTransaction
): Promise<RawTransaction> {
  const decodedWalletPrivateKey = wif.decode(walletPrivateKey)

  const walletKeyRing = new bcoin.KeyRing({
    witness: true,
    privateKey: decodedWalletPrivateKey.privateKey,
    compressed: decodedWalletPrivateKey.compressed,
  })

  const walletAddress = walletKeyRing.getAddress("string")

  const inputCoins = []
  let totalInputValue = 0

  if (previousUtxo) {
    inputCoins.push(
      bcoin.Coin.fromTX(
        bcoin.MTX.fromRaw(previousUtxo.transactionHex, "hex"),
        previousUtxo.outputIndex,
        -1
      )
    )
    totalInputValue += previousUtxo.value
  }

  for (const utxo of utxos) {
    inputCoins.push(
      bcoin.Coin.fromTX(
        bcoin.MTX.fromRaw(utxo.transactionHex, "hex"),
        utxo.outputIndex,
        -1
      )
    )
    totalInputValue += utxo.value
  }

  const transaction = new bcoin.MTX()

  transaction.addOutput({
    script: bcoin.Script.fromAddress(walletAddress),
    value: totalInputValue,
  })

  await transaction.fund(inputCoins, {
    changeAddress: walletAddress,
    hardFee: fee.toNumber(),
    subtractFee: true,
  })

  // UTXOs must be mapped to deposit data, as `fund` may arrange inputs in any
  // order
  const utxosToDepositData = mapUtxoToDepositData(utxos, depositData)

  for (let i = 0; i < transaction.inputs.length; i++) {
    const previousOutpoint = transaction.inputs[i].prevout
    const previousOutput = transaction.view.getOutput(previousOutpoint)
    const previousScript = previousOutput.script

    if (previousScript.isWitnessPubkeyhash()) {
      // P2WKH (previous sweep UTXO)
      await resolvePreviousSweepScript(transaction, i, walletKeyRing)
    } else if (previousScript.isScripthash()) {
      // P2SH (deposit UTXO)
      const key = buildKey(transaction.inputs[i])
      const data = utxosToDepositData.get(key)!

      await resolveDepositScriptHash(transaction, i, data, walletKeyRing)
    } else if (previousScript.isWitnessScripthash()) {
      // P2WSH (deposit UTXO)
      const key = buildKey(transaction.inputs[i])
      const data = utxosToDepositData.get(key)!

      await resolveDepositWitnessScriptHash(transaction, i, data, walletKeyRing)
    } else {
      throw new Error("Unsupported UTXO script type")
    }
  }

  return {
    transactionHex: transaction.toRaw().toString("hex"),
  }
}
