import { SuiTestnetArtifacts } from "./testnet"
import { SuiMainnetArtifacts } from "./mainnet"

/**
 * Get SUI artifacts based on network
 * @param isTestnet Flag indicating whether to use testnet artifacts (default: true)
 * @returns The appropriate SUI artifacts for the network
 */
export function getSuiArtifacts(isTestnet: boolean = true) {
  return isTestnet ? SuiTestnetArtifacts : SuiMainnetArtifacts
}

// Export artifacts directly for convenience
export { SuiTestnetArtifacts, SuiMainnetArtifacts }
