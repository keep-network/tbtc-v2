import {
  ChainIdentifier,
  DepositReceipt,
  TBTCContracts,
} from "../../lib/contracts"
import {
  BitcoinAddressConverter,
  BitcoinClient,
  BitcoinHashUtils,
  BitcoinLocktimeUtils,
} from "../../lib/bitcoin"
import { Deposit } from "./deposit"
import * as crypto from "crypto"

/**
 * Service exposing features related to tBTC v2 deposits.
 */
export class DepositsService {
  /**
   * Deposit refund locktime duration in seconds.
   * This is 9 month in seconds assuming 1 month = 30 days
   */
  private readonly depositRefundLocktimeDuration = 23328000
  /**
   * Handle to tBTC contracts.
   */
  private readonly tbtcContracts: TBTCContracts
  /**
   * Bitcoin client handle.
   */
  private readonly bitcoinClient: BitcoinClient

  constructor(tbtcContracts: TBTCContracts, bitcoinClient: BitcoinClient) {
    this.tbtcContracts = tbtcContracts
    this.bitcoinClient = bitcoinClient
  }

  /**
   * Initiates a new deposit for the given depositor and Bitcoin recovery address.
   * @param depositor Identifier of the depositor specific for the target chain
   *                  deposited BTC are bridged to. For example, this is a
   *                  20-byte address on Ethereum.
   * @param bitcoinRecoveryAddress P2PKH or P2WPKH Bitcoin address that can
   *                               be used for emergency recovery of the
   *                               deposited funds.
   * @returns Handle to the initiated deposit.
   */
  // TODO: Accept depositor as string and automatically validate & convert OR
  //       explore the possibility of fetching this from the account instance.
  // TODO: Cover with unit tests.
  async initiateDeposit(
    depositor: ChainIdentifier,
    bitcoinRecoveryAddress: string
  ): Promise<Deposit> {
    const receipt = await this.generateDepositReceipt(
      depositor,
      bitcoinRecoveryAddress
    )

    return Deposit.fromReceipt(receipt, this.tbtcContracts, this.bitcoinClient)
  }

  private async generateDepositReceipt(
    depositor: ChainIdentifier,
    bitcoinRecoveryAddress: string
  ): Promise<DepositReceipt> {
    const blindingFactor = crypto.randomBytes(8).toString("hex")

    const walletPublicKey =
      await this.tbtcContracts.bridge.activeWalletPublicKey()

    if (!walletPublicKey) {
      throw new Error("Could not get active wallet public key")
    }

    const walletPublicKeyHash = BitcoinHashUtils.computeHash160(walletPublicKey)

    // TODO: Only P2(W)PKH addresses can be used for recovery. The below conversion
    //       function ensures that but it would be good to check it here as well
    //       in case the converter implementation changes.
    const refundPublicKeyHash = BitcoinAddressConverter.addressToPublicKeyHash(
      bitcoinRecoveryAddress
    )

    const currentTimestamp = Math.floor(new Date().getTime() / 1000)

    const refundLocktime = BitcoinLocktimeUtils.calculateLocktime(
      currentTimestamp,
      this.depositRefundLocktimeDuration
    )

    return {
      depositor,
      blindingFactor,
      walletPublicKeyHash,
      refundPublicKeyHash,
      refundLocktime,
    }
  }
}
