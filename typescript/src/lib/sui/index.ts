import { DestinationChainInterfaces } from "../contracts"
import { SuiClient } from "@mysten/sui/client"
import { SuiBitcoinDepositor } from "./sui-bitcoin-depositor"
import { SuiTBTCToken } from "./sui-tbtc-token"

// TODO: Define SUI contract/package addresses/IDs and CoinType
// These should likely come from configuration or environment variables
const SUI_DEPOSITOR_CONTRACT_ADDRESS = "0xPLACEHOLDER_SUI_DEPOSITOR_PACKAGE_ID"
const SUI_TBTC_CONTRACT_ADDRESS = "0xPLACEHOLDER_SUI_TBTC_PACKAGE_ID"
const SUI_TBTC_COIN_TYPE = `${SUI_TBTC_CONTRACT_ADDRESS}::tbtc::TBTC` // Example format

/**
 * Loads SUI implementation of tBTC cross-chain interfaces.
 *
 * @param suiClient Initialized SUI Client.
 * @returns Destination chain interfaces specific to SUI.
 */
export function loadSuiDestinationChainContracts(
  suiClient: SuiClient
): DestinationChainInterfaces {
  const suiBitcoinDepositor = new SuiBitcoinDepositor(
    suiClient,
    SUI_DEPOSITOR_CONTRACT_ADDRESS
  )
  const suiTbtcToken = new SuiTBTCToken(
    suiClient,
    SUI_TBTC_CONTRACT_ADDRESS,
    SUI_TBTC_COIN_TYPE
  )

  return {
    destinationChainBitcoinDepositor: suiBitcoinDepositor,
    destinationChainTbtcToken: suiTbtcToken,
  }
} 