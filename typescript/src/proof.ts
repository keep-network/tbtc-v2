import {
  Transaction,
  Proof,
  TransactionMerkleBranch,
  Client as BitcoinClient,
  TransactionHash,
  decomposeRawTransaction,
  RawTransaction,
  DecomposedRawTransaction,
  computeHash256,
} from "./bitcoin"

/**
 * Assembles a proof that a given transaction was included in the blockchain and
 * has accumulated the required number of confirmations.
 * @param transactionHash - Hash of the transaction being proven.
 * @param requiredConfirmations - Required number of confirmations.
 * @param bitcoinClient - Bitcoin client used to interact with the network.
 * @returns Bitcoin transaction along with the inclusion proof.
 */
export async function assembleTransactionProof(
  transactionHash: TransactionHash,
  requiredConfirmations: number,
  bitcoinClient: BitcoinClient
): Promise<Transaction & Proof> {
  const transaction = await bitcoinClient.getTransaction(transactionHash)
  const confirmations = await bitcoinClient.getTransactionConfirmations(
    transactionHash
  )
  if (confirmations < requiredConfirmations) {
    throw new Error(
      "Transaction confirmations number[" +
        confirmations +
        "] is not enough, required [" +
        requiredConfirmations +
        "]"
    )
  }

  const latestBlockHeight = await bitcoinClient.latestBlockHeight()
  const txBlockHeight = latestBlockHeight - confirmations + 1

  const headersChain = await bitcoinClient.getHeadersChain(
    txBlockHeight,
    requiredConfirmations
  )

  const merkleBranch = await bitcoinClient.getTransactionMerkle(
    transactionHash,
    txBlockHeight
  )

  const merkleProof = createMerkleProof(merkleBranch)

  const proof = {
    merkleProof: merkleProof,
    txIndexInBlock: merkleBranch.position,
    bitcoinHeaders: headersChain,
  }

  return { ...transaction, ...proof }
}

/**
 * Create a proof of transaction inclusion in the block by concatenating
 * 32-byte-long hash values. The values are converted to little endian form.
 * @param txMerkleBranch - Branch of a merkle tree leading to a transaction.
 * @returns Transaction inclusion proof in hexadecimal form.
 */
function createMerkleProof(txMerkleBranch: TransactionMerkleBranch): string {
  let proof = Buffer.from("")
  txMerkleBranch.merkle.forEach(function (item) {
    proof = Buffer.concat([proof, Buffer.from(item, "hex").reverse()])
  })
  return proof.toString("hex")
}

export async function validateProof(
  transactionHash: TransactionHash,
  requiredConfirmations: number,
  bitcoinClient: BitcoinClient
) {
  const proof = await assembleTransactionProof(
    transactionHash,
    requiredConfirmations,
    bitcoinClient
  )

  // TODO: Write a converter and use it to convert the transaction part of the
  // proof to the decomposed transaction data (version, inputs, outputs, locktime).
  // Use raw transaction data for now.
  const rawTransaction: RawTransaction = await bitcoinClient.getRawTransaction(
    transactionHash
  )

  const decomposedRawTransaction: DecomposedRawTransaction =
    decomposeRawTransaction(rawTransaction)

  const txBytes: Buffer = Buffer.concat([
    Buffer.from(decomposedRawTransaction.version, "hex"),
    Buffer.from(decomposedRawTransaction.inputs, "hex"),
    Buffer.from(decomposedRawTransaction.outputs, "hex"),
    Buffer.from(decomposedRawTransaction.locktime, "hex"),
  ])

  const txId = computeHash256(txBytes.toString("hex"))
  const merkleRoot = extractMerkleRootLE(proof.bitcoinHeaders)

  if (!prove(txId, merkleRoot, proof.merkleProof, proof.txIndexInBlock)) {
    throw new Error(
      "Tx merkle proof is not valid for provided header and tx hash"
    )
  }
}

export function extractMerkleRootLE(header: string): string {
  const headerBytes = Buffer.from(header, "hex")
  const merkleRootBytes = headerBytes.slice(36, 68)
  return merkleRootBytes.toString("hex")
}

export function prove(
  txId: string,
  merkleRoot: string,
  intermediateNodes: string,
  index: number
): boolean {
  // Shortcut the empty-block case
  if (txId == merkleRoot && index == 0 && intermediateNodes.length == 0) {
    return true
  }

  // If the Merkle proof failed, bubble up error
  return verifyHash256Merkle(txId, intermediateNodes, merkleRoot, index)
}

function verifyHash256Merkle(
  leaf: string,
  tree: string,
  root: string,
  index: number
): boolean {
  // Not an even number of hashes
  if (tree.length % 64 !== 0) {
    return false
  }

  // Should never occur
  if (tree.length === 0) {
    return false
  }

  let idx = index
  let current = leaf

  // i moves in increments of 64
  for (let i = 0; i < tree.length; i += 64) {
    if (idx % 2 === 1) {
      current = hash256MerkleStep(tree.slice(i, i + 64), current)
    } else {
      current = hash256MerkleStep(current, tree.slice(i, i + 64))
    }
    idx = idx >> 1
  }

  return current === root
}

function hash256MerkleStep(firstHash: string, secondHash: string): string {
  // TODO: Make sure the strings are not prepended with `0x`
  return computeHash256(firstHash + secondHash)
}
