import { BigNumber } from "ethers"
import { DestinationChainTBTCToken, ChainIdentifier } from "../contracts"
import { SuiClient } from "@mysten/sui/client"
import { SuiAddress } from "./address"

// Decimals of the TBTC token on SUI (from Move code)
const SUI_TBTC_DECIMALS = 9
// Decimals expected by the ethers.BigNumber interface
const INTERFACE_DECIMALS = 18

/**
 * Implementation of the DestinationChainTBTCToken interface for the SUI network.
 */
export class SuiTBTCToken implements DestinationChainTBTCToken {
  readonly #suiClient: SuiClient
  readonly #contractAddress: SuiAddress // Address/ID of the deployed SUI package/module holding the token
  readonly #coinType: string // Full coin type string (e.g., 0x...::tbtc::TBTC)

  constructor(suiClient: SuiClient, contractAddress: string, coinType: string) {
    this.#suiClient = suiClient
    this.#contractAddress = SuiAddress.from(contractAddress)
    this.#coinType = coinType
  }

  getChainIdentifier(): ChainIdentifier {
    return this.#contractAddress
  }

  async balanceOf(identifier: ChainIdentifier): Promise<BigNumber> {
    if (!(identifier instanceof SuiAddress)) {
      throw new Error("Identifier must be a SuiAddress for SUI TBTC Token")
    }

    // TODO: Implement SUI logic - DONE
    // 1. Use `suiClient.getBalance` with the owner address (identifier.toString())
    //    and the specific `coinType` for tBTC on SUI.
    // 2. Convert the SUI balance (likely a string or bigint with potentially different decimals)
    //    to a BigNumber instance with 1e18 precision as expected by the interface.
    //    Note: Need to know the decimals of the tBTC token on SUI.

    try {
      const coinBalance = await this.#suiClient.getBalance({
        owner: identifier.toString(),
        coinType: this.#coinType,
      })

      const balanceString = coinBalance.totalBalance

      // Convert the balance string (with SUI_TBTC_DECIMALS) to BigNumber (with INTERFACE_DECIMALS)
      const multiplier = BigNumber.from(10).pow(
        INTERFACE_DECIMALS - SUI_TBTC_DECIMALS
      )
      const balance = BigNumber.from(balanceString).mul(multiplier)

      return balance
    } catch (error) {
      console.error(
        `Error fetching SUI balance for ${identifier.toString()} and coin ${this.#coinType}:`,
        error
      )
      // Return 0 on error, or re-throw depending on desired behavior
      return BigNumber.from(0)
    }
  }
} 