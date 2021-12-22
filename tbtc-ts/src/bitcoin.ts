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

// TODO: Documentation.
export interface Client {
  findAllUnspentTransactionOutputs(
    address: string
  ): Promise<UnspentTransactionOutput[]>

  getTransaction(transactionHash: string): Promise<Transaction>

  getRawTransaction(transactionHash: string): Promise<RawTransaction>

  broadcast(transaction: RawTransaction): Promise<void>
}

// TODO: Documentation.
export function isCompressedPublicKey(publicKey: string): boolean {
  // Must have 33 bytes and 02 or 03 prefix.
  return (
    publicKey.length == 66 &&
    (publicKey.substring(0, 2) == "02" || publicKey.substring(0, 2) == "03")
  )
}
