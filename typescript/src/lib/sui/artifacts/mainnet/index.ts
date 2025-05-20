/**
 * SUI Mainnet artifacts
 * Contract addresses and configuration for the SUI mainnet
 */
export const SuiMainnetArtifacts = {
  // This contract defines the Wormhole chain ID for SUI internally
  L1BitcoinDepositor: {
    address: "0x0", // TODO: Replace with SUI L1 Bitcoin Depositor on Ethereum mainnet when available
  },
  BitcoinDepositor: {
    packageId: "0x0", // TODO: Replace with real mainnet package ID when available
    wormholeGateway: "0x0", // TODO: Replace with real mainnet gateway when available
  },
  TBTCToken: {
    packageId: "0x0", // TODO: Replace with real mainnet package ID when available
    coinType: "0x0::tbtc::TBTC", // Will be derived from packageId when available
  },
}
