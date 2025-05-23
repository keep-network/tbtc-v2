import { SuiClient } from "@mysten/sui/client"
import type { Signer } from "@mysten/sui/cryptography"
import { SuiBitcoinDepositor } from "./sui-bitcoin-depositor"
import { SuiAddress } from "./address"
import { BitcoinRawTxVectors } from "../bitcoin"
import { Hex } from "../utils"

/**
 * SUI network configuration for the adapter.
 */
export interface SuiNetworkConfig {
  rpcUrl: string
  packageId: string
  bitcoinDepositorModule: string
}

/**
 * Parameters for SUI deposit initialization.
 */
export interface DepositInitParams {
  depositTx: BitcoinRawTxVectors
  outputIndex: number
  depositOwner: SuiAddress
}

/**
 * Clean adapter for all SUI operations needed by the tBTC SDK.
 *
 * This adapter encapsulates all SUI-specific logic and provides a simple interface
 * for the 3 core operations needed for cross-chain Bitcoin deposits:
 * 1. Address encoding for Bitcoin deposit generation
 * 2. Transaction signing for deposit initialization
 * 3. Signer management for wallet connections
 *
 * This replaces the over-engineered multi-chain abstractions with a focused,
 * SUI-native implementation.
 */
export class SuiChainAdapter {
  private suiClient: SuiClient
  private config: SuiNetworkConfig
  private signer?: Signer
  private depositor?: SuiBitcoinDepositor

  constructor(suiClient: SuiClient, config: SuiNetworkConfig, signer?: Signer) {
    this.suiClient = suiClient
    this.config = config
    this.signer = signer
    this.initializeDepositor()
  }

  /**
   * Encodes a SUI address for Bitcoin deposit generation.
   *
   * This is used in step 5 of the 20-step cross-chain process to embed
   * the SUI destination address in the Bitcoin deposit transaction.
   *
   * @param suiAddress SUI address that will receive the final tBTC
   * @returns Hex-encoded address for Bitcoin transaction extra data
   */
  encodeDepositOwner(suiAddress: SuiAddress): Hex {
    return suiAddress.toHex()
  }

  /**
   * Initializes a Bitcoin deposit on SUI (step 10 of cross-chain process).
   *
   * This calls the SUI Move module to emit the event that triggers
   * the off-chain relayer to continue the cross-chain flow.
   *
   * @param params Deposit initialization parameters
   * @returns Transaction digest hash as string
   */
  async initializeDeposit(params: DepositInitParams): Promise<string> {
    if (!this.depositor) {
      throw new Error("SUI depositor not initialized - signer may be missing")
    }

    const result = await this.depositor.initializeDeposit(
      params.depositTx,
      params.outputIndex,
      params.depositOwner.toString()
    )

    return result.toString()
  }

  /**
   * Updates the signer when a SUI wallet connects.
   *
   * This is called when the user connects their SUI wallet (step 1)
   * or when the wallet connection changes.
   *
   * @param signer New SUI wallet signer
   * @returns void
   */
  setSigner(signer: Signer): void {
    this.signer = signer
    this.initializeDepositor()
  }

  /**
   * Gets the current signer if available.
   * @returns The current SUI wallet signer or undefined if none set
   */
  getSigner(): Signer | undefined {
    return this.signer
  }

  /**
   * Checks if a signer is currently available.
   * @returns True if a valid signer is available, false otherwise
   */
  hasValidSigner(): boolean {
    return this.signer !== undefined
  }

  /**
   * Initializes the internal depositor with current signer.
   * @returns void
   */
  private initializeDepositor(): void {
    if (this.signer) {
      this.depositor = new SuiBitcoinDepositor(
        this.suiClient,
        this.config.packageId,
        this.signer
      )
    }
  }
}
