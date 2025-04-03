/* eslint-disable no-unused-vars */
/**
 * Chains supported by tBTC v2 contracts.
 */
export namespace Chains {
  export enum Ethereum {
    Mainnet = "1",
    Sepolia = "11155111",
    Local = "1101",
  }

  export enum Base {
    Base = "8453",
    BaseSepolia = "84532",
  }

  export enum Arbitrum {
    Arbitrum = "42161",
    ArbitrumSepolia = "421614",
  }

  export enum Solana {
    Solana = "5eykt4UsFv8P8NJdTREpY1vzqKqZKvdpKuc147dw2N9d",
    Devnet = "GH7ome3EiwEr7tu9JuTh2dpYWBJK3z69Xm1ZE3MEE6JC",
  }

  // Add SUI chains
  export enum Sui {
    Sui = "PLACEHOLDER_SUI_MAINNET_ID", // Replace with actual Mainnet ID
    Testnet = "PLACEHOLDER_SUI_TESTNET_ID", // Replace with actual Testnet ID
    Devnet = "PLACEHOLDER_SUI_DEVNET_ID", // Replace with actual Devnet ID
  }
}

/**
 * Layer 2 chains supported by tBTC v2 contracts.
 */
export type DestinationChainName = Exclude<
  keyof typeof Chains,
  "Ethereum"
> // Note: This automatically includes "Sui"

/**
 * Type representing a mapping between specific L1 and L2 chains.
 */
export type ChainMapping = {
  /**
   * Identifier of the Ethereum L1 chain.
   */
  ethereum?: Chains.Ethereum
  /**
   * Identifier of the Base L2 chain.
   */
  base?: Chains.Base

  /**
   * Identifier of the Arbitrum L2 chain.
   */
  arbitrum?: Chains.Arbitrum

  /**
   * Identifier of the Arbitrum L2 chain.
   */
  solana?: Chains.Solana
  /**
   * Identifier of the SUI chain.
   */
  sui?: Chains.Sui // Add Sui to ChainMapping
}

/**
 * List of chain mappings supported by tBTC v2 contracts.
 */
export const ChainMappings: ChainMapping[] = [
  {
    ethereum: Chains.Ethereum.Mainnet,
    base: Chains.Base.Base,
    arbitrum: Chains.Arbitrum.Arbitrum,
    solana: Chains.Solana.Solana,
    sui: Chains.Sui.Sui, // Add Sui Mainnet
  },
  {
    ethereum: Chains.Ethereum.Sepolia,
    base: Chains.Base.BaseSepolia,
    arbitrum: Chains.Arbitrum.ArbitrumSepolia,
    solana: Chains.Solana.Devnet,
    sui: Chains.Sui.Testnet, // Add Sui Testnet (or Devnet if preferred for Sepolia mapping)
  },
]
