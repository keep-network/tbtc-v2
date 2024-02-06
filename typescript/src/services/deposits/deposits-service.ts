import {
  ChainIdentifier,
  DepositorProxy,
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
   * @param extraData Optional 32-byte extra data to be included in the
   *                  deposit script. Cannot be equal to 32 zero bytes.
   * @returns Handle to the initiated deposit process.
   * @throws Throws an error if one of the following occurs:
   *         - The default depositor is not set
   *         - There are no active wallet in the Bridge contract
   *         - The Bitcoin recovery address is not a valid P2(W)PKH
   *         - The optional extra data is set but is not 32-byte or equals
   *           to 32 zero bytes.
   */
  async initiateDeposit(
    bitcoinRecoveryAddress: string,
    extraData?: Hex
  ): Promise<Deposit> {
    if (this.defaultDepositor === undefined) {
      throw new Error(
        "Default depositor is not set; use setDefaultDepositor first"
      )
    }

    const receipt = await this.generateDepositReceipt(
      bitcoinRecoveryAddress,
      this.defaultDepositor,
      extraData
    )

    return Deposit.fromReceipt(receipt, this.tbtcContracts, this.bitcoinClient)
  }

  /**
   * Initiates the tBTC v2 deposit process using a depositor proxy.
   * The depositor proxy initiates minting on behalf of the user (i.e. original
   * depositor) and receives minted TBTC. This allows the proxy to provide
   * additional services to the user, such as routing the minted TBTC tokens
   * to another protocols, in an automated way.
   * @see DepositorProxy
   * @param bitcoinRecoveryAddress P2PKH or P2WPKH Bitcoin address that can
   *                               be used for emergency recovery of the
   *                               deposited funds.
   * @param depositorProxy Depositor proxy used to initiate the deposit.
   * @param extraData Optional 32-byte extra data to be included in the
   *                  deposit script. Cannot be equal to 32 zero bytes.
   * @returns Handle to the initiated deposit process.
   * @throws Throws an error if one of the following occurs:
   *         - There are no active wallet in the Bridge contract
   *         - The Bitcoin recovery address is not a valid P2(W)PKH
   *         - The optional extra data is set but is not 32-byte or equals
   *           to 32 zero bytes.
   */
  async initiateDepositWithProxy(
    bitcoinRecoveryAddress: string,
    depositorProxy: DepositorProxy,
    extraData?: Hex
  ): Promise<Deposit> {
    const receipt = await this.generateDepositReceipt(
      bitcoinRecoveryAddress,
      depositorProxy.getChainIdentifier(),
      extraData
    )

    return Deposit.fromReceipt(
      receipt,
      this.tbtcContracts,
      this.bitcoinClient,
      depositorProxy
    )
  }

  private async generateDepositReceipt(
    bitcoinRecoveryAddress: string,
    depositor: ChainIdentifier,
    extraData?: Hex
  ): Promise<DepositReceipt> {
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

    // If optional extra data is provided, check if it is valid and fail
    // fast if not.
    if (typeof extraData !== "undefined") {
      // Check if extra data vector has a correct length of 32 bytes.
      if (extraData.toString().length != 64) {
        throw new Error("Extra data is not 32-byte")
      }
      // Check if extra data vector is non-zero. This is important because a
      // deposit with defined extra data is handled via a special flow of
      // the Bridge and this vector is expected to be non-zero.
      if (
        extraData.toPrefixedString() ===
        "0x0000000000000000000000000000000000000000000000000000000000000000"
      ) {
        throw new Error("Extra data contains only zero bytes")
      }
    }

    return {
      depositor,
      blindingFactor,
      walletPublicKeyHash,
      refundPublicKeyHash,
      refundLocktime,
      extraData,
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
