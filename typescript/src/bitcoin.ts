// @ts-ignore
import { TX } from "bcoin"
// @ts-ignore
import bufio from "bufio"
// @ts-ignore
import { StaticWriter, BufferWriter } from "bufio"

/**
 * Represents a raw transaction.
 */
export interface RawTransaction {
  /**
   * The full transaction payload as an un-prefixed hex string.
   */
  transactionHex: string
}

/**
 * Data about a transaction.
 */
export interface Transaction {
  /**
   * The transaction hash (or transaction ID) as an un-prefixed hex string.
   */
  transactionHash: string

  /**
   * The vector of transaction inputs.
   */
  inputs: TransactionInput[]

  /**
   * The vector of transaction outputs.
   */
  outputs: TransactionOutput[]
}

/**
 * Data about a transaction outpoint.
 */
export interface TransactionOutpoint {
  /**
   * The hash of the transaction the outpoint belongs to.
   */
  transactionHash: string

  /**
   * The zero-based index of the output from the specified transaction.
   */
  outputIndex: number
}

/**
 * Data about a transaction input.
 */
export type TransactionInput = TransactionOutpoint & {
  /**
   * The scriptSig that unlocks the specified outpoint for spending.
   */
  scriptSig: any
}

/**
 * Data about a transaction output.
 */
export interface TransactionOutput {
  /**
   * The 0-based index of the output.
   */
  outputIndex: number

  /**
   * The value of the output in satoshis.
   */
  value: number

  /**
   * The receiving scriptPubKey.
   */
  scriptPubKey: any
}

/**
 * Data about an unspent transaction output.
 */
export type UnspentTransactionOutput = TransactionOutpoint & {
  /**
   * The unspent value in satoshis.
   */
  value: number
}

/**
 * Represents data of decomposed raw transaction.
 */
export interface DecomposedRawTransaction {
  /**
   * Transaction version as an un-prefixed hex string.
   */
  version: string

  /**
   * All transaction's inputs prepended by the number of transaction inputs,
   * as an un-prefixed hex string.
   */
  inputs: string

  /**
   * All transaction's outputs prepended by the number of transaction outputs,
   * as an un-prefixed hex string.
   */
  outputs: string

  /**
   * Transaction locktime as an un-prefixed hex string.
   */
  locktime: string
}

/**
 * Data required to perform a proof that a given transaction was included in
 * the Bitcoin blockchain.
 */
export interface Proof {
  /**
   * The merkle proof of transaction inclusion in a block, as an un-prefixed
   * hex string.
   */
  merkleProof: string

  /**
   * Transaction index in the block (0-indexed).
   */
  txIndexInBlock: number

  /**
   * Single byte-string of 80-byte block headers, lowest height first, as an
   * un-prefixed hex string.
   */
  bitcoinHeaders: string
}

/**
 * Information about the merkle branch to a confirmed transaction.
 */
export interface TransactionMerkleBranch {
  /**
   * The height of the block the transaction was confirmed in.
   */
  blockHeight: number

  /**
   * A list of transaction hashes the current hash is paired with, recursively,
   * in order to trace up to obtain the merkle root of the including block,
   * deepest pairing first. Each hash is an unprefixed hex string.
   */
  merkle: string[]

  /**
   * The 0-based index of the transaction's position in the block.
   */
  position: number
}

/**
 * Represents a Bitcoin client.
 */
export interface Client {
  /**
   * Finds all unspent transaction outputs (UTXOs) for given Bitcoin address.
   * @param address - Bitcoin address UTXOs should be determined for.
   * @returns List of UTXOs.
   */
  findAllUnspentTransactionOutputs(
    address: string
  ): Promise<UnspentTransactionOutput[]>

  /**
   * Gets the full transaction object for given transaction hash.
   * @param transactionHash - Hash of the transaction.
   * @returns Transaction object.
   */
  getTransaction(transactionHash: string): Promise<Transaction>

  /**
   * Gets the raw transaction data for given transaction hash.
   * @param transactionHash - Hash of the transaction.
   * @returns Raw transaction.
   */
  getRawTransaction(transactionHash: string): Promise<RawTransaction>

  /**
   * Gets the number of confirmations that a given transaction has accumulated
   * so far.
   * @param transactionHash - Hash of the transaction.
   * @returns The number of confirmations.
   */
  getTransactionConfirmations(transactionHash: string): Promise<number>

  /**
   * Gets height of the latest mined block.
   * @return Height of the last mined block.
   */
  latestBlockHeight(): Promise<number>

  /**
   * Gets concatenated chunk of block headers built on a starting block.
   * @param blockHeight - Starting block height.
   * @param chainLength - Number of subsequent blocks built on the starting
   *                      block.
   * @return Concatenation of block headers in a hexadecimal format.
   */
  getHeadersChain(blockHeight: number, chainLength: number): Promise<string>

  /**
   * Get Merkle branch for a given transaction.
   * @param transactionHash - Hash of a transaction.
   * @param blockHeight - Height of the block where transaction was confirmed.
   * @return Merkle branch.
   */
  getTransactionMerkle(
    transactionHash: string,
    blockHeight: number
  ): Promise<TransactionMerkleBranch>

  /**
   * Broadcasts the given transaction over the network.
   * @param transaction - Transaction to broadcast.
   */
  broadcast(transaction: RawTransaction): Promise<void>
}

/**
 * Decomposes a transaction in the raw representation into version, vector of
 * inputs, vector of outputs and locktime.
 * @param rawTransaction - Transaction in the raw format.
 * @returns Transaction data with fields represented as un-prefixed hex strings.
 */
export function decomposeRawTransaction(
  rawTransaction: RawTransaction
): DecomposedRawTransaction {
  const toHex = (bufferWriter: StaticWriter | BufferWriter) => {
    return bufferWriter.render().toString("hex")
  }

  const vectorToRaw = (elements: any[]) => {
    const buffer = bufio.write()
    buffer.writeVarint(elements.length)
    for (const element of elements) {
      element.toWriter(buffer)
    }
    return toHex(buffer)
  }

  const getTxInputVector = (tx: TX) => {
    return vectorToRaw(tx.inputs)
  }

  const getTxOutputVector = (tx: TX) => {
    return vectorToRaw(tx.outputs)
  }

  const getTxVersion = (tx: TX) => {
    const buffer = bufio.write()
    buffer.writeU32(tx.version)
    return toHex(buffer)
  }

  const getTxLocktime = (tx: TX) => {
    const buffer = bufio.write()
    buffer.writeU32(tx.locktime)
    return toHex(buffer)
  }

  const tx = TX.fromRaw(Buffer.from(rawTransaction.transactionHex, "hex"), null)

  return {
    version: getTxVersion(tx),
    inputs: getTxInputVector(tx),
    outputs: getTxOutputVector(tx),
    locktime: getTxLocktime(tx),
  }
}

/**
 * Checks whether given public key is a compressed Bitcoin public key.
 * @param publicKey - Public key that should be checked.
 * @returns True if the key is a compressed Bitcoin public key, false otherwise.
 */
export function isCompressedPublicKey(publicKey: string): boolean {
  // Must have 33 bytes and 02 or 03 prefix.
  return (
    publicKey.length == 66 &&
    (publicKey.substring(0, 2) == "02" || publicKey.substring(0, 2) == "03")
  )
}
