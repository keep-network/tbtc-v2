// @ts-ignore
import { TX } from "bcoin"
// @ts-ignore
import bufio from "bufio"
// @ts-ignore
import { StaticWriter, BufferWriter } from "bufio"
import {
  Proof,
  TransactionData,
  Client as BitcoinClient,
  SweepProof,
} from "./bitcoin"

/**
 * Gets SPV transaction proof.
 * @param txHash - Transaction hash.
 * @param confirmations - Required number of confirmations for the transaction.
 * @param bitcoinClient - Bitcoin client used to interact with the network.
 * @returns Transaction's SPV proof.
 */
export async function getTransactionProof(
  txHash: string,
  confirmations: number,
  bitcoinClient: BitcoinClient
): Promise<Proof> {
  const transaction = await bitcoinClient.getTransaction(txHash)
  if (transaction.confirmations < confirmations) {
    throw new Error(
      `transaction confirmations number [${transaction.confirmations}] is not enough, required [${confirmations}]`
    )
  }

  const latestBlockHeight = await bitcoinClient.latestBlockHeight()
  const txBlockHeight = latestBlockHeight - transaction.confirmations + 1

  const headersChain = await bitcoinClient.getHeadersChain(
    txBlockHeight,
    confirmations
  )

  const merkleProofInfo = await getMerkleProofInfo(
    txHash,
    txBlockHeight,
    bitcoinClient
  )

  return {
    rawTransaction: transaction.hex,
    merkleProof: merkleProofInfo.proof,
    txInBlockIndex: merkleProofInfo.position,
    chainHeaders: headersChain,
  }
}

/**
 * Get proof of transaction inclusion in the block. It produces proof as a
 * concatenation of 32-byte values in a hexadecimal form. It converts the
 * values to little endian form.
 * @param txHash - Transaction hash.
 * @param blockHeight - Height of the block where transaction was
 *                       confirmed.
 * @param bitcoinClient - Bitcoin client used to interact with the network.
 * @returns Transaction inclusion proof in hexadecimal form.
 */
export async function getMerkleProofInfo(
  txHash: string,
  blockHeight: number,
  bitcoinClient: BitcoinClient
) {
  const merkle = await bitcoinClient.getTransactionMerkle(txHash, blockHeight)
  let proof = Buffer.from("")
  // Merkle tree
  merkle.merkle.forEach(function (item) {
    proof = Buffer.concat([proof, Buffer.from(item, "hex").reverse()])
  })
  return { proof: proof.toString("hex"), position: merkle.position }
}

/**
 * Converts buffered data to hex string
 * @param bufferWriter - Buffer writer containing data to be converted
 * @returns Buffer converted to string
 */
function toHex(bufferWriter: StaticWriter | BufferWriter): string {
  return bufferWriter.render().toString("hex")
}

/**
 * Gets transaction version from a transaction and returns it in as hex string.
 * @param tx - Transaction to extract the version from.
 * @returns Transaction version as hex string.
 */
function getTxVersion(tx: TX): string {
  const buffer = bufio.write()
  buffer.writeU32(tx.version)
  return toHex(buffer)
}

/**
 * Gets locktime from a transaction and returns it in as hex string.
 * @param tx - Transaction to extract the locktime from.
 * @returns Transaction locktime as hex string.
 */
function getTxLocktime(tx: TX): string {
  const buffer = bufio.write()
  buffer.writeU32(tx.locktime)
  return toHex(buffer)
}

/**
 * Converts a vector of elements into a single hex string
 * @param elements - Elements to be converted to hex string
 * @returns Hex string representation of vector elements
 */
function vectorToRaw(elements: any[]): string {
  const buffer = bufio.write()
  buffer.writeVarint(elements.length)

  for (const element of elements) {
    element.toWriter(buffer)
  }

  return toHex(buffer)
}

/**
 * Gets vector of inputs as hex string from a transaction
 * @param tx - Transaction
 * @returns Hex string representation of transaction input vector
 */
function getTxInputVector(tx: TX): string {
  return vectorToRaw(tx.inputs)
}

/**
 * Gets vector of outputs as hex string from a transaction
 * @param tx - Transaction
 * @returns Hex string representation of transaction output vector
 */
function getTxOutputVector(tx: TX): string {
  return vectorToRaw(tx.outputs)
}

/**
 * Extracts version, vector of inputs, vector of outputs and locktime from a
 * transaction in the raw form
 * @param rawTransaction - Hex string representation of a transaction
 * @returns Transaction data with fields represented as strings
 */
export function parseRawTransaction(rawTransaction: string): TransactionData {
  const tx = TX.fromRaw(Buffer.from(rawTransaction, "hex"), null)
  return {
    version: getTxVersion(tx),
    txInVector: getTxInputVector(tx),
    txOutVector: getTxOutputVector(tx),
    locktime: getTxLocktime(tx),
  }
}

/**
 * Constructs a sweep transaction proof that proves the given transaction is
 * included in the Bitcoin blockchain and has the required number of
 * confirmations.
 * @param transactionHash - Hash of the sweep transaction.
 * @param confirmations - Required number of confirmations for the transaction.
 * @param bitcoinClient - Bitcoin client used to interact with the network.
 * @returns Sweep transaction proof that can be passed to on-chain proof
 *          verification functions
 */
export async function constructSweepProof(
  transactionHash: string,
  confirmations: number,
  bitcoinClient: BitcoinClient
): Promise<SweepProof> {
  // TODO: Consider adding a retrier, as in `tbtc.js`:
  // https://github.com/keep-network/tbtc.js/blob/d49c4dbabe063fea49489776389009b5b31c3350/src/BitcoinHelpers.js#L525
  const proof = await getTransactionProof(
    transactionHash,
    confirmations,
    bitcoinClient
  )

  const parsedTransaction = parseRawTransaction(proof.rawTransaction)

  return {
    txVersion: Buffer.from(parsedTransaction.version, "hex"),
    txInputVector: Buffer.from(parsedTransaction.txInVector, "hex"),
    txOutput: Buffer.from(parsedTransaction.txOutVector, "hex"),
    txLocktime: Buffer.from(parsedTransaction.locktime, "hex"),
    merkleProof: Buffer.from(proof.merkleProof, "hex"),
    txIndexInBlock: proof.txInBlockIndex,
    bitcoinHeaders: Buffer.from(proof.chainHeaders, "hex"),
  }
}
