import { DestinationChainInterfaces } from "../contracts"
import type { SuiClient } from "@mysten/sui/client"
import type { Signer } from "@mysten/sui/cryptography"
import { SuiBitcoinDepositor } from "./sui-bitcoin-depositor"
import { SuiTBTCToken } from "./sui-tbtc-token"
import { getSuiArtifacts } from "./artifacts"

/**
 * SUI network configuration interface
 */
export interface SuiNetworkConfig {
  depositorPackageId: string
  tbtcPackageId: string
  wormholeGateway: string
}

/**
 * Loads SUI implementation of tBTC cross-chain interfaces.
 *
 * @param suiClient Initialized SUI Client.
 * @param suiSigner Signer object for SUI transactions.
 * @param isTestnet Flag indicating whether to use testnet artifacts (default: true)
 * @returns Destination chain interfaces specific to SUI.
 */
export function loadSuiDestinationChainContracts(
  suiClient: SuiClient,
  suiSigner: Signer,
  isTestnet: boolean = true
): DestinationChainInterfaces {
  console.log(
    `[SDK SUI LIB] loadSuiDestinationChainContracts: isTestnet=${isTestnet}, signerPresent=${!!suiSigner}`
  )
  const artifacts = getSuiArtifacts(isTestnet)
  // console.log("[SDK SUI LIB DEBUG] Using artifacts:", JSON.stringify(artifacts, null, 2)); // Keep if needed for deep debug

  if (
    !artifacts.BitcoinDepositor ||
    !artifacts.TBTCToken ||
    !artifacts.L1BitcoinDepositor
  ) {
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

  const suiTbtcToken = new SuiTBTCToken(
    suiClient,
    artifacts.TBTCToken.packageId,
    `${artifacts.TBTCToken.packageId}::tbtc::TBTC`
  )

  return {
    destinationChainBitcoinDepositor: suiBitcoinDepositor,
    destinationChainTbtcToken: suiTbtcToken,
  }
}
