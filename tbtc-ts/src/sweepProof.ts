// @ts-ignore
import { TX } from "bcoin"
// @ts-ignore
import bufio from "bufio"
// @ts-ignore
import { StaticWriter, BufferWriter } from "bufio"
import {
  SweepData,
  TxProof,
  TxInfo,
  TransactionMerkleBranch,
  Client as BitcoinClient,
} from "./bitcoin"

/**
 * Create a proof of transaction inclusion in the block by concatenating
 * 32-byte-long hash values. The values are converted to little endian form.
 * @param txMerkleBranch - Branch of a merkle tree leading to a transaction.
 * @returns Transaction inclusion proof in hexadecimal form.
 */
export function createMerkleProof(
  txMerkleBranch: TransactionMerkleBranch
): string {
  let proof = Buffer.from("")
  txMerkleBranch.merkle.forEach(function (item) {
    proof = Buffer.concat([proof, Buffer.from(item, "hex").reverse()])
  })
  return proof.toString("hex")
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
function extractTxInfo(rawTransaction: string): TxInfo {
  const tx = TX.fromRaw(Buffer.from(rawTransaction, "hex"), null)
  return {
    txVersion: getTxVersion(tx),
    txInputVector: getTxInputVector(tx),
    txOutputVector: getTxOutputVector(tx),
    txLocktime: getTxLocktime(tx),
  }
}

/**
 * Constructs a sweep transaction proof that proves the given transaction is
 * included in the Bitcoin blockchain and has the required number of
 * confirmations.
 * @param txId - Id of the sweep transaction.
 * @param confirmations - Required number of confirmations for the transaction.
 * @param bitcoinClient - Bitcoin client used to interact with the network.
 * @returns Sweep transaction proof that can be passed to on-chain proof
 *          verification functions
 */
export async function constructSweepProof(
  txId: string,
  confirmations: number,
  bitcoinClient: BitcoinClient
): Promise<SweepData> {
  const transaction = await bitcoinClient.getTransaction(txId)
  if (transaction.confirmations < confirmations) {
    throw new Error(
      "Transaction confirmations number[" +
        transaction.confirmations +
        "] is not enough, required [" +
        confirmations +
        "]"
    )
  }

  const latestBlockHeight = await bitcoinClient.latestBlockHeight()
  const txBlockHeight = latestBlockHeight - transaction.confirmations + 1

  const headersChain = await bitcoinClient.getHeadersChain(
    txBlockHeight,
    confirmations
  )

  const merkleBranch = await bitcoinClient.getTransactionMerkle(
    txId,
    txBlockHeight
  )

  const merkleProof = createMerkleProof(merkleBranch)

  const txInfo: TxInfo = extractTxInfo(transaction.hex)

  const txProof: TxProof = {
    merkleProof: merkleProof,
    txIndexInBlock: merkleBranch.position,
    bitcoinHeaders: headersChain,
  }

  return {
    txInfo,
    txProof,
  }
}
