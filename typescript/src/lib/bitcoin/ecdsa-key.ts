import bcoin from "bcoin"
import wif from "wif"
import { BigNumber } from "ethers"
import { Hex } from "../utils"

/**
 * Checks whether given public key is a compressed Bitcoin public key.
 * @param publicKey - Public key that should be checked.
 * @returns True if the key is a compressed Bitcoin public key, false otherwise.
 */
function isCompressedPublicKey(publicKey: string): boolean {
  // Must have 33 bytes and 02 or 03 prefix.
  return (
    publicKey.length == 66 &&
    (publicKey.substring(0, 2) == "02" || publicKey.substring(0, 2) == "03")
  )
}

/**
 * Compresses the given uncompressed Bitcoin public key.
 * @param publicKey Uncompressed 64-byte public key as an unprefixed hex string.
 * @returns Compressed 33-byte public key prefixed with 02 or 03.
 */
function compressPublicKey(publicKey: string | Hex): string {
  if (typeof publicKey === "string") {
    publicKey = Hex.from(publicKey)
  }

  publicKey = publicKey.toString()

  // Must have 64 bytes and no prefix.
  if (publicKey.length != 128) {
    throw new Error(
      "The public key parameter must be 64-byte. Neither 0x nor 04 prefix is allowed"
    )
  }

  // The X coordinate is the first 32 bytes.
  const publicKeyX = publicKey.substring(0, 64)
  // The Y coordinate is the next 32 bytes.
  const publicKeyY = publicKey.substring(64)

  let prefix: string
  if (BigNumber.from(`0x${publicKeyY}`).mod(2).eq(0)) {
    prefix = "02"
  } else {
    prefix = "03"
  }

  return `${prefix}${publicKeyX}`
}

/**
 * Utility functions allowing to perform Bitcoin ECDSA public keys.
 */
export const BitcoinPublicKeyUtils = {
  isCompressedPublicKey,
  compressPublicKey,
}

/**
 * Creates a Bitcoin key ring based on the given private key.
 * @param privateKey Private key that should be used to create the key ring
 * @param witness Flag indicating whether the key ring will create witness
 *        or non-witness addresses
 * @returns Bitcoin key ring.
 */
function createKeyRing(privateKey: string, witness: boolean = true): any {
  const decodedPrivateKey = wif.decode(privateKey)

  return new bcoin.KeyRing({
    witness: witness,
    privateKey: decodedPrivateKey.privateKey,
    compressed: decodedPrivateKey.compressed,
  })
}

/**
 * Utility functions allowing to perform Bitcoin ECDSA public keys.
 */
export const BitcoinPrivateKeyUtils = {
  createKeyRing,
}
