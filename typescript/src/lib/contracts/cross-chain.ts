import { ChainIdentifier } from "./chain-identifier"
import { BigNumber } from "ethers"
import { ChainMapping, L2Chain } from "./chain"

/**
 * Convenience type aggregating TBTC cross-chain contracts forming a connector
 * between TBTC L1 ledger chain and a specific supported L2/side-chain.
 */
export type CrossChainContracts = L2CrossChainContracts & L1CrossChainContracts

/**
 * Aggregates L2-specific TBTC cross-chain contracts.
 */
export type L2CrossChainContracts = {
  l2TbtcToken: L2TBTCToken
  l2BitcoinDepositor: L2BitcoinDepositor
}

/**
 * Aggregates L1-specific TBTC cross-chain contracts.
 */
export type L1CrossChainContracts = {
  l1BitcoinDepositor: L1BitcoinDepositor
}

/**
 * Interface for loading TBTC cross-chain contracts for a specific L2 chain.
 * It should be implemented for each supported L1 chain tBTC ledger is deployed
 * on.
 */
export interface CrossChainContractsLoader {
  /**
   * Loads the chain mapping based on underlying L1 chain.
   */
  loadChainMapping: () => ChainMapping | undefined
  /**
   * Loads L1-specific TBTC cross-chain contracts for the given L2 chain.
   * @param l2ChainName Name of the L2 chain for which to load L1 contracts.
   */
  loadL1Contracts: (l2ChainName: L2Chain) => Promise<L1CrossChainContracts>
}

/**
 * Interface for communication with the on-chain contract of the given
 * canonical L2 tBTC token.
 */
export interface L2TBTCToken {
  /**
   * Gets the chain-specific identifier of this contract.
   */
  getChainIdentifier(): ChainIdentifier

  /**
   * Returns the balance of the given identifier.
   * @param identifier Identifier of the account to get the balance for.
   * @returns The balance of the given identifier in 1e18 precision.
   */
  balanceOf(identifier: ChainIdentifier): Promise<BigNumber>
}

/**
 * Interface for communication with the L2BitcoinDepositor on-chain contract
 * deployed on the given L2 chain.
 */
export interface L2BitcoinDepositor {
  /**
   * Gets the chain-specific identifier of this contract.
   */
  getChainIdentifier(): ChainIdentifier
}

/**
 * Interface for communication with the L1BitcoinDepositor on-chain contract
 * specific to the given L2 chain, deployed on the L1 chain.
 */
export interface L1BitcoinDepositor {
  /**
   * Gets the chain-specific identifier of this contract.
   */
  getChainIdentifier(): ChainIdentifier
}
