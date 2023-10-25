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
  BitcoinScriptUtils,
} from "../../lib/bitcoin"
import { Hex } from "../../lib/utils"
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
  /**
   * Chain-specific identifier of the default depositor used for deposits
   * initiated by this service.
   */
  private defaultDepositor: ChainIdentifier | undefined

  constructor(tbtcContracts: TBTCContracts, bitcoinClient: BitcoinClient) {
    this.tbtcContracts = tbtcContracts
    this.bitcoinClient = bitcoinClient
  }

  /**
   * Initiates the tBTC v2 deposit process.
   * @param bitcoinRecoveryAddress P2PKH or P2WPKH Bitcoin address that can
   *                               be used for emergency recovery of the
   *                               deposited funds.
   * @returns Handle to the initiated deposit process.
   * @throws Throws an error if one of the following occurs:
   *         - The default depositor is not set
   *         - There are no active wallet in the Bridge contract
   *         - The Bitcoin recovery address is not a valid P2(W)PKH
   */
  // TODO: Cover with unit tests.
  async initiateDeposit(bitcoinRecoveryAddress: string): Promise<Deposit> {
    const receipt = await this.generateDepositReceipt(bitcoinRecoveryAddress)
    return Deposit.fromReceipt(receipt, this.tbtcContracts, this.bitcoinClient)
  }

  private async generateDepositReceipt(
    bitcoinRecoveryAddress: string
  ): Promise<DepositReceipt> {
    if (this.defaultDepositor === undefined) {
      throw new Error(
        "Default depositor is not set; use setDefaultDepositor first"
      )
    }

    const blindingFactor = Hex.from(crypto.randomBytes(8))

    const walletPublicKey =
      await this.tbtcContracts.bridge.activeWalletPublicKey()

    if (!walletPublicKey) {
      throw new Error("Could not get active wallet public key")
    }

    const walletPublicKeyHash = BitcoinHashUtils.computeHash160(walletPublicKey)

    const bitcoinNetwork = await this.bitcoinClient.getNetwork()

    const recoveryOutputScript = BitcoinAddressConverter.addressToOutputScript(
      bitcoinRecoveryAddress,
      bitcoinNetwork
    )
    if (
      !BitcoinScriptUtils.isP2PKHScript(recoveryOutputScript) &&
      !BitcoinScriptUtils.isP2WPKHScript(recoveryOutputScript)
    ) {
      throw new Error("Bitcoin recovery address must be P2PKH or P2WPKH")
    }

    const refundPublicKeyHash = BitcoinAddressConverter.addressToPublicKeyHash(
      bitcoinRecoveryAddress,
      bitcoinNetwork
    )

    const currentTimestamp = Math.floor(new Date().getTime() / 1000)

    const refundLocktime = BitcoinLocktimeUtils.calculateLocktime(
      currentTimestamp,
      this.depositRefundLocktimeDuration
    )

    return {
      depositor: this.defaultDepositor,
      blindingFactor,
      walletPublicKeyHash,
      refundPublicKeyHash,
      refundLocktime,
    }
  }

  // eslint-disable-next-line valid-jsdoc
  /**
   * Sets the default depositor used for deposits initiated by this service.
   * @param defaultDepositor Chain-specific identifier of the default depositor.
   * @dev Typically, there is no need to use this method when DepositsService
   *      is orchestrated automatically. However, there are some use cases
   *      where setting the default depositor explicitly may be useful.
   *      Make sure you know what you are doing while using this method.
   */
  setDefaultDepositor(defaultDepositor: ChainIdentifier) {
    this.defaultDepositor = defaultDepositor
  }
}
