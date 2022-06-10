// eslint-disable-next-line @typescript-eslint/ban-ts-comment
// @ts-ignore
import wif from "wif"
import { ec as EllipticCurve } from "elliptic"
import { createTransactionProof } from "@keep-network/tbtc-v2.ts/dist/proof"
import { Contract } from "ethers"

import type {
  Client as BitcoinClient,
  TransactionHash,
} from "@keep-network/tbtc-v2.ts/dist/bitcoin"
import type { SystemTestsContext } from "./context"

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
  const { privateKey } = wif.decode(privateKeyWif)
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
  transactionHash: TransactionHash,
  requiredConfirmations: number = defaultTxProofDifficultyFactor,
  sleep = 60000
): Promise<void> {
  for (;;) {
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

    // eslint-disable-next-line no-await-in-loop
    await new Promise((r) => setTimeout(r, sleep))
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
 * @param systemTestsContext System tests context.
 * @param bitcoinClient Bitcoin client used to perform the difficulty evaluation.
 * @param transactionHash Hash of the transaction the difficulty should be
 *        set for.
 * @param headerChainLength Length of the header chain used to determine the
 *        right difficulty.
 * @returns Empty promise.
 */
export async function fakeRelayDifficulty(
  systemTestsContext: SystemTestsContext,
  bitcoinClient: BitcoinClient,
  transactionHash: TransactionHash,
  headerChainLength: number = defaultTxProofDifficultyFactor
): Promise<void> {
  const relayDeploymentInfo =
    systemTestsContext.contractsDeploymentInfo.contracts.Relay

  const relay = new Contract(
    relayDeploymentInfo.address,
    relayDeploymentInfo.abi,
    systemTestsContext.maintainer
  )

  const proof = await createTransactionProof(
    transactionHash,
    headerChainLength,
    bitcoinClient
  )

  const bitcoinHeaders = `0x${proof.bitcoinHeaders}`

  await relay.setCurrentEpochDifficultyFromHeaders(bitcoinHeaders)
  await relay.setPrevEpochDifficultyFromHeaders(bitcoinHeaders)
}
