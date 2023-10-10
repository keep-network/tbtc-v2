import {
  RedemptionRequest,
  TBTCContracts,
  WalletState,
} from "../../lib/contracts"
import {
  BitcoinAddressConverter,
  BitcoinClient,
  BitcoinNetwork,
  BitcoinTxOutput,
  BitcoinUtxo,
} from "../../lib/bitcoin"
import { BigNumber } from "ethers"
import { Hex } from "../../lib/utils"

/**
 * Service exposing features related to tBTC v2 redemptions.
 */
export class RedemptionsService {
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
   * Requests a redemption of TBTC v2 token into BTC.
   * @param bitcoinRedeemerAddress Bitcoin address redeemed BTC should be
   *                               sent to. Only P2PKH, P2WPKH, P2SH, and P2WSH
   *                               address types are supported.
   * @param amount The amount to be redeemed with the precision of the tBTC
   *        on-chain token contract.
   * @returns Object containing:
   *          - Target chain hash of the request redemption transaction
   *            (for example, Ethereum transaction hash)
   *          - Bitcoin public key of the wallet asked to handle the redemption.
   *            Presented in the compressed form (33 bytes long with 02 or 03 prefix).
   */
  async requestRedemption(
    bitcoinRedeemerAddress: string,
    amount: BigNumber
  ): Promise<{
    targetChainTxHash: Hex
    walletPublicKey: string
  }> {
    const bitcoinNetwork = await this.bitcoinClient.getNetwork()

    const redeemerOutputScript = BitcoinAddressConverter.addressToOutputScript(
      bitcoinRedeemerAddress,
      bitcoinNetwork
    ).toString()

    // TODO: Validate the given script is supported for redemption.

    const { walletPublicKey, mainUtxo } = await this.findWalletForRedemption(
      redeemerOutputScript,
      amount
    )

    const txHash = await this.tbtcContracts.tbtcToken.requestRedemption(
      walletPublicKey,
      mainUtxo,
      redeemerOutputScript,
      amount
    )

    return {
      targetChainTxHash: txHash,
      walletPublicKey,
    }
  }

  /**
   * Finds the oldest live wallet that has enough BTC to handle a redemption
   * request.
   * @param redeemerOutputScript The redeemer output script the redeemed funds are
   *        supposed to be locked on. Must be un-prefixed and not prepended with
   *        length.
   * @param amount The amount to be redeemed in satoshis.
   * @returns Promise with the wallet details needed to request a redemption.
   */
  protected async findWalletForRedemption(
    redeemerOutputScript: string,
    amount: BigNumber
  ): Promise<{
    walletPublicKey: string
    mainUtxo: BitcoinUtxo
  }> {
    const wallets =
      await this.tbtcContracts.bridge.getNewWalletRegisteredEvents()

    let walletData:
      | {
          walletPublicKey: string
          mainUtxo: BitcoinUtxo
        }
      | undefined = undefined
    let maxAmount = BigNumber.from(0)
    let liveWalletsCounter = 0

    const bitcoinNetwork = await this.bitcoinClient.getNetwork()

    for (const wallet of wallets) {
      const { walletPublicKeyHash } = wallet
      const { state, walletPublicKey, pendingRedemptionsValue } =
        await this.tbtcContracts.bridge.wallets(walletPublicKeyHash)

      // Wallet must be in Live state.
      if (state !== WalletState.Live) {
        console.debug(
          `Wallet is not in Live state ` +
            `(wallet public key hash: ${walletPublicKeyHash.toString()}). ` +
            `Continue the loop execution to the next wallet...`
        )
        continue
      }
      liveWalletsCounter++

      // Wallet must have a main UTXO that can be determined.
      const mainUtxo = await this.determineWalletMainUtxo(
        walletPublicKeyHash,
        bitcoinNetwork
      )
      if (!mainUtxo) {
        console.debug(
          `Could not find matching UTXO on chains ` +
            `for wallet public key hash (${walletPublicKeyHash.toString()}). ` +
            `Continue the loop execution to the next wallet...`
        )
        continue
      }

      const pendingRedemption =
        await this.tbtcContracts.bridge.pendingRedemptions(
          walletPublicKey.toString(),
          redeemerOutputScript
        )

      if (pendingRedemption.requestedAt != 0) {
        console.debug(
          `There is a pending redemption request from this wallet to the ` +
            `same Bitcoin address. Given wallet public key hash` +
            `(${walletPublicKeyHash.toString()}) and redeemer output script ` +
            `(${redeemerOutputScript}) pair can be used for only one ` +
            `pending request at the same time. ` +
            `Continue the loop execution to the next wallet...`
        )
        continue
      }

      const walletBTCBalance = mainUtxo.value.sub(pendingRedemptionsValue)

      // Save the max possible redemption amount.
      maxAmount = walletBTCBalance.gt(maxAmount) ? walletBTCBalance : maxAmount

      if (walletBTCBalance.gte(amount)) {
        walletData = {
          walletPublicKey: walletPublicKey.toString(),
          mainUtxo,
        }

        break
      }

      console.debug(
        `The wallet (${walletPublicKeyHash.toString()})` +
          `cannot handle the redemption request. ` +
          `Continue the loop execution to the next wallet...`
      )
    }

    if (liveWalletsCounter === 0) {
      throw new Error("Currently, there are no live wallets in the network.")
    }

    // Cover a corner case when the user requested redemption for all live wallets
    // in the network using the same Bitcoin address.
    if (!walletData && liveWalletsCounter > 0 && maxAmount.eq(0)) {
      throw new Error(
        "All live wallets in the network have the pending redemption for a given Bitcoin address. " +
          "Please use another Bitcoin address."
      )
    }

    if (!walletData)
      throw new Error(
        `Could not find a wallet with enough funds. Maximum redemption amount is ${maxAmount} Satoshi.`
      )

    return walletData
  }

  /**
   * Determines the plain-text wallet main UTXO currently registered in the
   * Bridge on-chain contract. The returned main UTXO can be undefined if the
   * wallet does not have a main UTXO registered in the Bridge at the moment.
   *
   * WARNING: THIS FUNCTION CANNOT DETERMINE THE MAIN UTXO IF IT COMES FROM A
   * BITCOIN TRANSACTION THAT IS NOT ONE OF THE LATEST FIVE TRANSACTIONS
   * TARGETING THE GIVEN WALLET PUBLIC KEY HASH. HOWEVER, SUCH A CASE IS
   * VERY UNLIKELY.
   *
   * @param walletPublicKeyHash - Public key hash of the wallet.
   * @param bitcoinNetwork - Bitcoin network.
   * @returns Promise holding the wallet main UTXO or undefined value.
   */
  protected async determineWalletMainUtxo(
    walletPublicKeyHash: Hex,
    bitcoinNetwork: BitcoinNetwork
  ): Promise<BitcoinUtxo | undefined> {
    const { mainUtxoHash } = await this.tbtcContracts.bridge.wallets(
      walletPublicKeyHash
    )

    // Valid case when the wallet doesn't have a main UTXO registered into
    // the Bridge.
    if (
      mainUtxoHash.equals(
        Hex.from(
          "0x0000000000000000000000000000000000000000000000000000000000000000"
        )
      )
    ) {
      return undefined
    }

    // Declare a helper function that will try to determine the main UTXO for
    // the given wallet address type.
    const determine = async (
      witnessAddress: boolean
    ): Promise<BitcoinUtxo | undefined> => {
      // Build the wallet Bitcoin address based on its public key hash.
      const walletAddress = BitcoinAddressConverter.publicKeyHashToAddress(
        walletPublicKeyHash.toString(),
        witnessAddress,
        bitcoinNetwork
      )

      // Get the wallet transaction history. The wallet main UTXO registered in the
      // Bridge almost always comes from the latest BTC transaction made by the wallet.
      // However, there may be cases where the BTC transaction was made but their
      // SPV proof is not yet submitted to the Bridge thus the registered main UTXO
      // points to the second last BTC transaction. In theory, such a gap between
      // the actual latest BTC transaction and the registered main UTXO in the
      // Bridge may be even wider. The exact behavior is a wallet implementation
      // detail and not a protocol invariant so, it may be subject of changes.
      // To cover the worst possible cases, we always take the five latest
      // transactions made by the wallet for consideration.
      const walletTransactions = await this.bitcoinClient.getTransactionHistory(
        walletAddress,
        5
      )

      // Get the wallet script based on the wallet address. This is required
      // to find transaction outputs that lock funds on the wallet.
      const walletScript = BitcoinAddressConverter.addressToOutputScript(
        walletAddress,
        bitcoinNetwork
      )
      const isWalletOutput = (output: BitcoinTxOutput) =>
        walletScript.equals(output.scriptPubKey)

      // Start iterating from the latest transaction as the chance it matches
      // the wallet main UTXO is the highest.
      for (let i = walletTransactions.length - 1; i >= 0; i--) {
        const walletTransaction = walletTransactions[i]

        // Find the output that locks the funds on the wallet. Only such an output
        // can be a wallet main UTXO.
        const outputIndex = walletTransaction.outputs.findIndex(isWalletOutput)

        // Should never happen as all transactions come from wallet history. Just
        // in case check whether the wallet output was actually found.
        if (outputIndex < 0) {
          console.error(
            `wallet output for transaction ${walletTransaction.transactionHash.toString()} not found`
          )
          continue
        }

        // Build a candidate UTXO instance based on the detected output.
        const utxo: BitcoinUtxo = {
          transactionHash: walletTransaction.transactionHash,
          outputIndex: outputIndex,
          value: walletTransaction.outputs[outputIndex].value,
        }

        // Check whether the candidate UTXO hash matches the main UTXO hash stored
        // on the Bridge.
        if (
          mainUtxoHash.equals(this.tbtcContracts.bridge.buildUtxoHash(utxo))
        ) {
          return utxo
        }
      }

      return undefined
    }

    // The most common case is that the wallet uses a witness address for all
    // operations. Try to determine the main UTXO for that address first as the
    // chance for success is the highest here.
    const mainUtxo = await determine(true)

    // In case the main UTXO was not found for witness address, there is still
    // a chance it exists for the legacy wallet address.
    return mainUtxo ?? (await determine(false))
  }

  /**
   * Gets data of a registered redemption request from the Bridge contract.
   * @param bitcoinRedeemerAddress Bitcoin redeemer address used to request
   *                               the redemption.
   * @param walletPublicKey Bitcoin public key of the wallet handling the
   *                        redemption. Must be in the compressed form
   *                        (33 bytes long with 02 or 03 prefix).
   * @param type Type of redemption requests the function will look for. Can be
   *        either `pending` or `timedOut`. By default, `pending` is used.
   * @returns Matching redemption requests.
   * @throws Throws an error if no redemption request exists for the given
   *         input parameters.
   */
  async getRedemptionRequests(
    bitcoinRedeemerAddress: string,
    walletPublicKey: string,
    type: "pending" | "timedOut" = "pending"
  ): Promise<RedemptionRequest> {
    const bitcoinNetwork = await this.bitcoinClient.getNetwork()

    const redeemerOutputScript = BitcoinAddressConverter.addressToOutputScript(
      bitcoinRedeemerAddress,
      bitcoinNetwork
    ).toString()

    let redemptionRequest: RedemptionRequest | undefined = undefined

    switch (type) {
      case "pending": {
        redemptionRequest = await this.tbtcContracts.bridge.pendingRedemptions(
          walletPublicKey,
          redeemerOutputScript
        )
        break
      }
      case "timedOut": {
        redemptionRequest = await this.tbtcContracts.bridge.timedOutRedemptions(
          walletPublicKey,
          redeemerOutputScript
        )
        break
      }
      default: {
        throw new Error("Unsupported redemption request type")
      }
    }

    if (!redemptionRequest || redemptionRequest.requestedAt == 0) {
      throw new Error("Redemption request does not exist")
    }

    return redemptionRequest
  }
}
