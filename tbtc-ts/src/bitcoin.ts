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
   * The block hash of the transaction's containing block as an un-prefixed
   * hex string.
   */
  blockHash: string

  /**
   * The number of confirmations the transaction has received, including the
   * containing block hash.
   */
  confirmations: number

  /**
   * The full transaction payload as an un-prefixed hex string.
   */
  hex: string

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

export interface Proof {
  /**
   * Raw transaction in hexadecimal format.
   */
  rawTransaction: string

  /**
   * Transaction merkle proof.
   */
  merkleProof: string

  /**
   * Transaction index in a block.
   */
  txInBlockIndex: number

  /**
   * Chain of blocks headers.
   */
  chainHeaders: string
}

/**
 * Proof of that proves a given transaction is included in the Bitcoin
 * blockchain.
 */
export interface SweepProof {
  txVersion: string
  txInputVector: string
  txOutput: string
  txLocktime: string
  merkleProof: string
  txIndexInBlock: number
  bitcoinHeaders: string
}

/**
 * Information about the merkle branch to a confirmed transaction.
 *
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
 * String representation of important transaction fields
 */
export interface TransactionData {
  /**
   * The transaction's version field as an unprefixed hexadecimal string.
   */
  version: string

  /**
   * The transaction's input vector as an unprefixed hexadecimal string.
   */
  txInVector: string

  /**
   * The transaction's output vector as an unprefixed hexadecimal string.
   */
  txOutVector: string

  /**
   * The transaction's locktime field as an unprefixed hexadecimal string.
   */
  locktime: string
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
   * Gets height of the latest mined block.
   * @return Height of the last mined block.
   */
  latestBlockHeight(): Promise<number>

  /**
   * Gets concatenated chunk of block headers built on a starting block.
   * @param blockHeight - Starting block height.
   * @param confirmations -  Number of confirmations (subsequent blocks) built
   *                         on the starting block.
   * @return Concatenation of block headers in a hexadecimal format.
   */
  getHeadersChain(blockHeight: number, confirmations: number): Promise<string>

  /**
   * Get proof of transaction inclusion in the block.
   * @param txHash - Hash of a transaction.
   * @param blockHeight - Height of the block where transaction was confirmed.
   * @return Transaction inclusion proof in hexadecimal form.
   */
  getTransactionMerkle(
    txHash: string,
    blockHeight: number
  ): Promise<TransactionMerkleBranch>

  /**
   * Broadcasts the given transaction over the network.
   * @param transaction - Transaction to broadcast.
   */
  broadcast(transaction: RawTransaction): Promise<void>
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
