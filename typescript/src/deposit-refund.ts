import { BigNumber } from "ethers"
import { Transaction, Stack, Signer, script } from "bitcoinjs-lib"
import {
  RawTransaction,
  Client as BitcoinClient,
  TransactionHash,
  UnspentTransactionOutput,
  computeHash160,
  isCompressedPublicKey,
  createOutputScriptFromAddress,
  isP2SHScript,
  isP2WSHScript,
} from "./bitcoin"
import {
  assembleDepositScript,
  Deposit,
  validateDepositScriptParameters,
} from "./deposit"
import { ECPairFactory } from "ecpair"
import * as tinysecp from "tiny-secp256k1"
import { BitcoinNetwork, toBitcoinJsLibNetwork } from "./bitcoin-network"

/**
 * Submits a deposit refund by creating and broadcasting a Bitcoin P2(W)PKH
 * deposit refund transaction.
 * @param bitcoinClient - Bitcoin client used to interact with the network.
 * @param fee - the value that will be subtracted from the deposit UTXO being
 *        refunded and used as the transaction fee.
 * @param utxo - UTXO that was created during depositing that needs be refunded.
 * @param deposit - Details of the deposit being refunded. It should contain
 *        the same data that was used during depositing.
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
export async function submitDepositRefundTransaction(
  bitcoinClient: BitcoinClient,
  fee: BigNumber,
  utxo: UnspentTransactionOutput,
  deposit: Deposit,
  refunderAddress: string,
  refunderPrivateKey: string
): Promise<{ transactionHash: TransactionHash }> {
  const utxoRawTransaction = await bitcoinClient.getRawTransaction(
    utxo.transactionHash
  )

  const utxoWithRaw = {
    ...utxo,
    transactionHex: utxoRawTransaction.transactionHex,
  }

  const bitcoinNetwork = await bitcoinClient.getNetwork()

  const { transactionHash, rawTransaction } =
    await assembleDepositRefundTransaction(
      bitcoinNetwork,
      fee,
      utxoWithRaw,
      deposit,
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
 * @param bitcoinNetwork - The target Bitcoin network.
 * @param fee - the value that will be subtracted from the deposit UTXO being
 *        refunded and used as the transaction fee.
 * @param utxo - UTXO that was created during depositing that needs be refunded.
 * @param deposit - Details of the deposit being refunded. It should contain
 *        the same data that was used during depositing.
 * @param refunderAddress - Recipient Bitcoin wallet address of the refunded
 *        deposit.
 * @param refunderPrivateKey - Bitcoin wallet private key of the refunder.
 *        It must correspond to the `refundPublicKeyHash` of the deposit script.
 * @returns The outcome consisting of:
 *          - the deposit refund transaction hash,
 *          - the refund transaction in the raw format.
 */
export async function assembleDepositRefundTransaction(
  bitcoinNetwork: BitcoinNetwork,
  fee: BigNumber,
  utxo: UnspentTransactionOutput & RawTransaction,
  deposit: Deposit,
  refunderAddress: string,
  refunderPrivateKey: string
): Promise<{
  transactionHash: TransactionHash
  rawTransaction: RawTransaction
}> {
  validateInputParameters(deposit, utxo)

  const network = toBitcoinJsLibNetwork(bitcoinNetwork)
  // eslint-disable-next-line new-cap
  const refunderKeyPair = ECPairFactory(tinysecp).fromWIF(
    refunderPrivateKey,
    network
  )

  const outputValue = utxo.value.sub(fee)

  const transaction = new Transaction()

  transaction.addInput(
    utxo.transactionHash.reverse().toBuffer(),
    utxo.outputIndex
  )

  const outputScript = createOutputScriptFromAddress(refunderAddress)
  transaction.addOutput(outputScript.toBuffer(), outputValue.toNumber())

  // In order to be able to spend the UTXO being refunded the transaction's
  // locktime must be set to a value equal to or higher than the refund locktime.
  // Additionally, the input's sequence must be set to a value different than
  // `0xffffffff`. These requirements are the result of BIP-65.
  transaction.locktime = locktimeToUnixTimestamp(deposit.refundLocktime)
  transaction.ins[0].sequence = 0xfffffffe

  // Sign the input
  const previousOutput = Transaction.fromHex(utxo.transactionHex).outs[
    utxo.outputIndex
  ]
  const previousOutputValue = previousOutput.value
  const previousOutputScript = previousOutput.script

  if (isP2SHScript(previousOutputScript)) {
    // P2SH deposit UTXO
    await signP2SHDepositInput(
      transaction,
      0,
      deposit,
      previousOutputValue,
      refunderKeyPair
    )
  } else if (isP2WSHScript(previousOutputScript)) {
    // P2WSH deposit UTXO
    await signP2WSHDepositInput(
      transaction,
      0,
      deposit,
      previousOutputValue,
      refunderKeyPair
    )
  } else {
    throw new Error("Unsupported UTXO script type")
  }

  const transactionHash = TransactionHash.from(transaction.getId())

  return {
    transactionHash,
    rawTransaction: {
      transactionHex: transaction.toHex(),
    },
  }
}

/**
 * Assembles the deposit script based on the given deposit details. Performs
 * validations on values and key formats.
 * @param deposit - The deposit details.
 * @param previousOutputValue - Value from the previous transaction output.
 * @param refunderKeyPair - Signer object containing the refunder's key pair.
 * @returns A Promise resolving to the assembled deposit script as a Buffer.
 * @throws Error if there are discrepancies in values or key formats.
 */
async function prepareDepositScript(
  deposit: Deposit,
  previousOutputValue: number,
  refunderKeyPair: Signer
): Promise<Buffer> {
  if (previousOutputValue != deposit.amount.toNumber()) {
    throw new Error("Mismatch between amount in deposit and deposit tx")
  }

  const refunderPublicKey = refunderKeyPair.publicKey.toString("hex")

  if (computeHash160(refunderPublicKey) != deposit.refundPublicKeyHash) {
    throw new Error(
      "Refund public key does not correspond to wallet private key"
    )
  }

  if (!isCompressedPublicKey(refunderPublicKey)) {
    throw new Error("Refunder public key must be compressed")
  }

  // eslint-disable-next-line no-unused-vars
  const { amount, vault, ...depositScriptParameters } = deposit

  const depositScript = Buffer.from(
    await assembleDepositScript(depositScriptParameters),
    "hex"
  )

  return depositScript
}

/**
 * Signs a P2SH deposit transaction input and sets the `scriptSig`.
 * @param transaction - The transaction containing the input to be signed.
 * @param inputIndex - Index pointing to the input within the transaction.
 * @param deposit - Details of the deposit transaction.
 * @param previousOutputValue - The value from the previous transaction output.
 * @param refunderKeyPair - A Signer object with the refunder's public and private
 *        key pair.
 * @returns An empty promise upon successful signing.
 */
async function signP2SHDepositInput(
  transaction: Transaction,
  inputIndex: number,
  deposit: Deposit,
  previousOutputValue: number,
  refunderKeyPair: Signer
) {
  const depositScript = await prepareDepositScript(
    deposit,
    previousOutputValue,
    refunderKeyPair
  )

  const sigHashType = Transaction.SIGHASH_ALL

  const sigHash = transaction.hashForSignature(
    inputIndex,
    depositScript,
    sigHashType
  )

  const signature = script.signature.encode(
    refunderKeyPair.sign(sigHash),
    sigHashType
  )

  const scriptSig: Stack = []
  scriptSig.push(signature)
  scriptSig.push(refunderKeyPair.publicKey)
  scriptSig.push(depositScript)

  transaction.ins[inputIndex].script = script.compile(scriptSig)
}

/**
 * Signs a P2WSH deposit transaction input and sets the witness script.
 * @param transaction - The transaction containing the input to be signed.
 * @param inputIndex - Index pointing to the input within the transaction.
 * @param deposit - Details of the deposit transaction.
 * @param previousOutputValue - The value from the previous transaction output.
 * @param refunderKeyPair - A Signer object with the refunder's public and private
 *        key pair.
 * @returns An empty promise upon successful signing.
 */
async function signP2WSHDepositInput(
  transaction: Transaction,
  inputIndex: number,
  deposit: Deposit,
  previousOutputValue: number,
  refunderKeyPair: Signer
) {
  const depositScript = await prepareDepositScript(
    deposit,
    previousOutputValue,
    refunderKeyPair
  )

  const sigHashType = Transaction.SIGHASH_ALL

  const sigHash = transaction.hashForWitnessV0(
    inputIndex,
    depositScript,
    previousOutputValue,
    sigHashType
  )

  const signature = script.signature.encode(
    refunderKeyPair.sign(sigHash),
    sigHashType
  )

  const witness: Buffer[] = []
  witness.push(signature)
  witness.push(refunderKeyPair.publicKey)
  witness.push(depositScript)

  transaction.ins[inputIndex].witness = witness
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

/**
 * Validates whether the provided input parameters are correct.
 * @param deposit - Data of the deposit to be refunded.
 * @param utxo - UTXO that was created during depositing that needs be refunded.
 * @returns Empty return.
 */
function validateInputParameters(
  deposit: Deposit,
  utxo: UnspentTransactionOutput
) {
  validateDepositScriptParameters(deposit)

  if (!deposit.amount.eq(utxo.value)) {
    throw new Error("Mismatch between provided deposit amount and utxo value")
  }
}
