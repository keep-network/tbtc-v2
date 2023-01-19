import bcoin from "bcoin"
import { BigNumber } from "ethers"
import {
  createKeyRing,
  RawTransaction,
  Client as BitcoinClient,
  TransactionHash,
  UnspentTransactionOutput,
  computeHash160,
  isCompressedPublicKey,
} from "./bitcoin"
import { assembleDepositScript, Deposit } from "./deposit"

export async function submitDepositRefundTransaction(
  bitcoinClient: BitcoinClient,
  fee: BigNumber,
  utxo: UnspentTransactionOutput,
  deposit: Deposit,
  depositorPrivateKey: string,
  witness: boolean
): Promise<{ transactionHash: TransactionHash }> {
  const utxoRawTransaction = await bitcoinClient.getRawTransaction(
    utxo.transactionHash
  )

  const utxoWithRaw = {
    ...utxo,
    transactionHex: utxoRawTransaction.transactionHex,
  }

  const { transactionHash, rawTransaction } =
    await assembleDepositRefundTransaction(
      fee,
      utxoWithRaw,
      deposit,
      depositorPrivateKey,
      witness
    )

  // Note that `broadcast` may fail silently (i.e. no error will be returned,
  // even if the transaction is rejected by other nodes and does not enter the
  // mempool, for example due to an UTXO being already spent).
  await bitcoinClient.broadcast(rawTransaction)

  return { transactionHash }
}

export async function assembleDepositRefundTransaction(
  fee: BigNumber,
  utxo: UnspentTransactionOutput & RawTransaction,
  deposit: Deposit,
  depositorPrivateKey: string,
  witness: boolean
): Promise<{
  transactionHash: TransactionHash
  rawTransaction: RawTransaction
}> {
  const depositorKeyRing = createKeyRing(depositorPrivateKey, witness)
  // TODO: Should we allow the depositor to send the refunded Bitcoins to
  //       arbitrary address? For now, the depositor just sends the Bitcoins to
  //       themselves.
  const depositorAddress = depositorKeyRing.getAddress("string")

  const transaction = new bcoin.MTX()

  transaction.addOutput({
    script: bcoin.Script.fromAddress(depositorAddress),
    value: utxo.value.toNumber(),
  })

  const inputCoin = bcoin.Coin.fromTX(
    bcoin.MTX.fromRaw(utxo.transactionHex, "hex"),
    utxo.outputIndex,
    -1
  )

  await transaction.fund([inputCoin], {
    changeAddress: depositorAddress,
    hardFee: fee.toNumber(),
    subtractFee: true,
  })

  if (transaction.outputs.length != 1) {
    throw new Error("Deposit refund transaction must have only one output")
  }
  transaction.locktime = locktimeToUnixTimestamp(deposit.refundLocktime)
  transaction.inputs[0].sequence = 0xfffffffe

  // Sign the input
  const previousOutpoint = transaction.inputs[0].prevout
  const previousOutput = transaction.view.getOutput(previousOutpoint)
  const previousScript = previousOutput.script

  if (previousScript.isScripthash()) {
    // P2SH UTXO input
    await signP2SHDepositInput(transaction, 0, deposit, depositorKeyRing)
  } else if (previousScript.isWitnessScripthash()) {
    // P2WSH UTXO input
    await signP2WSHDepositInput(transaction, 0, deposit, depositorKeyRing)
  } else {
    throw new Error("Unsupported UTXO script type")
  }

  // Verify the transaction by executing its input scripts.
  const tx = transaction.toTX()
  if (!tx.verify(transaction.view)) {
    throw new Error("Transaction verification failure")
  }

  const transactionHash = TransactionHash.from(transaction.txid())

  return {
    transactionHash,
    rawTransaction: {
      transactionHex: transaction.toRaw().toString("hex"),
    },
  }
}

/**
 * Creates data needed to sign a deposit input.
 * @param transaction - Mutable transaction containing the input.
 * @param inputIndex - Index that points to the input.
 * @param deposit - Data of the deposit.
 * @param depositorKeyRing - Key ring created using the depositor's private key.
 * @returns Data needed to sign the input.
 */
async function prepareInputSignData(
  transaction: any,
  inputIndex: number,
  deposit: Deposit,
  depositorKeyRing: any
): Promise<{
  depositorPublicKey: string
  depositScript: any
  previousOutputValue: number
}> {
  const previousOutpoint = transaction.inputs[inputIndex].prevout
  const previousOutput = transaction.view.getOutput(previousOutpoint)

  if (previousOutput.value != deposit.amount.toNumber()) {
    throw new Error("Mismatch between amount in deposit and deposit tx")
  }

  // TODO: Only keep this check if we decide to always send refunded Bitcoins
  //       to the depositor's address. If we allow the depositor to provide
  //       arbitrary receiver address then this check needs to be removed.
  const depositorPublicKey = depositorKeyRing.getPublicKey("hex")
  if (
    computeHash160(depositorKeyRing.getPublicKey("hex")) !=
    deposit.refundPublicKeyHash
  ) {
    throw new Error(
      "Refund public key does not correspond to depositor private key"
    )
  }

  if (!isCompressedPublicKey(depositorPublicKey)) {
    throw new Error("Depositor public key must be compressed")
  }

  // eslint-disable-next-line no-unused-vars
  const { amount, vault, ...depositScriptParameters } = deposit

  const depositScript = bcoin.Script.fromRaw(
    Buffer.from(await assembleDepositScript(depositScriptParameters), "hex")
  )

  return {
    depositorPublicKey: depositorPublicKey,
    depositScript: depositScript,
    previousOutputValue: previousOutput.value,
  }
}

/**
 * Creates and sets `scriptSig` for the transaction input at the given index by
 * combining signature, depositor's public key and deposit script.
 * @param transaction - Mutable transaction containing the input to be signed.
 * @param inputIndex - Index that points to the input to be signed.
 * @param deposit - Data of the deposit.
 * @param depositorKeyRing - Key ring created using the depositor's private key.
 * @returns Empty promise.
 */
async function signP2SHDepositInput(
  transaction: any,
  inputIndex: number,
  deposit: Deposit,
  depositorKeyRing: any
): Promise<void> {
  const { depositorPublicKey, depositScript, previousOutputValue } =
    await prepareInputSignData(
      transaction,
      inputIndex,
      deposit,
      depositorKeyRing
    )

  const signature: Buffer = transaction.signature(
    inputIndex,
    depositScript,
    previousOutputValue,
    depositorKeyRing.privateKey,
    bcoin.Script.hashType.ALL,
    0 // legacy sighash version
  )
  const scriptSig = new bcoin.Script()
  scriptSig.clear()
  scriptSig.pushData(signature)
  scriptSig.pushData(Buffer.from(depositorPublicKey, "hex"))
  scriptSig.pushData(depositScript.toRaw())
  scriptSig.compile()

  transaction.inputs[inputIndex].script = scriptSig
}

/**
 * Creates and sets witness script for the transaction input at the given index
 * by combining signature, depositor public key and deposit script.
 * @param transaction - Mutable transaction containing the input to be signed.
 * @param inputIndex - Index that points to the input to be signed.
 * @param deposit - Data of the deposit.
 * @param depositorKeyRing - Key ring created using the depositor's private key.
 * @returns Empty promise.
 */
async function signP2WSHDepositInput(
  transaction: any,
  inputIndex: number,
  deposit: Deposit,
  depositorKeyRing: any
): Promise<void> {
  const { depositorPublicKey, depositScript, previousOutputValue } =
    await prepareInputSignData(
      transaction,
      inputIndex,
      deposit,
      depositorKeyRing
    )

  const signature: Buffer = transaction.signature(
    inputIndex,
    depositScript,
    previousOutputValue,
    depositorKeyRing.privateKey,
    bcoin.Script.hashType.ALL,
    1 // segwit sighash version
  )

  const witness = new bcoin.Witness()
  witness.clear()
  witness.pushData(signature)
  witness.pushData(Buffer.from(depositorPublicKey, "hex"))
  witness.pushData(depositScript.toRaw())
  witness.compile()

  transaction.inputs[inputIndex].witness = witness
}

function locktimeToUnixTimestamp(locktime: string): number {
  const bigEndianLocktime = Buffer.from(locktime, "hex")
    .reverse()
    .toString("hex")

  return parseInt(bigEndianLocktime, 16)
}
