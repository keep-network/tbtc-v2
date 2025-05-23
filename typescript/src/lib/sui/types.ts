/**
 * SUI-specific type definitions for the simplified SDK integration.
 *
 * These types are focused on the essential operations needed for
 * cross-chain Bitcoin deposits, avoiding the over-engineered
 * abstractions from the previous implementation.
 */

import { SuiClient } from "@mysten/sui/client"
import type { Signer } from "@mysten/sui/cryptography"

/**
 * Configuration for SUI network connection and contracts.
 */
export interface SuiNetworkConfig {
  rpcUrl: string
  packageId: string
  bitcoinDepositorModule: string
}

/**
 * SUI artifacts structure for contract addresses and IDs.
 */
export interface SuiArtifacts {
  BitcoinDepositor: {
    packageId: string
  }
  L1BitcoinDepositor: {
    packageId: string
  }
}

/**
 * SUI initialization options for the SDK.
 */
export interface SuiInitOptions {
  client: SuiClient
  config: SuiNetworkConfig
  signer?: Signer
}
