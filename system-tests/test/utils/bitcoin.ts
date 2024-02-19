// eslint-disable-next-line @typescript-eslint/ban-ts-comment
// @ts-ignore
import wifLib from "wif"
import { ec as EllipticCurve } from "elliptic"
import { assembleBitcoinSpvProof, Hex } from "@keep-network/tbtc-v2.ts"

import type { BitcoinTxHash, BitcoinClient } from "@keep-network/tbtc-v2.ts"
import type { Contract } from "ethers"

/**
 * Elliptic curve used by Bitcoin.
 */
const secp256k1 = new EllipticCurve("secp256k1")
/**
 * Default number of transaction confirmations required to perform a reliable
 * SPV proof.
 */
const defaultTxProofDifficultyFactor = 6

/**
 * Represents a Bitcoin key pair.
 */
export interface KeyPair {
  /**
   * Wallet Import Format.
   */
  wif: string
  /**
   * Private key.
   */
  privateKey: Hex
  /**
   * Public key.
   */
  publicKey: {
    /**
     * Compressed 33-byte-long public key prefixed with 02 or 03.
     */
    compressed: Hex
    /**
     * Uncompressed public key.
     */
    uncompressed: Hex
  }
}

/**
 * Creates a Bitcoin key pair from a Bitcoin WIF.
 * @param wif The WIF to create the key pair from.
 * @returns The Bitcoin key pair.
 */
export function keyPairFromWif(wif: string): KeyPair {
  const { privateKey } = wifLib.decode(wif)
  const keyPair = secp256k1.keyFromPrivate(privateKey)
  return {
    wif,
    privateKey: Hex.from(keyPair.getPrivate("hex")),
    publicKey: {
      compressed: Hex.from(keyPair.getPublic().encodeCompressed("hex")),
      // Trim the `04` prefix from the uncompressed key.
      uncompressed: Hex.from(
        keyPair.getPublic().encode("hex", false).substring(2)
      ),
    },
  }
}

/**
 * Waits until the given Bitcoin transaction will have the required number
 * of on-chain confirmations.
 * @param bitcoinClient Bitcoin client used to perform the check.
 * @param transactionHash Hash of the checked transaction.
 * @param requiredConfirmations Required confirmations count.
 * @param sleep Check frequency in milliseconds.
 * @returns Empty promise.
 */
export async function waitTransactionConfirmed(
  bitcoinClient: BitcoinClient,
  transactionHash: BitcoinTxHash,
  requiredConfirmations: number = defaultTxProofDifficultyFactor,
  sleep = 30000
): Promise<void> {
  for (;;) {
    // eslint-disable-next-line no-await-in-loop
    await new Promise((r) => setTimeout(r, sleep))

    console.log(`
      Checking confirmations count for transaction ${transactionHash}
    `)

    // eslint-disable-next-line no-await-in-loop
    const confirmations = await bitcoinClient.getTransactionConfirmations(
      transactionHash
    )

    if (confirmations >= requiredConfirmations) {
      console.log(`
        Transaction ${transactionHash} has enough confirmations.
      `)
      return
    }

    console.log(`
      Transaction ${transactionHash} has only ${confirmations}/${requiredConfirmations} confirmations. Waiting for more...
    `)
  }
}

/**
 * Fakes the difficulty provided by the relay contract by setting it to a value
 * that allows to perform a successful SPV proof of the given transaction.
 * This function should be used only with deployments that use a stub relay
 * which exposes `setCurrentEpochDifficultyFromHeaders` and
 * `setPrevEpochDifficultyFromHeaders` functions. The right difficulty is
 * determined based on the header chain containing the given transaction.
 * The header chain length (`headerChainLength` parameter) should be
 * the same as the header chain length required by SPV proof function exposed
 * by the bridge.
 * @param relay Relay contract instance.
 * @param bitcoinClient Bitcoin client used to perform the difficulty evaluation.
 * @param transactionHash Hash of the transaction the difficulty should be
 *        set for.
 * @param headerChainLength Length of the header chain used to determine the
 *        right difficulty.
 * @returns Empty promise.
 */
export async function fakeRelayDifficulty(
  relay: Contract,
  bitcoinClient: BitcoinClient,
  transactionHash: BitcoinTxHash,
  headerChainLength: number = defaultTxProofDifficultyFactor
): Promise<void> {
  const proof = await assembleBitcoinSpvProof(
    transactionHash,
    headerChainLength,
    bitcoinClient
  )

  const bitcoinHeaders = `0x${proof.bitcoinHeaders}`

  await relay.setCurrentEpochDifficultyFromHeaders(bitcoinHeaders)
  await relay.setPrevEpochDifficultyFromHeaders(bitcoinHeaders)
}
