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
import { Transaction } from "@mysten/sui/transactions"
import type { Signer } from "@mysten/sui/cryptography"
import { packRevealDepositParameters } from "../ethereum"

/**
 * SUI implementation of BitcoinDepositor.
 * 
 * This class handles the initialization of Bitcoin deposits on the SUI blockchain.
 * It communicates with the `l2_tbtc::BitcoinDepositor` Move module defined in `bitcoin_depositor.move`.
 * 
 * ## Parameter Mapping (TypeScript → Move)
 * 
 * When `initializeDeposit` is called, the TypeScript parameters are transformed as follows:
 * 
 * - `fundingTx` (BitcoinRawTxVectors): Serialized as concatenated byte vectors:
 *   ```
 *   [version bytes][inputs bytes][outputs bytes][locktime bytes]
 *   ```
 *   This becomes the `funding_tx: vector<u8>` parameter in Move.
 * 
 * - `depositReceipt.extraData` (Hex): Used directly as the `deposit_owner: vector<u8>` 
 *   parameter in Move. This stores the SUI address of the deposit owner (32 bytes).
 * 
 * - Deposit reveal data: Constructed from `depositReceipt` fields (walletPublicKeyHash,
 *   refundPublicKeyHash, etc.) and sent as the `deposit_reveal: vector<u8>` parameter in Move.
 * 
 * The SUI deposit is considered successful when the Move function emits a `DepositInitialized` event.
 */
export class SuiBitcoinDepositor implements BitcoinDepositor {
  readonly #suiClient: SuiClient
  readonly #contractAddress: SuiAddress // Address/ID of the deployed SUI package/module
  readonly #extraDataEncoder: CrossChainExtraDataEncoder
  readonly #signer: Signer
  #depositOwner: ChainIdentifier | undefined

  constructor(suiClient: SuiClient, contractAddress: string, signer: Signer) {
    this.#suiClient = suiClient
    this.#contractAddress = SuiAddress.from(contractAddress)
    // Assuming SUI destination for the encoder
    this.#extraDataEncoder = new CrossChainExtraDataEncoder("Sui")
    this.#signer = signer // Store signer
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

    // TODO: Implement SUI logic - IMPLEMENTED (NEEDS VERIFICATION)

    // --- START: Fill in your Move function details --- 
    const SUI_PACKAGE_ID = this.#contractAddress.toString() 
    const TARGET_MODULE_NAME = "BitcoinDepositor" // From provided Move code
    const TARGET_FUNCTION_NAME = "initialize_deposit" // From provided Move code
    // --- END: Fill in your Move function details --- 

    // Pack parameters using the existing utility
    // NOTE: Assumes return values can be serialized to vector<u8>
    const { fundingTx, reveal } = packRevealDepositParameters(
      depositTx,
      depositOutputIndex,
      deposit,
      vault // Pass vault here
    )

    const txb = new Transaction()

    // --- START: Map arguments to your Move function signature --- 
    // WARNING: Serialization of fundingTx and reveal needs verification!
    // Assuming they are hex strings or similar that can be buffered directly.
    const moveCallArgs = [
      txb.pure(Buffer.from(fundingTx.toString(), "hex")), // funding_tx: vector<u8>
      txb.pure(Buffer.from(reveal.toString(), "hex")),    // deposit_reveal: vector<u8>
      txb.pure(Buffer.from(extraData.toString(), "hex")), // deposit_owner: vector<u8>
    ] // <<< VERIFY SERIALIZATION AND TYPES HERE CAREFULLY! 
    // --- END: Map arguments to your Move function signature --- 

    txb.moveCall({
      target: `${SUI_PACKAGE_ID}::${TARGET_MODULE_NAME}::${TARGET_FUNCTION_NAME}`,
      arguments: moveCallArgs,
      // typeArguments: [] // Add if your move function has type arguments
    })

    try {
      // Sign and execute the transaction block
      // Use signAndExecuteTransaction and provide the signer
      const result = await this.#suiClient.signAndExecuteTransaction({
        transaction: txb, 
        signer: this.#signer, // Pass stored signer
        options: {
          showEffects: true, // Recommended to check for errors
        },
      })

      // Check for execution errors
      if (result.effects?.status.status !== "success") {
        throw new Error(
          `SUI transaction failed: ${result.effects?.status.error}`
        )
      }

      // Extract the transaction digest
      const txDigest = result.digest
      return Hex.from(txDigest)

    } catch (error) {
      console.error("Error executing SUI initializeDeposit transaction:", error)
      throw error // Re-throw the error for handling upstream
    }
  }
} 