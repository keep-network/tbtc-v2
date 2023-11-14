import { ethers, Signer } from "ethers"
import {
  Account,
  EthereumTransaction,
  WalletAPIClient,
  WindowMessageTransport,
} from "@ledgerhq/wallet-api-client"
import { AddressZero } from "@ethersproject/constants"
import { Deferrable } from "@ethersproject/properties"
import { Hex } from "./hex"
import BigNumber from "bignumber.js"

class AccountNotFoundError extends Error {
  constructor() {
    super(
      "Account not found. Please use `requestAccount` method or set the signer account with `setAccount` method."
    )
  }
}

/**
 * Ethereum signer extended from `ethers` Signer class. The main purpose of it
 * is to allow the user to communicate with eth contracts through our tBTC SDK
 * inside Ledger Live application, when the app is used there as a Live App.
 */
export class LedgerLiveEthereumSigner extends Signer {
  private _walletApiClient: WalletAPIClient
  private _windowMessageTransport: WindowMessageTransport
  private _account: Account | undefined

  constructor(provider?: ethers.providers.Provider) {
    super()
    ethers.utils.defineReadOnly(this, "provider", provider)
    this._windowMessageTransport = getWindowMessageTransport()
    this._walletApiClient = getWalletAPIClient(this._windowMessageTransport)
  }

  private _checkAccount(): void {
    if (!this._account || !this._account.id) {
      throw new AccountNotFoundError()
    }
  }

  private _checkProviderAndAccount(): void {
    this._checkProvider()
    this._checkAccount()
  }

  private _catchWalletApiError(error?: any, defaultErrorMessage?: string) {
    this._windowMessageTransport.disconnect()

    if (typeof error === "string" || error instanceof Error) {
      throw new Error(error.toString())
    }
    throw new Error(
      defaultErrorMessage ||
        "Something went wrong when using ledger live singer to interact with out wallet."
    )
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
    let account
    try {
      this._windowMessageTransport.connect()
      account = await this._walletApiClient.account.request(params)
      this._windowMessageTransport.disconnect()
    } catch (err) {
      this._catchWalletApiError(
        err,
        "Something went wrong when requesting an account with ledger live signer!"
      )
    }

    this._account = account!
    return this._account
  }

  getAccountId(): string {
    this._checkAccount()
    return this._account!.id
  }

  async getAddress(): Promise<string> {
    this._checkAccount()
    return this._account!.address
  }

  private _getWalletApiEthereumTransaction(
    transaction: ethers.providers.TransactionRequest
  ): EthereumTransaction {
    const {
      value,
      to,
      nonce,
      data,
      gasPrice,
      gasLimit,
      maxFeePerGas,
      maxPriorityFeePerGas,
    } = transaction

    const ethereumTransaction: EthereumTransaction = {
      family: "ethereum" as const,
      amount: value ? new BigNumber(value.toString()) : new BigNumber(0),
      recipient: to ? to : AddressZero,
    }

    if (nonce) ethereumTransaction.nonce = Number(nonce)
    if (data)
      ethereumTransaction.data = Buffer.from(
        Hex.from(data.toString()).toString(),
        "hex"
      )
    if (gasPrice)
      ethereumTransaction.gasPrice = new BigNumber(gasPrice.toString())
    if (gasLimit)
      ethereumTransaction.gasLimit = new BigNumber(gasLimit.toString())
    if (maxFeePerGas)
      ethereumTransaction.maxFeePerGas = new BigNumber(maxFeePerGas.toString())
    if (maxPriorityFeePerGas)
      ethereumTransaction.maxPriorityFeePerGas = new BigNumber(
        maxPriorityFeePerGas.toString()
      )

    return ethereumTransaction
  }

  async signMessage(message: string): Promise<string> {
    this._checkAccount()

    let buffer: Buffer
    try {
      this._windowMessageTransport.connect()
      buffer = await this._walletApiClient.message.sign(
        this._account!.id,
        Buffer.from(message)
      )
      this._windowMessageTransport.disconnect()
    } catch (err) {
      this._catchWalletApiError(
        err,
        "Something went wrong when signing a message with ledger live signer!"
      )
    }

    return buffer!.toString()
  }

  async signTransaction(
    transaction: ethers.providers.TransactionRequest
  ): Promise<string> {
    this._checkAccount()

    const ethereumTransaction =
      this._getWalletApiEthereumTransaction(transaction)

    let buffer: Buffer
    try {
      this._windowMessageTransport.connect()
      buffer = await this._walletApiClient.transaction.sign(
        this._account!.id,
        ethereumTransaction
      )
      this._windowMessageTransport.disconnect()
    } catch (err) {
      this._catchWalletApiError(
        err,
        "Something went wrong when signing a transaction with ledger live signer!"
      )
    }

    return buffer!.toString()
  }

  async sendTransaction(
    transaction: Deferrable<ethers.providers.TransactionRequest>
  ): Promise<ethers.providers.TransactionResponse> {
    this._checkProviderAndAccount()

    const pupulatedTransaction = await this.populateTransaction(transaction)
    const ethereumTransaction =
      this._getWalletApiEthereumTransaction(pupulatedTransaction)

    let transactionHash: string
    try {
      this._windowMessageTransport.connect()
      transactionHash =
        await this._walletApiClient.transaction.signAndBroadcast(
          this._account!.id,
          ethereumTransaction
        )
      this._windowMessageTransport.disconnect()
    } catch (err) {
      this._catchWalletApiError(
        err,
        "Something went wrong when sending a transaction with ledger live signer!"
      )
    }

    const transactionResponse = await this.provider?.getTransaction(
      transactionHash!
    )

    if (!transactionResponse) {
      throw new Error("Transaction response not found!")
    }

    return transactionResponse
  }

  connect(provider: ethers.providers.Provider): Signer {
    const account = this._account
    const newLedgerLiveEthereumSignerInstance = new LedgerLiveEthereumSigner(
      provider
    )
    newLedgerLiveEthereumSignerInstance.setAccount(account)
    return newLedgerLiveEthereumSignerInstance
  }
}

const getWindowMessageTransport = () => {
  return new WindowMessageTransport()
}

const getWalletAPIClient = (windowMessageTransport: WindowMessageTransport) => {
  const walletApiClient = new WalletAPIClient(windowMessageTransport)

  return walletApiClient
}
