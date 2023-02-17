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
  decomposeBlockHeader,
  bitsToDifficultyTarget,
  targetToDifficulty,
  hashToBigNumber,
} from "./bitcoin"
import { BigNumber } from "ethers"
import { Hex } from "./hex"

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

// TODO: Those functions were rewritten from Solidity.
//       Refactor all the functions, e.g. represent BitcoinHeaders as structure.
export async function validateProof(
  transactionHash: TransactionHash,
  requiredConfirmations: number,
  previousDifficulty: BigNumber,
  currentDifficulty: BigNumber,
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

  const transactionBytes: Buffer = Buffer.concat([
    Buffer.from(decomposedRawTransaction.version, "hex"),
    Buffer.from(decomposedRawTransaction.inputs, "hex"),
    Buffer.from(decomposedRawTransaction.outputs, "hex"),
    Buffer.from(decomposedRawTransaction.locktime, "hex"),
  ])

  const transactionHashLE: string = computeHash256(
    transactionBytes.toString("hex")
  )

  // TODO: Should we recreate transactionHashLE from its components?
  //       We don't check the components anywhere.
  if (!transactionHash.equals(Hex.from(transactionHashLE).reverse())) {
    throw new Error("Incorrect transaction hash")
  }

  const merkleRoot: string = extractMerkleRootLE(proof.bitcoinHeaders)
  if (
    !validateMerkleTree(
      transactionHashLE,
      merkleRoot,
      proof.merkleProof,
      proof.txIndexInBlock
    )
  ) {
    throw new Error(
      "Transaction merkle proof is not valid for provided header and transaction hash"
    )
  }

  const bitcoinHeaders = splitHeaders(proof.bitcoinHeaders)
  validateProofDifficulty(bitcoinHeaders, previousDifficulty, currentDifficulty)
}

export function extractMerkleRootLE(headers: string): string {
  const headersBytes: Buffer = Buffer.from(headers, "hex")
  const merkleRootBytes: Buffer = headersBytes.slice(36, 68)
  return merkleRootBytes.toString("hex")
}

export function validateMerkleTree(
  txId: string,
  merkleRoot: string,
  intermediateNodes: string,
  index: number
): boolean {
  // Shortcut the empty-block case
  if (txId == merkleRoot && index == 0 && intermediateNodes.length == 0) {
    return true
  }
  return validateMerkleTreeHashes(txId, intermediateNodes, merkleRoot, index)
}

function validateMerkleTreeHashes(
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
      current = computeHash256(tree.slice(i, i + 64) + current)
    } else {
      current = computeHash256(current + tree.slice(i, i + 64))
    }
    idx = idx >> 1
  }

  return current === root
}

// Note that it requires that the headers come from current or previous epoch.
// Validation will fail if the
export function validateProofDifficulty(
  serializedHeaders: string[],
  previousDifficulty: BigNumber,
  currentDifficulty: BigNumber
) {
  let previousDigest: Hex = Hex.from("00")

  for (let index = 0; index < serializedHeaders.length; index++) {
    const currentHeader = serializedHeaders[index]
    const blockHeaderDecomposed = decomposeBlockHeader(currentHeader)

    // Check if the current block header stores the hash of the previously
    // processed block header. Skip the check for the first header.
    if (index !== 0) {
      if (
        !previousDigest.equals(blockHeaderDecomposed.previousBlockHeaderHash)
      ) {
        throw new Error("Invalid headers chain")
      }
    }

    const target = bitsToDifficultyTarget(blockHeaderDecomposed.bits)
    const digest = computeHash256(currentHeader)

    if (hashToBigNumber(digest).gt(target)) {
      throw new Error("Insufficient work in the header")
    }

    // Save the current digest to compare it with the next block header's digest
    previousDigest = Hex.from(digest)

    // Check if the stored block difficulty is equal to previous or current
    // difficulties.
    const difficulty = targetToDifficulty(target)

    if (previousDifficulty.eq(1) && currentDifficulty.eq(1)) {
      // Special case for Bitcoin Testnet. Do not check block's difficulty
      // due to required difficulty falling to `1` for Testnet.
      continue
    }

    // TODO: For mainnet we could check if there is no more than one switch
    //       from previous to current difficulties
    if (
      !difficulty.eq(previousDifficulty) &&
      !difficulty.eq(currentDifficulty)
    ) {
      throw new Error("Header difficulty not at current or previous difficulty")
    }
  }
}

function splitHeaders(headers: string): string[] {
  if (headers.length % 160 !== 0) {
    throw new Error("Incorrect length of Bitcoin headers")
  }

  const result = []
  for (let i = 0; i < headers.length; i += 160) {
    result.push(headers.substring(i, i + 160))
  }

  return result
}
