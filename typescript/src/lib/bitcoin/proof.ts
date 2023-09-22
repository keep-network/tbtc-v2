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
   * the deepest pairing first. Each hash is an unprefixed hex string.
   */
  merkle: string[]

  /**
   * The 0-based index of the transaction's position in the block.
   */
  position: number
}
