import { BigNumber } from "ethers"
import { Hex } from "../utils"

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
