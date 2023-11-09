import { ethers } from "ethers"
import {
  Account,
  WalletAPIClient,
  WindowMessageTransport,
} from "@ledgerhq/wallet-api-client"
import BigNumber from "bignumber.js"
import { Hex } from "../../utils"
import { AddressZero } from "@ethersproject/constants"
import { Deferrable } from "@ethersproject/properties"
import { getWalletAPIClient, getWindowMessageTransport } from "."
import { Signer } from "@ethersproject/abstract-signer"

// TODO: Investigate why it works with `Signer` from
// `@ethersproject/abstract-signer` and not the one from `ethers` lib.
export class LedgerLiveAppEthereumSigner extends Signer {
  private _walletApiClient: WalletAPIClient
  private _windowMessageTransport: WindowMessageTransport
  private _account: Account | undefined

  constructor(provider: ethers.providers.Provider) {
    super()
    ethers.utils.defineReadOnly(this, "provider", provider || null)
    this._windowMessageTransport = getWindowMessageTransport()
    this._walletApiClient = getWalletAPIClient(this._windowMessageTransport)
  }

  get account() {
    return this._account
  }

  setAccount(account: Account | undefined): void {
    this._account = account
  }

  async requestAccount(
    params: { currencyIds?: string[] | undefined } | undefined
  ): Promise<Account> {
    this._windowMessageTransport.connect()
    const account = await this._walletApiClient.account.request(params)
    this._windowMessageTransport.disconnect()
    this._account = account
    return this._account
  }

  getAccountId(): string {
    if (!this._account || !this._account.id) {
      throw new Error(
        "Account not found. Please use `requestAccount` method first."
      )
    }
    return this._account.id
  }

  async getAddress(): Promise<string> {
    if (!this._account || !this._account.address) {
      throw new Error(
        "Account not found. Please use `requestAccount` method first."
      )
    }
    return this._account.address
  }

  async signMessage(message: string): Promise<string> {
    if (!this._account || !this._account.address) {
      throw new Error(
        "Account not found. Please use `requestAccount` method first."
      )
    }
    this._windowMessageTransport.connect()
    const buffer = await this._walletApiClient.message.sign(
      this._account.id,
      Buffer.from(message)
    )
    this._windowMessageTransport.disconnect()
    return buffer.toString()
  }

  async signTransaction(
    transaction: ethers.providers.TransactionRequest
  ): Promise<string> {
    if (!this._account || !this._account.address) {
      throw new Error(
        "Account not found. Please use `requestAccount` method first."
      )
    }

    const { value, to, nonce, data, gasPrice, gasLimit } = transaction

    const ethereumTransaction: any = {
      family: "ethereum" as const,
      amount: value ? new BigNumber(value.toString()) : new BigNumber(0),
      recipient: to ? to : AddressZero,
    }

    if (nonce) ethereumTransaction.nonce = nonce
    if (data)
      ethereumTransaction.data = Buffer.from(
        Hex.from(data.toString()).toString(),
        "hex"
      )
    if (gasPrice)
      ethereumTransaction.gasPrice = new BigNumber(gasPrice.toString())
    if (gasLimit)
      ethereumTransaction.gasLimit = new BigNumber(gasLimit.toString())

    this._windowMessageTransport.connect()
    const buffer = await this._walletApiClient.transaction.sign(
      this._account.id,
      ethereumTransaction
    )
    this._windowMessageTransport.disconnect()
    return buffer.toString()
  }

  async sendTransaction(
    transaction: Deferrable<ethers.providers.TransactionRequest>
  ): Promise<ethers.providers.TransactionResponse> {
    if (!this._account || !this._account.address) {
      throw new Error(
        "Account not found. Please use `requestAccount` method first."
      )
    }

    const { value, to, nonce, data, gasPrice, gasLimit } = transaction

    const ethereumTransaction: any = {
      family: "ethereum" as const,
      amount: value ? new BigNumber(value.toString()) : new BigNumber(0),
      recipient: to ? to : AddressZero,
    }

    if (nonce) ethereumTransaction.nonce = nonce
    if (data)
      ethereumTransaction.data = Buffer.from(
        Hex.from(data.toString()).toString(),
        "hex"
      )
    if (gasPrice)
      ethereumTransaction.gasPrice = new BigNumber(gasPrice.toString())
    if (gasLimit)
      ethereumTransaction.gasLimit = new BigNumber(gasLimit.toString())

    this._windowMessageTransport.connect()
    const transactionHash =
      await this._walletApiClient.transaction.signAndBroadcast(
        this._account.id,
        ethereumTransaction
      )
    this._windowMessageTransport.disconnect()

    const transactionResponse = await this.provider?.getTransaction(
      transactionHash
    )

    if (!transactionResponse) {
      throw new Error("Transaction response not found!")
    }

    return transactionResponse
  }

  connect(provider: ethers.providers.Provider): Signer {
    return new LedgerLiveAppEthereumSigner(provider)
  }
}
