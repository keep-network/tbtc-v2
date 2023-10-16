import { address as btcjsaddress, payments } from "bitcoinjs-lib"
import { Hex } from "../utils"
import { BitcoinNetwork, toBitcoinJsLibNetwork } from "./network"

/**
 * Creates the Bitcoin address from the public key. Supports SegWit (P2WPKH) and
 * Legacy (P2PKH) formats.
 * @param publicKey Compressed public key used to derive the Bitcoin address.
 * @param bitcoinNetwork Target Bitcoin network.
 * @param witness Flag to determine address format: true for SegWit (P2WPKH)
 *        and false for Legacy (P2PKH). Default is true.
 * @returns The derived Bitcoin address.
 */
function publicKeyToAddress(
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
 * @param publicKeyHash Public key hash that will be encoded. Must be an
 *        unprefixed hex string (without 0x prefix).
 * @param witness If true, a witness public key hash will be encoded and
 *        P2WPKH address will be returned. Returns P2PKH address otherwise
 * @param bitcoinNetwork Network the address should be encoded for.
 * @returns P2PKH or P2WPKH address encoded from the given public key hash
 * @throws Throws an error if network is not supported.
 */
function publicKeyHashToAddress(
  publicKeyHash: string,
  witness: boolean,
  bitcoinNetwork: BitcoinNetwork
): string {
  const hash = Buffer.from(publicKeyHash, "hex")
  const network = toBitcoinJsLibNetwork(bitcoinNetwork)
  return witness
    ? payments.p2wpkh({ hash, network }).address!
    : payments.p2pkh({ hash, network }).address!
}

/**
 * Converts a P2PKH or P2WPKH address into a public key hash. Throws if the
 * provided address is not PKH-based.
 * @param address P2PKH or P2WPKH address that will be decoded.
 * @param bitcoinNetwork Network the address should be decoded for.
 * @returns Public key hash decoded from the address. This will be an unprefixed
 *        hex string (without 0x prefix).
 */
function addressToPublicKeyHash(
  address: string,
  bitcoinNetwork: BitcoinNetwork
): string {
  const network = toBitcoinJsLibNetwork(bitcoinNetwork)

  try {
    // Try extracting hash from P2PKH address.
    const hash = payments.p2pkh({ address: address, network }).hash!
    return hash.toString("hex")
  } catch (err) {}

  try {
    // Try extracting hash from P2WPKH address.
    const hash = payments.p2wpkh({ address: address, network }).hash!
    return hash.toString("hex")
  } catch (err) {}

  throw new Error("Address must be P2PKH or P2WPKH valid for given network")
}

/**
 * Converts an address to the respective output script.
 * @param address BTC address.
 * @param bitcoinNetwork Bitcoin network corresponding to the address.
 * @returns The un-prefixed and not prepended with length output script.
 */
function addressToOutputScript(
  address: string,
  bitcoinNetwork: BitcoinNetwork
): Hex {
  return Hex.from(
    btcjsaddress.toOutputScript(address, toBitcoinJsLibNetwork(bitcoinNetwork))
  )
}

/**
 * Converts an output script to the respective network-specific address.
 * @param script The unprefixed and not prepended with length output script.
 * @param bitcoinNetwork Bitcoin network the address should be produced for.
 * @returns The Bitcoin address.
 */
function outputScriptToAddress(
  script: Hex,
  bitcoinNetwork: BitcoinNetwork = BitcoinNetwork.Mainnet
): string {
  return btcjsaddress.fromOutputScript(
    script.toBuffer(),
    toBitcoinJsLibNetwork(bitcoinNetwork)
  )
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
