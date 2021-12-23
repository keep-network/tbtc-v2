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
