import bcoin, { TX, Script } from "bcoin"
import wif from "wif"
import bufio from "bufio"
import { BigNumber, utils } from "ethers"
import { Hex } from "./hex"
import { BitcoinNetwork, toBcoinNetwork } from "./bitcoin-network"
import { payments, networks } from "bitcoinjs-lib"
import { Signer } from "ecpair"

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
 * BlockHeader represents the header of a Bitcoin block. For reference, see:
 * https://developer.bitcoin.org/reference/block_chain.html#block-headers.
 */
export interface BlockHeader {
  /**
   * The block version number that indicates which set of block validation rules
   * to follow. The field is 4-byte long.
   */
  version: number

  /**
   * The hash of the previous block's header. The field is 32-byte long.
   */
  previousBlockHeaderHash: Hex

  /**
   * The hash derived from the hashes of all transactions included in this block.
   * The field is 32-byte long.
   */
  merkleRootHash: Hex

  /**
   * The Unix epoch time when the miner started hashing the header. The field is
   * 4-byte long.
   */
  time: number

  /**
   * Bits that determine the target threshold this block's header hash must be
   * less than or equal to. The field is 4-byte long.
   */
  bits: number

  /**
   * An arbitrary number miners change to modify the header hash in order to
   * produce a hash less than or equal to the target threshold. The field is
   * 4-byte long.
   */
  nonce: number
}

/**
 * Serializes a BlockHeader to the raw representation.
 * @param blockHeader - block header.
 * @returns Serialized block header.
 */
export function serializeBlockHeader(blockHeader: BlockHeader): Hex {
  const buffer = Buffer.alloc(80)
  buffer.writeUInt32LE(blockHeader.version, 0)
  blockHeader.previousBlockHeaderHash.toBuffer().copy(buffer, 4)
  blockHeader.merkleRootHash.toBuffer().copy(buffer, 36)
  buffer.writeUInt32LE(blockHeader.time, 68)
  buffer.writeUInt32LE(blockHeader.bits, 72)
  buffer.writeUInt32LE(blockHeader.nonce, 76)
  return Hex.from(buffer)
}

/**
 * Deserializes a block header in the raw representation to BlockHeader.
 * @param rawBlockHeader - BlockHeader in the raw format.
 * @returns Block header as a BlockHeader.
 */
export function deserializeBlockHeader(rawBlockHeader: Hex): BlockHeader {
  const buffer = rawBlockHeader.toBuffer()
  const version = buffer.readUInt32LE(0)
  const previousBlockHeaderHash = buffer.slice(4, 36)
  const merkleRootHash = buffer.slice(36, 68)
  const time = buffer.readUInt32LE(68)
  const bits = buffer.readUInt32LE(72)
  const nonce = buffer.readUInt32LE(76)

  return {
    version: version,
    previousBlockHeaderHash: Hex.from(previousBlockHeaderHash),
    merkleRootHash: Hex.from(merkleRootHash),
    time: time,
    bits: bits,
    nonce: nonce,
  }
}

/**
 * Converts a block header's bits into target.
 * @param bits - bits from block header.
 * @returns Target as a BigNumber.
 */
export function bitsToTarget(bits: number): BigNumber {
  // A serialized 80-byte block header stores the `bits` value as a 4-byte
  // little-endian hexadecimal value in a slot including bytes 73, 74, 75, and
  // 76. This function's input argument is expected to be a numerical
  // representation of that 4-byte value reverted to the big-endian order.
  // For example, if the `bits` little-endian value in the header is
  // `0xcb04041b`, it must be reverted to the big-endian form `0x1b0404cb` and
  // turned to a decimal number `453248203` in order to be used as this
  // function's input.
  //
  // The `bits` 4-byte big-endian representation is a compact value that works
  // like a base-256 version of scientific notation. It encodes the target
  // exponent in the first byte and the target mantissa in the last three bytes.
  // Referring to the previous example, if `bits = 453248203`, the hexadecimal
  // representation is `0x1b0404cb` so the exponent is `0x1b` while the mantissa
  // is `0x0404cb`.
  //
  // To extract the exponent, we need to shift right by 3 bytes (24 bits),
  // extract the last byte of the result, and subtract 3 (because of the
  // mantissa length):
  // - 0x1b0404cb >>> 24 = 0x0000001b
  // - 0x0000001b & 0xff = 0x1b
  // - 0x1b - 3 = 24 (decimal)
  //
  // To extract the mantissa, we just need to take the last three bytes:
  // - 0x1b0404cb & 0xffffff = 0x0404cb = 263371 (decimal)
  //
  // The final difficulty can be computed as mantissa * 256^exponent:
  // - 263371 * 256^24 =
  // 1653206561150525499452195696179626311675293455763937233695932416 (decimal)
  //
  // Sources:
  // - https://developer.bitcoin.org/reference/block_chain.html#target-nbits
  // - https://wiki.bitcoinsv.io/index.php/Target

  const exponent = ((bits >>> 24) & 0xff) - 3
  const mantissa = bits & 0xffffff

  const target = BigNumber.from(mantissa).mul(BigNumber.from(256).pow(exponent))
  return target
}

/**
 * Converts difficulty target to difficulty.
 * @param target - difficulty target.
 * @returns Difficulty as a BigNumber.
 */
export function targetToDifficulty(target: BigNumber): BigNumber {
  const DIFF1_TARGET = BigNumber.from(
    "0xffff0000000000000000000000000000000000000000000000000000"
  )
  return DIFF1_TARGET.div(target)
}

/**
 * Represents a Bitcoin client.
 */
export interface Client {
  /**
   * Gets the network supported by the server the client connected to.
   * @returns Bitcoin network.
   */
  getNetwork(): Promise<BitcoinNetwork>

  /**
   * Finds all unspent transaction outputs (UTXOs) for given Bitcoin address.
   * @param address - Bitcoin address UTXOs should be determined for.
   * @returns List of UTXOs.
   */
  findAllUnspentTransactionOutputs(
    address: string
  ): Promise<UnspentTransactionOutput[]>

  /**
   * Gets the history of confirmed transactions for given Bitcoin address.
   * Returned transactions are sorted from oldest to newest. The returned
   * result does not contain unconfirmed transactions living in the mempool
   * at the moment of request.
   * @param address - Bitcoin address transaction history should be determined for.
   * @param limit - Optional parameter that can limit the resulting list to
   *        a specific number of last transaction. For example, limit = 5 will
   *        return only the last 5 transactions for the given address.
   */
  getTransactionHistory(address: string, limit?: number): Promise<Transaction[]>

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
  const sha256Hash = utils.sha256(
    Hex.from(Buffer.from(text, "hex")).toPrefixedString()
  )
  const hash160 = utils.ripemd160(sha256Hash)

  return Hex.from(hash160).toString()
}

/**
 * Computes the double SHA256 for the given text.
 * @param text - Text the double SHA256 is computed for.
 * @returns Hash as a 32-byte un-prefixed hex string.
 */
export function computeHash256(text: Hex): Hex {
  const firstHash = utils.sha256(text.toPrefixedString())
  const secondHash = utils.sha256(firstHash)

  return Hex.from(secondHash)
}

/**
 * Converts a hash in hex string in little endian to a BigNumber.
 * @param hash - Hash in hex-string format.
 * @returns BigNumber representation of the hash.
 */
export function hashLEToBigNumber(hash: Hex): BigNumber {
  return BigNumber.from(hash.reverse().toPrefixedString())
}

/**
 * Encodes a public key hash into a P2PKH/P2WPKH address.
 * @param publicKeyHash - public key hash that will be encoded. Must be an
 *        unprefixed hex string (without 0x prefix).
 * @param witness - If true, a witness public key hash will be encoded and
 *        P2WPKH address will be returned. Returns P2PKH address otherwise
 * @param network - Network the address should be encoded for.
 * @returns P2PKH or P2WPKH address encoded from the given public key hash
 * @throws Throws an error if network is not supported.
 */
export function encodeToBitcoinAddress(
  publicKeyHash: string,
  witness: boolean,
  network: BitcoinNetwork
): string {
  const buffer = Buffer.from(publicKeyHash, "hex")
  const bcoinNetwork = toBcoinNetwork(network)
  return witness
    ? bcoin.Address.fromWitnessPubkeyhash(buffer).toString(bcoinNetwork)
    : bcoin.Address.fromPubkeyhash(buffer).toString(bcoinNetwork)
}

/**
 * Decodes P2PKH or P2WPKH address into a public key hash. Throws if the
 * provided address is not PKH-based.
 * @param address - P2PKH or P2WPKH address that will be decoded.
 * @returns Public key hash decoded from the address. This will be an unprefixed
 *        hex string (without 0x prefix).
 */
export function decodeBitcoinAddress(address: string): string {
  const addressObject = new bcoin.Address(address)

  const isPKH =
    addressObject.isPubkeyhash() || addressObject.isWitnessPubkeyhash()
  if (!isPKH) {
    throw new Error("Address must be P2PKH or P2WPKH")
  }

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

/**
 * Creates the output script from the BTC address.
 * @param address BTC address.
 * @returns The un-prefixed and not prepended with length output script.
 */
export function createOutputScriptFromAddress(address: string): Hex {
  return Hex.from(Script.fromAddress(address).toRaw().toString("hex"))
}

/**
 * Creates the Bitcoin address from the output script.
 * @param script The unprefixed and not prepended with length output script.
 * @param network Bitcoin network.
 * @returns The Bitcoin address.
 */
export function createAddressFromOutputScript(
  script: Hex,
  network: BitcoinNetwork = BitcoinNetwork.Mainnet
): string {
  return Script.fromRaw(script.toString(), "hex")
    .getAddress()
    ?.toString(toBcoinNetwork(network))
}

/**
 * Reads the leading compact size uint from the provided variable length data.
 *
 * WARNING: CURRENTLY, THIS FUNCTION SUPPORTS ONLY 1-BYTE COMPACT SIZE UINTS
 * AND WILL THROW ON COMPACT SIZE UINTS OF DIFFERENT BYTE LENGTH.
 *
 * @param varLenData Variable length data preceded by a compact size uint.
 * @returns An object holding the value of the compact size uint along with the
 *          compact size uint byte length.
 */
export function readCompactSizeUint(varLenData: Hex): {
  value: number
  byteLength: number
} {
  // The varLenData is prefixed with the compact size uint. According to the docs
  // (https://developer.bitcoin.org/reference/transactions.html#compactsize-unsigned-integers)
  // a compact size uint can be 1, 3, 5 or 9 bytes. To determine the exact length,
  // we need to look at the discriminant byte which is always the first byte of
  // the compact size uint.
  const discriminant = varLenData.toString().slice(0, 2)

  switch (discriminant) {
    case "ff":
    case "fe":
    case "fd": {
      throw new Error(
        "support for 3, 5 and 9 bytes compact size uints is not implemented yet"
      )
    }
    default: {
      // The discriminant tells the compact size uint is 1 byte. That means
      // the discriminant represent the value itself.
      return {
        value: parseInt(discriminant, 16),
        byteLength: 1,
      }
    }
  }
}

/**
 * Checks if the provided script comes from a P2PKH input.
 * @param script The script to be checked.
 * @returns True if the script is P2PKH, false otherwise.
 */
export function isP2PKH(script: Buffer): boolean {
  try {
    payments.p2pkh({ output: script })
    return true
  } catch (err) {
    return false
  }
}

/**
 * Checks if the provided script comes from a P2WPKH input.
 * @param script The script to be checked.
 * @returns True if the script is P2WPKH, false otherwise.
 */
export function isP2WPKH(script: Buffer): boolean {
  try {
    payments.p2wpkh({ output: script })
    return true
  } catch (err) {
    return false
  }
}

/**
 * Checks if the provided script comes from a P2SH input.
 * @param script The script to be checked.
 * @returns True if the script is P2SH, false otherwise.
 */
export function isP2SH(script: Buffer): boolean {
  try {
    payments.p2sh({ output: script })
    return true
  } catch (err) {
    return false
  }
}

/**
 * Checks if the provided script comes from a P2PKH input.
 * @param script The script to be checked.
 * @returns True if the script is P2WSH, false otherwise.
 */
export function isP2WSH(script: Buffer): boolean {
  try {
    payments.p2wsh({ output: script })
    return true
  } catch (err) {
    return false
  }
}

// TODO: Description and unit tests.
export function addressFromKeyPair(
  keyPair: Signer,
  network: networks.Network,
  witness: boolean
): string {
  if (witness) {
    // P2WPKH (SegWit)
    return payments.p2wpkh({ pubkey: keyPair.publicKey, network }).address!
  } else {
    // P2PKH (Legacy)
    return payments.p2pkh({ pubkey: keyPair.publicKey, network }).address!
  }
}
