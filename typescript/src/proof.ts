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
import { BigNumber } from "ethers"

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

export function validateProofDifficulty(
  serializedHeaders: string[],
  previousDifficulty: BigNumber,
  currentDifficulty: BigNumber
) {
  const validateHeaderPrevHash = (
    header: string,
    prevHeaderDigest: string
  ): boolean => {
    // Extract prevHash of current header
    const prevHash = header.slice(8, 8 + 64)

    // Compare prevHash of current header to previous header's digest
    if (prevHash != prevHeaderDigest) {
      return false
    }
    return true
  }

  const extractMantissa = (header: string): number => {
    const mantissaBytes = header.slice(144, 144 + 6)
    const buffer = Buffer.from(mantissaBytes, "hex")
    buffer.reverse()
    return parseInt(buffer.toString("hex"), 16)
  }

  const extractTargetAt = (header: string): BigNumber => {
    const mantissa = extractMantissa(header)
    const e = parseInt(header.slice(150, 150 + 2), 16)
    const exponent = e - 3

    return BigNumber.from(mantissa).mul(BigNumber.from(256).pow(exponent))
  }

  const digestToBigNumber = (hexString: string): BigNumber => {
    const buffer = Buffer.from(hexString, "hex")
    buffer.reverse()
    const reversedHex = buffer.toString("hex")
    return BigNumber.from("0x" + reversedHex)
  }

  const calculateDifficulty = (_target: BigNumber): BigNumber => {
    const DIFF1_TARGET = BigNumber.from(
      "0x00000000FFFF0000000000000000000000000000000000000000000000000000"
    )
    // Difficulty 1 calculated from 0x1d00ffff
    return DIFF1_TARGET.div(_target)
  }

  let previousDigest: string = ""
  // for (let start = 0; start < headers.length; start += 160) {
  for (let index = 0; index < serializedHeaders.length; index++) {
    const currentHeader = serializedHeaders[index]

    if (index !== 0) {
      if (!validateHeaderPrevHash(currentHeader, previousDigest)) {
        throw new Error("Invalid headers chain")
      }
    }

    const target = extractTargetAt(currentHeader)
    const digest = computeHash256(currentHeader)

    if (digestToBigNumber(digest).gt(target)) {
      throw new Error("Insufficient work in a header")
    }

    // Save the current digest to compare it with the next block header's digest
    previousDigest = digest

    const difficulty = calculateDifficulty(target)

    if (previousDifficulty.eq(1) && currentDifficulty.eq(1)) {
      // Special case for Bitcoin Testnet. Do not check block's difficulty
      // due to required difficulty falling to `1` for Testnet.
      continue
    }

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
