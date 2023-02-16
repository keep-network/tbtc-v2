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

  evaluateProofDifficulty(
    proof.bitcoinHeaders,
    previousDifficulty,
    currentDifficulty
  )
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

export function evaluateProofDifficulty(
  headers: string,
  previousDifficulty: BigNumber,
  currentDifficulty: BigNumber
) {
  if (headers.length % 160 !== 0) {
    throw new Error("Invalid length of the headers chain")
  }

  let digest = ""
  for (let start = 0; start < headers.length; start += 160) {
    if (start !== 0) {
      if (!validateHeaderPrevHash(headers, start, digest)) {
        throw new Error("Invalid headers chain")
      }
    }

    const target = extractTargetAt(headers, start)
    digest = computeHash256(headers.slice(start, start + 160))

    const digestAsNumber = digestToBigNumber(digest)

    if (digestAsNumber.gt(target)) {
      throw new Error("Insufficient work in a header")
    }

    const difficulty = calculateDifficulty(target)

    if (previousDifficulty.eq(1) && currentDifficulty.eq(1)) {
      // Special case for Bitcoin Testnet. Do not check block's difficulty
      // due to required difficulty falling to `1` for Testnet.
      return
    }

    if (
      !difficulty.eq(previousDifficulty) &&
      !difficulty.eq(currentDifficulty)
    ) {
      throw new Error("Header difficulty not at current or previous difficulty")
    }
  }
}

function validateHeaderPrevHash(
  headers: string,
  at: number,
  prevHeaderDigest: string
): boolean {
  // Extract prevHash of current header
  const prevHash = extractPrevBlockLEAt(headers, at)

  // Compare prevHash of current header to previous header's digest
  if (prevHash != prevHeaderDigest) {
    return false
  }
  return true
}

function extractPrevBlockLEAt(header: string, at: number): string {
  return header.slice(8 + at, 8 + 64 + at)
}

function extractTargetAt(headers: string, at: number): BigNumber {
  const mantissa = extractMantissa(headers, at)
  const e = parseInt(headers.slice(150 + at, 150 + 2 + at), 16)
  const exponent = e - 3

  return BigNumber.from(mantissa).mul(BigNumber.from(256).pow(exponent))
}

function extractMantissa(headers: string, at: number): number {
  const mantissaBytes = headers.slice(144 + at, 144 + 6 + at)
  const buffer = Buffer.from(mantissaBytes, "hex")
  buffer.reverse()
  return parseInt(buffer.toString("hex"), 16)
}

/**
 * Reverses the endianness of a hash represented as a hex string and converts
 * the has to BigNumber
 * @param hexString The hash to reverse
 * @returns The reversed hash as a BigNumber
 */
function digestToBigNumber(hexString: string): BigNumber {
  if (!hexString.match(/^[0-9a-fA-F]+$/)) {
    throw new Error("Input is not a valid hexadecimal string")
  }

  const buf = Buffer.from(hexString, "hex")
  buf.reverse()
  const reversedHex = buf.toString("hex")

  try {
    return BigNumber.from("0x" + reversedHex)
  } catch (e) {
    throw new Error("Error converting hexadecimal string to BigNumber")
  }
}

function calculateDifficulty(_target: BigNumber): BigNumber {
  const DIFF1_TARGET = BigNumber.from(
    "0x00000000FFFF0000000000000000000000000000000000000000000000000000"
  )
  // Difficulty 1 calculated from 0x1d00ffff
  return DIFF1_TARGET.div(_target)
}
