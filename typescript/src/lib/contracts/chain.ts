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
}

/**
 * Layer 2 chains supported by tBTC v2 contracts.
 */
export type L2Chain = Exclude<keyof typeof Chains, "Ethereum">

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
}

/**
 * List of chain mappings supported by tBTC v2 contracts.
 */
export const ChainMappings: ChainMapping[] = [
  {
    ethereum: Chains.Ethereum.Mainnet,
    base: Chains.Base.Base,
    arbitrum: Chains.Arbitrum.Arbitrum,
  },
  {
    ethereum: Chains.Ethereum.Sepolia,
    base: Chains.Base.BaseSepolia,
    arbitrum: Chains.Arbitrum.ArbitrumSepolia,
  },
]
