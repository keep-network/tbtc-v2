import {
  Transaction,
  Proof,
  TransactionMerkleBranch,
  Client as BitcoinClient,
  TransactionHash,
  computeHash256,
  deserializeBlockHeader,
  bitsToDifficultyTarget,
  targetToDifficulty,
  hashToBigNumber,
  serializeBlockHeader,
  BlockHeader,
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

// TODO: Description
// TODO: should we check the transaction itself (inputs, outputs)?
export async function validateTransactionProof(
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

  const bitcoinHeaders = splitHeaders(proof.bitcoinHeaders)
  const merkleRootHash = bitcoinHeaders[0].merkleRootHash

  validateMerkleTree(
    transactionHash.reverse().toString(),
    merkleRootHash.toString(),
    proof.merkleProof,
    proof.txIndexInBlock
  )

  validateBlockHeadersChain(
    bitcoinHeaders,
    previousDifficulty,
    currentDifficulty
  )
}

function validateMerkleTree(
  transactionHash: string,
  merkleRootHash: string,
  intermediateNodes: string,
  transactionIdxInBlock: number
) {
  // Shortcut the empty-block case
  if (
    transactionHash == merkleRootHash &&
    transactionIdxInBlock == 0 &&
    intermediateNodes.length == 0
  ) {
    return
  }

  validateMerkleTreeHashes(
    transactionHash,
    intermediateNodes,
    merkleRootHash,
    transactionIdxInBlock
  )
}

function validateMerkleTreeHashes(
  leafHash: string,
  intermediateNodes: string,
  merkleRoot: string,
  transactionIdxInBlock: number
) {
  if (intermediateNodes.length === 0 || intermediateNodes.length % 64 !== 0) {
    throw new Error("Invalid merkle tree")
  }

  let idx = transactionIdxInBlock
  let current = leafHash

  // i moves in increments of 64
  for (let i = 0; i < intermediateNodes.length; i += 64) {
    if (idx % 2 === 1) {
      current = computeHash256(intermediateNodes.slice(i, i + 64) + current)
    } else {
      current = computeHash256(current + intermediateNodes.slice(i, i + 64))
    }
    idx = idx >> 1
  }

  if (current !== merkleRoot) {
    throw new Error(
      "Transaction merkle proof is not valid for provided header and transaction hash"
    )
  }
}

/**
 * Validates a chain of consecutive block headers. It checks if each of the
 * block headers has appropriate difficulty, hash of each block is below the
 * required target and block headers form a chain.
 * @dev The block headers must come form Bitcoin epochs with difficulties
 *      marked by previous and current difficulties. If a Bitcoin difficulty
 *      relay is used to provide these values and the relay is up-to-date, only
 *      the recent block headers will pass validation. Block headers older than
 *      the current and previous Bitcoin epochs will fail.
 * @param blockHeaders - block headers that form the chain.
 * @param previousEpochDifficulty - difficulty of the previous Bitcoin epoch.
 * @param currentEpochDifficulty - difficulty of the current Bitcoin epoch.
 * @returns Empty return.
 */
function validateBlockHeadersChain(
  blockHeaders: BlockHeader[],
  previousEpochDifficulty: BigNumber,
  currentEpochDifficulty: BigNumber
) {
  let previousBlockHeaderHash: Hex = Hex.from("00")

  for (let index = 0; index < blockHeaders.length; index++) {
    const currentHeader = blockHeaders[index]

    // Check if the current block header stores the hash of the previously
    // processed block header. Skip the check for the first header.
    if (index !== 0) {
      if (
        !previousBlockHeaderHash.equals(currentHeader.previousBlockHeaderHash)
      ) {
        throw new Error("Invalid headers chain")
      }
    }

    const difficultyTarget = bitsToDifficultyTarget(currentHeader.bits)
    const currentBlockHeaderHash = computeHash256(
      serializeBlockHeader(currentHeader)
    )

    if (hashToBigNumber(currentBlockHeaderHash).gt(difficultyTarget)) {
      throw new Error("Insufficient work in the header")
    }

    // Save the current block header hash to compare it with the next block
    // header's previous block header hash.
    previousBlockHeaderHash = Hex.from(currentBlockHeaderHash)

    // Check if the stored block difficulty is equal to previous or current
    // difficulties.
    const difficulty = targetToDifficulty(difficultyTarget)

    if (previousEpochDifficulty.eq(1) && currentEpochDifficulty.eq(1)) {
      // Special case for Bitcoin Testnet. Do not check block's difficulty
      // due to required difficulty falling to `1` for Testnet.
      continue
    }

    // TODO: For mainnet we could check if there is no more than one switch
    //       from previous to current difficulties
    if (
      !difficulty.eq(previousEpochDifficulty) &&
      !difficulty.eq(currentEpochDifficulty)
    ) {
      throw new Error("Header difficulty not at current or previous difficulty")
    }
  }
}

/**
 * Splits Bitcoin block headers in the raw format into an array of BlockHeaders.
 * @param blockHeaders - string that contains block headers in the raw format.
 * @returns Array of BlockHeader objects.
 */
function splitHeaders(blockHeaders: string): BlockHeader[] {
  if (blockHeaders.length % 160 !== 0) {
    throw new Error("Incorrect length of Bitcoin headers")
  }

  const result: BlockHeader[] = []
  for (let i = 0; i < blockHeaders.length; i += 160) {
    result.push(deserializeBlockHeader(blockHeaders.substring(i, i + 160)))
  }

  return result
}
