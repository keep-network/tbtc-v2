import { TX } from "bcoin"
import bufio from "bufio"
import { BigNumber } from "ethers"
import { Hex } from "../utils"

/**
 * Represents a transaction hash (or transaction ID) as an un-prefixed hex
 * string. This hash is supposed to have the same byte order as used by the
 * Bitcoin block explorers which is the opposite of the byte order used
 * by the Bitcoin protocol internally. That means the hash must be reversed in
 * the use cases that expect the Bitcoin internal byte order.
 */
export class TransactionHash extends Hex {}

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
  transactionHash: TransactionHash

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
  transactionHash: TransactionHash

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
  scriptSig: Hex
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
  value: BigNumber

  /**
   * The receiving scriptPubKey.
   */
  scriptPubKey: Hex
}

/**
 * Data about an unspent transaction output.
 */
export type UnspentTransactionOutput = TransactionOutpoint & {
  /**
   * The unspent value in satoshis.
   */
  value: BigNumber
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
 * Decomposes a transaction in the raw representation into version, vector of
 * inputs, vector of outputs and locktime.
 * @param rawTransaction - Transaction in the raw format.
 * @returns Transaction data with fields represented as un-prefixed hex strings.
 */
export function decomposeRawTransaction(
  rawTransaction: RawTransaction
): DecomposedRawTransaction {
  const toHex = (bufferWriter: any) => {
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

  const getTxInputVector = (tx: any) => {
    return vectorToRaw(tx.inputs)
  }

  const getTxOutputVector = (tx: any) => {
    return vectorToRaw(tx.outputs)
  }

  const getTxVersion = (tx: any) => {
    const buffer = bufio.write()
    buffer.writeU32(tx.version)
    return toHex(buffer)
  }

  const getTxLocktime = (tx: any) => {
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
 * Converts Bitcoin specific locktime value to a number. The number represents
 * either a block height or an Unix timestamp depending on the value.
 *
 * If the number is less than 500 000 000 it is a block height.
 * If the number is greater or equal 500 000 000 it is a Unix timestamp.
 *
 * @see {@link https://developer.bitcoin.org/devguide/transactions.html#locktime-and-sequence-number Documentation}
 *
 * @param locktimeLE A 4-byte little-endian locktime as an un-prefixed
 *                   hex string {@link: Deposit#refundLocktime}.
 * @returns UNIX timestamp in seconds.
 */
export function locktimeToNumber(locktimeLE: Buffer | string): number {
  const locktimeBE: Buffer = Hex.from(locktimeLE).reverse().toBuffer()
  return BigNumber.from(locktimeBE).toNumber()
}
