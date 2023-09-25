import bcoin, { Script } from "bcoin"
import { Hex } from "../utils"
import { BitcoinNetwork, toBcoinNetwork } from "./network"

/**
 * Encodes a public key hash into a P2PKH/P2WPKH address.
 * @param publicKeyHash - public key hash that will be encoded. Must be an
 *        unprefixed hex string (without 0x prefix).
 * @param witness - If true, a witness public key hash will be encoded and
 *        P2WPKH address will be returned. Returns P2PKH address otherwise
 * @param network - Network the address should be encoded for.
 * @returns P2PKH or P2WPKH address encoded from the given public key hash
 * @throws Throws an error if network is not supported.
 */
export function encodeToBitcoinAddress(
  publicKeyHash: string,
  witness: boolean,
  network: BitcoinNetwork
): string {
  const buffer = Buffer.from(publicKeyHash, "hex")
  const bcoinNetwork = toBcoinNetwork(network)
  return witness
    ? bcoin.Address.fromWitnessPubkeyhash(buffer).toString(bcoinNetwork)
    : bcoin.Address.fromPubkeyhash(buffer).toString(bcoinNetwork)
}

/**
 * Decodes P2PKH or P2WPKH address into a public key hash. Throws if the
 * provided address is not PKH-based.
 * @param address - P2PKH or P2WPKH address that will be decoded.
 * @returns Public key hash decoded from the address. This will be an unprefixed
 *        hex string (without 0x prefix).
 */
export function decodeBitcoinAddress(address: string): string {
  const addressObject = new bcoin.Address(address)

  const isPKH =
    addressObject.isPubkeyhash() || addressObject.isWitnessPubkeyhash()
  if (!isPKH) {
    throw new Error("Address must be P2PKH or P2WPKH")
  }

  return addressObject.getHash("hex")
}

/**
 * Creates the output script from the BTC address.
 * @param address BTC address.
 * @returns The un-prefixed and not prepended with length output script.
 */
export function createOutputScriptFromAddress(address: string): Hex {
  return Hex.from(Script.fromAddress(address).toRaw().toString("hex"))
}

/**
 * Creates the Bitcoin address from the output script.
 * @param script The unprefixed and not prepended with length output script.
 * @param network Bitcoin network.
 * @returns The Bitcoin address.
 */
export function createAddressFromOutputScript(
  script: Hex,
  network: BitcoinNetwork = BitcoinNetwork.Mainnet
): string {
  return Script.fromRaw(script.toString(), "hex")
    .getAddress()
    ?.toString(toBcoinNetwork(network))
}
