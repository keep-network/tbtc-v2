import { BigNumber } from "ethers"
import { DestinationChainTBTCToken, ChainIdentifier } from "../contracts"
import { SuiClient } from "@mysten/sui/client"
import { SuiAddress } from "./address"

// The TBTC token on SUI uses 8 decimals as defined in the tbtc.move contract
// This is different from Bitcoin's 8 decimals
const SUI_TBTC_DECIMALS = 8
// Standard Ethereum token decimals (used for returning values compatible with other chains)
const STANDARD_TOKEN_DECIMALS = 18
// Difference between STANDARD_TOKEN_DECIMALS and SUI_TBTC_DECIMALS
// Used to adjust the balance from SUI's format to standard format
const DECIMAL_ADJUSTMENT = STANDARD_TOKEN_DECIMALS - SUI_TBTC_DECIMALS

/**
 * SUI implementation of the DestinationChainTBTCToken interface.
 *
 * Communicates with the TBTC token smart contract deployed on the SUI blockchain.
 * The SUI implementation of TBTC (defined in `tbtc.move`) uses 8 decimal places,
 * while standard Ethereum tokens use 18 decimal places.
 *
 * ## Decimal Precision Handling
 *
 * From the SUI contract in `tbtc.move`:
 * ```move
 * let (treasury_cap, metadata) = coin::create_currency(
 *     witness,
 *     8, // Bitcoin uses 8 decimals
 *     b"TBTC",
 *     // ...
 * );
 * ```
 *
 * The `balanceOf` method automatically adjusts the returned balance:
 * 1. Fetches the raw balance from SUI (with 8 decimal places)
 * 2. Converts it to a standard 18-decimal BigNumber by multiplying by 10^8
 *    This ensures consistent precision with other chain implementations
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

  /**
   * Get chain identifier of the contract.
   * @returns Chain identifier of the contract.
   */
  getChainIdentifier(): ChainIdentifier {
    return this.#contractAddress
  }

  /**
   * Get the balance of TBTC tokens for the given owner address.
   * @param owner The SUI address to check balance for.
   * @returns Promise<BigNumber> The token balance adjusted to 18 decimal places.
   * @throws If the owner is not a SuiAddress.
   */
  async balanceOf(owner: ChainIdentifier): Promise<BigNumber> {
    if (!(owner instanceof SuiAddress)) {
      throw new Error("Identifier must be a SuiAddress")
    }

    try {
      // Get the balance from SUI network (with SUI_TBTC_DECIMALS precision)
      const response = await this.#suiClient.getBalance({
        owner: owner.toString(),
        coinType: this.#coinType,
      })

      const balance = response.totalBalance || "0"

      // Convert the SUI balance (8 decimals) to the standard token format (18 decimals)
      // by multiplying by 10^(STANDARD_TOKEN_DECIMALS - SUI_TBTC_DECIMALS)
      return BigNumber.from(balance).mul(
        BigNumber.from(10).pow(DECIMAL_ADJUSTMENT)
      )
    } catch (error) {
      // Return 0 as balance if there was an error fetching it
      // This is often the case when the user doesn't have any tokens
      return BigNumber.from(0)
    }
  }
}
