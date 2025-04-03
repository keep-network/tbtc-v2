import {
  BitcoinDepositor,
  ChainIdentifier,
  DepositReceipt,
  ExtraDataEncoder,
  DestinationChainName,
} from "../contracts"
import { BitcoinRawTxVectors } from "../bitcoin"
import { Hex } from "../utils"
import { SuiClient } from "@mysten/sui/client"
import { SuiAddress } from "./address"
import { CrossChainExtraDataEncoder } from "../ethereum/l1-bitcoin-depositor"

/**
 * Implementation of the BitcoinDepositor interface for the SUI network.
 */
export class SuiBitcoinDepositor implements BitcoinDepositor {
  readonly #suiClient: SuiClient
  readonly #contractAddress: SuiAddress // Address/ID of the deployed SUI package/module
  readonly #extraDataEncoder: CrossChainExtraDataEncoder
  #depositOwner: ChainIdentifier | undefined

  constructor(suiClient: SuiClient, contractAddress: string) {
    this.#suiClient = suiClient
    this.#contractAddress = SuiAddress.from(contractAddress)
    // Assuming SUI destination for the encoder
    this.#extraDataEncoder = new CrossChainExtraDataEncoder("Sui")
  }

  getChainIdentifier(): ChainIdentifier {
    return this.#contractAddress
  }

  getDepositOwner(): ChainIdentifier | undefined {
    return this.#depositOwner
  }

  setDepositOwner(depositOwner: ChainIdentifier): void {
    if (!(depositOwner instanceof SuiAddress)) {
      throw new Error("Deposit owner must be a SuiAddress for SUI depositor")
    }
    this.#depositOwner = depositOwner
  }

  extraDataEncoder(): CrossChainExtraDataEncoder {
    return this.#extraDataEncoder
  }

  async initializeDeposit(
    depositTx: BitcoinRawTxVectors,
    depositOutputIndex: number,
    deposit: DepositReceipt,
    vault?: ChainIdentifier // Vault might be represented differently in SUI
  ): Promise<Hex> {
    if (!this.#depositOwner) {
      throw new Error("Deposit owner must be set before initializing deposit")
    }

    if (vault && !(vault instanceof SuiAddress)) {
      throw new Error("Vault identifier must be a SuiAddress for SUI depositor")
    }

    const extraData = this.extraDataEncoder().encodeDepositOwner(
      this.#depositOwner
    )

    // TODO: Implement SUI logic
    // 1. Prepare the transaction payload for the SUI contract call
    //    - This will involve mapping the parameters (depositTx, index, deposit, vault?,
    //      extraData containing depositOwner) to the expected arguments of the SUI
    //      move function.
    // 2. Use `suiClient.signAndExecuteTransactionBlock` (or similar) to send the tx.
    // 3. Extract and return the transaction hash/digest as a Hex object.

    console.log(
      "SUI initializeDeposit called (IMPLEMENTATION PENDING):",
      depositTx,
      depositOutputIndex,
      deposit,
      vault,
      extraData
    )

    // Placeholder return
    return Promise.resolve(Hex.from("0xPENDING_SUI_IMPLEMENTATION"))
  }
} 