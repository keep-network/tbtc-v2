import bcoin, { TX } from "bcoin"
import wif from "wif"
import bufio from "bufio"
import hash160 from "bcrypto/lib/hash160"
import { BigNumber } from "ethers"
import { Hex } from "./hex"

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
  getTransaction(transactionHash: TransactionHash): Promise<Transaction>

  /**
   * Gets the raw transaction data for given transaction hash.
   * @param transactionHash - Hash of the transaction.
   * @returns Raw transaction.
   */
  getRawTransaction(transactionHash: TransactionHash): Promise<RawTransaction>

  /**
   * Gets the number of confirmations that a given transaction has accumulated
   * so far.
   * @param transactionHash - Hash of the transaction.
   * @returns The number of confirmations.
   */
  getTransactionConfirmations(transactionHash: TransactionHash): Promise<number>

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
    transactionHash: TransactionHash,
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

/**
 * Compresses the given uncompressed Bitcoin public key.
 * @param publicKey Uncompressed 64-byte public key as an unprefixed hex string.
 * @returns Compressed 33-byte public key prefixed with 02 or 03.
 */
export function compressPublicKey(publicKey: string | Hex): string {
  if (typeof publicKey === "string") {
    publicKey = Hex.from(publicKey)
  }

  publicKey = publicKey.toString()

  // Must have 64 bytes and no prefix.
  if (publicKey.length != 128) {
    throw new Error(
      "The public key parameter must be 64-byte. Neither 0x nor 04 prefix is allowed"
    )
  }

  // The X coordinate is the first 32 bytes.
  const publicKeyX = publicKey.substring(0, 64)
  // The Y coordinate is the next 32 bytes.
  const publicKeyY = publicKey.substring(64)

  let prefix: string
  if (BigNumber.from(`0x${publicKeyY}`).mod(2).eq(0)) {
    prefix = "02"
  } else {
    prefix = "03"
  }

  return `${prefix}${publicKeyX}`
}

/**
 * Creates a Bitcoin key ring based on the given private key.
 * @param privateKey Private key that should be used to create the key ring
 * @param witness Flag indicating whether the key ring will create witness
 *        or non-witness addresses
 * @returns Bitcoin key ring.
 */
export function createKeyRing(
  privateKey: string,
  witness: boolean = true
): any {
  const decodedPrivateKey = wif.decode(privateKey)

  return new bcoin.KeyRing({
    witness: witness,
    privateKey: decodedPrivateKey.privateKey,
    compressed: decodedPrivateKey.compressed,
  })
}

/**
 * Computes the HASH160 for the given text.
 * @param text - Text the HASH160 is computed for.
 * @returns Hash as a 20-byte un-prefixed hex string.
 */
export function computeHash160(text: string): string {
  return hash160.digest(Buffer.from(text, "hex")).toString("hex")
}

/**
 * Encodes a public key hash into a P2PKH/P2WPKH address.
 * @param publicKeyHash - public key hash that will be encoded. Must be an
 *        unprefixed hex string (without 0x prefix).
 * @param witness - If true, a witness public key hash will be encoded and
 *        P2WPKH address will be returned. Returns P2PKH address otherwise
 * @param network - Network that the address should be encoded for.
 *        For example, `main` or `testnet`.
 * @returns P2PKH or P2WPKH address encoded from the given public key hash
 */
export function encodeToBitcoinAddress(
  publicKeyHash: string,
  witness: boolean,
  network: string
): string {
  const buffer = Buffer.from(publicKeyHash, "hex")
  return witness
    ? bcoin.Address.fromWitnessPubkeyhash(buffer).toString(network)
    : bcoin.Address.fromPubkeyhash(buffer).toString(network)
}

/**
 * Decodes P2PKH or P2WPKH address into a public key hash.
 * @param address - P2PKH or P2WPKH address that will be decoded.
 * @returns Public key hash decoded from the address. This will be an unprefixed
 *        hex string (without 0x prefix).
 */
export function decodeBitcoinAddress(address: string): string {
  const addressObject = new bcoin.Address(address)
  return addressObject.getHash("hex")
}

/**
 * Checks if given public key hash has proper length (20-byte)
 * @param publicKeyHash - text that will be checked for the correct length
 * @returns true if the given string is 20-byte long, false otherwise
 */
export function isPublicKeyHashLength(publicKeyHash: string): boolean {
  return publicKeyHash.length === 40
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
