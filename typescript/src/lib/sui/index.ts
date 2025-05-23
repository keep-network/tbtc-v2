import type { SuiClient } from "@mysten/sui/client"
import type { Signer } from "@mysten/sui/cryptography"
import { SuiBitcoinDepositor } from "./sui-bitcoin-depositor"
import { SuiChainAdapter } from "./sui-chain-adapter"
import { getSuiArtifacts } from "./artifacts"
import { SuiNetworkConfig, SuiInitOptions } from "./types"

/**
 * Creates a simplified SUI chain adapter for tBTC operations.
 *
 * This replaces the complex cross-chain interfaces with a clean,
 * focused adapter that handles only the essential SUI operations.
 *
 * @param options SUI initialization options
 * @returns Configured SUI chain adapter
 */
export function createSuiAdapter(options: SuiInitOptions): SuiChainAdapter {
  return new SuiChainAdapter(options.client, options.config, options.signer)
}

/**
 * Loads SUI destination chain contracts for legacy compatibility.
 *
 * @deprecated Use createSuiAdapter() instead for new implementations
 * @param suiClient Initialized SUI Client
 * @param suiSigner Signer object for SUI transactions
 * @param isTestnet Flag indicating whether to use testnet artifacts
 * @returns Legacy destination chain interfaces
 */
export function loadSuiDestinationChainContracts(
  suiClient: SuiClient,
  suiSigner: Signer,
  isTestnet: boolean = true
): any {
  console.log(
    `[SDK SUI LIB] loadSuiDestinationChainContracts: isTestnet=${isTestnet}, signerPresent=${!!suiSigner}`
  )

  const artifacts = getSuiArtifacts(isTestnet)

  if (!artifacts.BitcoinDepositor || !artifacts.L1BitcoinDepositor) {
    console.error(
      "[SDK SUI LIB ERROR] Artifacts are missing key properties!",
      artifacts
    )
    throw new Error("SUI artifacts are incomplete.")
  }

  const suiBitcoinDepositor = new SuiBitcoinDepositor(
    suiClient,
    artifacts.BitcoinDepositor.packageId,
    suiSigner
  )

  // Return minimal structure for backward compatibility
  return {
    destinationChainBitcoinDepositor: suiBitcoinDepositor,
    destinationChainTbtcToken: {
      // Stub implementation - SDK doesn't need token interaction
      getChainIdentifier: () => {
        throw new Error("SUI tBTC token interaction not supported in SDK")
      },
      balanceOf: () => {
        throw new Error("SUI tBTC token interaction not supported in SDK")
      },
    },
  }
}

// Export types and classes
export { SuiChainAdapter, SuiBitcoinDepositor }
export type { SuiNetworkConfig, SuiInitOptions }
