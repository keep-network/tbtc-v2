import { BigNumber } from "ethers"
import { DestinationChainTBTCToken, ChainIdentifier } from "../contracts"
import { SuiClient } from "@mysten/sui/client"
import { SuiAddress } from "./address"

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

    // TODO: Implement SUI logic
    // 1. Use `suiClient.getBalance` with the owner address (identifier.toString())
    //    and the specific `coinType` for tBTC on SUI.
    // 2. Convert the SUI balance (likely a string or bigint with potentially different decimals)
    //    to a BigNumber instance with 1e18 precision as expected by the interface.
    //    Note: Need to know the decimals of the tBTC token on SUI.

    console.log(
      "SUI balanceOf called (IMPLEMENTATION PENDING):",
      identifier.toString(),
      this.#coinType
    )

    // Placeholder return (assuming 0 balance and 18 decimals)
    return Promise.resolve(BigNumber.from(0))
  }
} 