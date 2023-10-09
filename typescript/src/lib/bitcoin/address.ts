import bcoin, { Script } from "bcoin"
import { Hex } from "../utils"
import {
  BitcoinNetwork,
  toBcoinNetwork,
  toBitcoinJsLibNetwork,
} from "./network"
import { payments } from "bitcoinjs-lib"

/**
 * Creates the Bitcoin address from the public key. Supports SegWit (P2WPKH) and
 * Legacy (P2PKH) formats.
 * @param publicKey - Public key used to derive the Bitcoin address.
 * @param bitcoinNetwork - Target Bitcoin network.
 * @param witness - Flag to determine address format: true for SegWit (P2WPKH)
 *        and false for Legacy (P2PKH). Default is true.
 * @returns The derived Bitcoin address.
 */
export function publicKeyToAddress(
  publicKey: Hex,
  bitcoinNetwork: BitcoinNetwork,
  witness: boolean = true
): string {
  const network = toBitcoinJsLibNetwork(bitcoinNetwork)

  if (witness) {
    // P2WPKH (SegWit)
    return payments.p2wpkh({ pubkey: publicKey.toBuffer(), network }).address!
  } else {
    // P2PKH (Legacy)
    return payments.p2pkh({ pubkey: publicKey.toBuffer(), network }).address!
  }
}

/**
 * Converts a public key hash into a P2PKH/P2WPKH address.
 * @param publicKeyHash - public key hash that will be encoded. Must be an
 *        unprefixed hex string (without 0x prefix).
 * @param witness - If true, a witness public key hash will be encoded and
 *        P2WPKH address will be returned. Returns P2PKH address otherwise
 * @param network - Network the address should be encoded for.
 * @returns P2PKH or P2WPKH address encoded from the given public key hash
 * @throws Throws an error if network is not supported.
 */
function publicKeyHashToAddress(
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
 * Converts a P2PKH or P2WPKH address into a public key hash. Throws if the
 * provided address is not PKH-based.
 * @param address - P2PKH or P2WPKH address that will be decoded.
 * @returns Public key hash decoded from the address. This will be an unprefixed
 *        hex string (without 0x prefix).
 */
function addressToPublicKeyHash(address: string): string {
  const addressObject = new bcoin.Address(address)

  const isPKH =
    addressObject.isPubkeyhash() || addressObject.isWitnessPubkeyhash()
  if (!isPKH) {
    throw new Error("Address must be P2PKH or P2WPKH")
  }

  return addressObject.getHash("hex")
}

/**
 * Converts an address to the respective output script.
 * @param address BTC address.
 * @returns The un-prefixed and not prepended with length output script.
 */
function addressToOutputScript(address: string): Hex {
  return Hex.from(Script.fromAddress(address).toRaw().toString("hex"))
}

/**
 * Converts an output script to the respective network-specific address.
 * @param script The unprefixed and not prepended with length output script.
 * @param network Bitcoin network.
 * @returns The Bitcoin address.
 */
function outputScriptToAddress(
  script: Hex,
  network: BitcoinNetwork = BitcoinNetwork.Mainnet
): string {
  return Script.fromRaw(script.toString(), "hex")
    .getAddress()
    ?.toString(toBcoinNetwork(network))
}

/**
 * Utility functions allowing to perform Bitcoin address conversions.
 */
export const BitcoinAddressConverter = {
  publicKeyToAddress,
  publicKeyHashToAddress,
  addressToPublicKeyHash,
  addressToOutputScript,
  outputScriptToAddress,
}
