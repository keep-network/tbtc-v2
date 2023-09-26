import { Hex } from "./lib/utils"
import { Bridge } from "./lib/contracts"
import {
  BitcoinClient,
  BitcoinNetwork,
  BitcoinAddressConverter,
  BitcoinTxOutput,
  BitcoinUtxo,
} from "./lib/bitcoin"

/**
 * Determines the plain-text wallet main UTXO currently registered in the
 * Bridge on-chain contract. The returned main UTXO can be undefined if the
 * wallet does not have a main UTXO registered in the Bridge at the moment.
 *
 * WARNING: THIS FUNCTION CANNOT DETERMINE THE MAIN UTXO IF IT COMES FROM A
 * BITCOIN TRANSACTION THAT IS NOT ONE OF THE LATEST FIVE TRANSACTIONS
 * TARGETING THE GIVEN WALLET PUBLIC KEY HASH. HOWEVER, SUCH A CASE IS
 * VERY UNLIKELY.
 *
 * @param walletPublicKeyHash - Public key hash of the wallet.
 * @param bridge - The handle to the Bridge on-chain contract.
 * @param bitcoinClient - Bitcoin client used to interact with the network.
 * @param bitcoinNetwork - Bitcoin network.
 * @returns Promise holding the wallet main UTXO or undefined value.
 */
export async function determineWalletMainUtxo(
  walletPublicKeyHash: Hex,
  bridge: Bridge,
  bitcoinClient: BitcoinClient,
  bitcoinNetwork: BitcoinNetwork
): Promise<BitcoinUtxo | undefined> {
  const { mainUtxoHash } = await bridge.wallets(walletPublicKeyHash)

  // Valid case when the wallet doesn't have a main UTXO registered into
  // the Bridge.
  if (
    mainUtxoHash.equals(
      Hex.from(
        "0x0000000000000000000000000000000000000000000000000000000000000000"
      )
    )
  ) {
    return undefined
  }

  // Declare a helper function that will try to determine the main UTXO for
  // the given wallet address type.
  const determine = async (
    witnessAddress: boolean
  ): Promise<BitcoinUtxo | undefined> => {
    // Build the wallet Bitcoin address based on its public key hash.
    const walletAddress = BitcoinAddressConverter.publicKeyHashToAddress(
      walletPublicKeyHash.toString(),
      witnessAddress,
      bitcoinNetwork
    )

    // Get the wallet transaction history. The wallet main UTXO registered in the
    // Bridge almost always comes from the latest BTC transaction made by the wallet.
    // However, there may be cases where the BTC transaction was made but their
    // SPV proof is not yet submitted to the Bridge thus the registered main UTXO
    // points to the second last BTC transaction. In theory, such a gap between
    // the actual latest BTC transaction and the registered main UTXO in the
    // Bridge may be even wider. The exact behavior is a wallet implementation
    // detail and not a protocol invariant so, it may be subject of changes.
    // To cover the worst possible cases, we always take the five latest
    // transactions made by the wallet for consideration.
    const walletTransactions = await bitcoinClient.getTransactionHistory(
      walletAddress,
      5
    )

    // Get the wallet script based on the wallet address. This is required
    // to find transaction outputs that lock funds on the wallet.
    const walletScript =
      BitcoinAddressConverter.addressToOutputScript(walletAddress)
    const isWalletOutput = (output: BitcoinTxOutput) =>
      walletScript.equals(output.scriptPubKey)

    // Start iterating from the latest transaction as the chance it matches
    // the wallet main UTXO is the highest.
    for (let i = walletTransactions.length - 1; i >= 0; i--) {
      const walletTransaction = walletTransactions[i]

      // Find the output that locks the funds on the wallet. Only such an output
      // can be a wallet main UTXO.
      const outputIndex = walletTransaction.outputs.findIndex(isWalletOutput)

      // Should never happen as all transactions come from wallet history. Just
      // in case check whether the wallet output was actually found.
      if (outputIndex < 0) {
        console.error(
          `wallet output for transaction ${walletTransaction.transactionHash.toString()} not found`
        )
        continue
      }

      // Build a candidate UTXO instance based on the detected output.
      const utxo: BitcoinUtxo = {
        transactionHash: walletTransaction.transactionHash,
        outputIndex: outputIndex,
        value: walletTransaction.outputs[outputIndex].value,
      }

      // Check whether the candidate UTXO hash matches the main UTXO hash stored
      // on the Bridge.
      if (mainUtxoHash.equals(bridge.buildUtxoHash(utxo))) {
        return utxo
      }
    }

    return undefined
  }

  // The most common case is that the wallet uses a witness address for all
  // operations. Try to determine the main UTXO for that address first as the
  // chance for success is the highest here.
  const mainUtxo = await determine(true)

  // In case the main UTXO was not found for witness address, there is still
  // a chance it exists for the legacy wallet address.
  return mainUtxo ?? (await determine(false))
}
