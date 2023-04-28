// eslint-disable-next-line @typescript-eslint/ban-ts-comment
// @ts-ignore
import wifLib from "wif"
import { ec as EllipticCurve } from "elliptic"
import { assembleTransactionProof } from "@keep-network/tbtc-v2.ts/dist/src/proof"

import type { Contract } from "ethers"
import type { Client as BitcoinClient } from "@keep-network/tbtc-v2.ts/dist/src/bitcoin"
import type { BitcoinTransactionHash } from "@keep-network/tbtc-v2.ts/dist/src"

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
   * Private key as an unprefixed hex string.
   */
  privateKey: string
  /**
   * Public key.
   */
  publicKey: {
    /**
     * Compressed public key as a 33-byte hex string prefixed with 02 or 03.
     */
    compressed: string
    /**
     * Uncompressed public key as an unprefixed hex string.
     */
    uncompressed: string
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
    privateKey: keyPair.getPrivate("hex"),
    publicKey: {
      compressed: keyPair.getPublic().encodeCompressed("hex"),
      // Trim the `04` prefix from the uncompressed key.
      uncompressed: keyPair.getPublic().encode("hex", false).substring(2),
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
  transactionHash: BitcoinTransactionHash,
  requiredConfirmations: number = defaultTxProofDifficultyFactor,
  sleep = 60000
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
  transactionHash: BitcoinTransactionHash,
  headerChainLength: number = defaultTxProofDifficultyFactor
): Promise<void> {
  const proof = await assembleTransactionProof(
    transactionHash,
    headerChainLength,
    bitcoinClient
  )

  const bitcoinHeaders = `0x${proof.bitcoinHeaders}`

  await relay.setCurrentEpochDifficultyFromHeaders(bitcoinHeaders)
  await relay.setPrevEpochDifficultyFromHeaders(bitcoinHeaders)
}
