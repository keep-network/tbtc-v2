/**
 * SUI Testnet artifacts
 * Contract addresses and configuration for the SUI testnet
 */
export const SuiTestnetArtifacts = {
  // This contract defines the Wormhole chain ID for SUI internally
  L1BitcoinDepositor: {
    address: "0xb306e0683f890BAFa669c158c7Ffa4b754b70C95", // SUI L1 Bitcoin Depositor on Sepolia
  },
  BitcoinDepositor: {
    packageId:
      "0x1db1fcdaada7c286d77f3347e593e06d8f33b8255e0861033a0a9f321f4eade7",
    wormholeGateway:
      "0x1db1fcdaada7c286d77f3347e593e06d8f33b8255e0861033a0a9f321f4eade7",
  },
  TBTCToken: {
    packageId:
      "0x1db1fcdaada7c286d77f3347e593e06d8f33b8255e0861033a0a9f321f4eade7",
    coinType:
      "0x1db1fcdaada7c286d77f3347e593e06d8f33b8255e0861033a0a9f321f4eade7::TBTC::TBTC",
  },
}
