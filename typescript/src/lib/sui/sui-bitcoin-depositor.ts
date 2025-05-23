import { BitcoinRawTxVectors } from "../bitcoin"
import { Hex } from "../utils"
import { SuiClient } from "@mysten/sui/client"
import { Transaction } from "@mysten/sui/transactions"
import type { Signer } from "@mysten/sui/cryptography"

/**
 * Simplified SUI implementation for Bitcoin deposit initialization.
 *
 * This class handles the single operation needed by the SDK:
 * calling `initializeDeposit` on the SUI Bitcoin Depositor Move module.
 *
 * The cross-chain deposit flow requires only this one transaction on SUI,
 * after which the off-chain relayer handles the rest of the process.
 */
export class SuiBitcoinDepositor {
  readonly #suiClient: SuiClient
  readonly #packageId: string
  readonly #signer: Signer

  /**
   * Creates a new SuiBitcoinDepositor instance.
   *
   * @param suiClient Initialized SUI client
   * @param packageId SUI package ID containing the BitcoinDepositor module
   * @param signer SUI wallet signer for transaction signing
   */
  constructor(suiClient: SuiClient, packageId: string, signer: Signer) {
    this.#suiClient = suiClient
    this.#packageId = packageId
    this.#signer = signer
  }

  /**
   * Initializes a Bitcoin deposit on SUI by calling the Move module.
   *
   * This is the only operation the SDK needs to perform on SUI during
   * the 20-step cross-chain deposit process (step 10).
   *
   * @param depositTx Bitcoin funding transaction data
   * @param depositOutputIndex Output index in the funding transaction
   * @param depositOwner SUI address that will receive the final tBTC
   * @returns Transaction digest hash as a hexadecimal string
   */
  async initializeDeposit(
    depositTx: BitcoinRawTxVectors,
    depositOutputIndex: number,
    depositOwner: string
  ): Promise<Hex> {
    const txb = new Transaction()

    // Construct direct Move call without complex parameter packing
    txb.moveCall({
      target: `${this.#packageId}::bitcoin_depositor::initialize_deposit`,
      arguments: [
        txb.pure.vector("u8", Array.from(this.serializeBitcoinTx(depositTx))),
        txb.pure.u32(depositOutputIndex),
        txb.pure.address(depositOwner),
      ],
    })

    // Sign and execute the transaction
    const result = await this.#suiClient.signAndExecuteTransaction({
      transaction: txb,
      signer: this.#signer,
      options: {
        showEffects: true,
      },
    })

    if (result.effects?.status?.status !== "success") {
      throw new Error(
        `SUI deposit initialization failed: ${result.effects?.status?.error}`
      )
    }

    return Hex.from(result.digest)
  }

  /**
   * Serializes Bitcoin transaction for SUI Move module.
   * Simple concatenation of transaction components.
   *
   * @param tx Bitcoin transaction vectors to serialize
   * @returns Serialized transaction as a Uint8Array
   */
  private serializeBitcoinTx(tx: BitcoinRawTxVectors): Uint8Array {
    const version = tx.version.toBuffer()
    const inputs = tx.inputs.toBuffer()
    const outputs = tx.outputs.toBuffer()
    const locktime = tx.locktime.toBuffer()

    const totalLength =
      version.length + inputs.length + outputs.length + locktime.length
    const result = new Uint8Array(totalLength)
    let offset = 0

    result.set(version, offset)
    offset += version.length
    result.set(inputs, offset)
    offset += inputs.length
    result.set(outputs, offset)
    offset += outputs.length
    result.set(locktime, offset)

    return result
  }
}
