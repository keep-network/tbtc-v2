// @ts-ignore
import wif from "wif"
import { ec as EllipticCurve } from "elliptic"

const secp256k1 = new EllipticCurve("secp256k1")

/**
 * Represents a Bitcoin key pair.
 */
export interface KeyPair {
  /**
   * Private key in WIF format.
   */
  privateKeyWif: string
  /**
   * Private key as an unprefixed hex string.
   */
  privateKey: string
  /**
   * Compressed public key as a 33-byte hex string prefixed with 02 or 03.
   */
  compressedPublicKey: string
  /**
   * Uncompressed public key as an unprefixed hex string.
   */
  uncompressedPublicKey: string
}

/**
 * Creates a Bitcoin key pair from a private key in WIF format.
 * @param privateKeyWif Private key in WIF format.
 * @returns The Bitcoin key pair.
 */
export function keyPairFromPrivateWif(privateKeyWif: string): KeyPair {
  const privateKey = wif.decode(privateKeyWif).privateKey
  const keyPair = secp256k1.keyFromPrivate(privateKey)
  return {
    privateKeyWif,
    privateKey: keyPair.getPrivate("hex"),
    compressedPublicKey: keyPair.getPublic().encodeCompressed("hex"),
    // Trim the `04` prefix from uncompressed key.
    uncompressedPublicKey: keyPair
      .getPublic()
      .encode("hex", false)
      .substring(2),
  }
}
