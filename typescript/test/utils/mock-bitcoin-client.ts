import {
  BitcoinNetwork,
  BitcoinClient,
  BitcoinUtxo,
  BitcoinTxMerkleBranch,
  BitcoinRawTx,
  BitcoinTx,
  BitcoinTxHash,
} from "../../src/lib/bitcoin"
import { Hex } from "../../src/lib/utils"

/**
 * Mock Bitcoin client used for test purposes.
 */
export class MockBitcoinClient implements BitcoinClient {
  private _unspentTransactionOutputs = new Map<string, BitcoinUtxo[]>()
  private _rawTransactions = new Map<string, BitcoinRawTx>()
  private _transactions = new Map<string, BitcoinTx>()
  private _confirmations = new Map<string, number>()
  private _transactionHashes = new Map<string, BitcoinTxHash[]>()
  private _latestHeight = 0
  private _headersChain = Hex.from("")
  private _transactionMerkle: BitcoinTxMerkleBranch = {
    blockHeight: 0,
    merkle: [],
    position: 0,
  }
  private _broadcastLog: BitcoinRawTx[] = []
  private _transactionHistory = new Map<string, BitcoinTx[]>()

  set unspentTransactionOutputs(value: Map<string, BitcoinUtxo[]>) {
    this._unspentTransactionOutputs = value
  }

  set rawTransactions(value: Map<string, BitcoinRawTx>) {
    this._rawTransactions = value
  }

  set transactions(value: Map<string, BitcoinTx>) {
    this._transactions = value
  }

  set confirmations(value: Map<string, number>) {
    this._confirmations = value
  }

  set transactionHashes(value: Map<string, BitcoinTxHash[]>) {
    this._transactionHashes = value
  }

  set latestHeight(value: number) {
    this._latestHeight = value
  }

  set headersChain(value: Hex) {
    this._headersChain = value
  }

  set transactionMerkle(value: BitcoinTxMerkleBranch) {
    this._transactionMerkle = value
  }

  set transactionHistory(value: Map<string, BitcoinTx[]>) {
    this._transactionHistory = value
  }

  get broadcastLog(): BitcoinRawTx[] {
    return this._broadcastLog
  }

  getNetwork(): Promise<BitcoinNetwork> {
    return new Promise<BitcoinNetwork>((resolve, _) => {
      resolve(BitcoinNetwork.Testnet)
    })
  }

  findAllUnspentTransactionOutputs(address: string): Promise<BitcoinUtxo[]> {
    return new Promise<BitcoinUtxo[]>((resolve, _) => {
      resolve(this._unspentTransactionOutputs.get(address) as BitcoinUtxo[])
    })
  }

  getTransactionHistory(address: string, limit?: number): Promise<BitcoinTx[]> {
    return new Promise<BitcoinTx[]>((resolve, _) => {
      let transactions = this._transactionHistory.get(address) as BitcoinTx[]

      if (
        typeof limit !== "undefined" &&
        limit > 0 &&
        transactions.length > limit
      ) {
        transactions = transactions.slice(-limit)
      }

      resolve(transactions)
    })
  }

  getTransaction(transactionHash: BitcoinTxHash): Promise<BitcoinTx> {
    return new Promise<BitcoinTx>((resolve, _) => {
      resolve(this._transactions.get(transactionHash.toString()) as BitcoinTx)
    })
  }

  getRawTransaction(transactionHash: BitcoinTxHash): Promise<BitcoinRawTx> {
    return new Promise<BitcoinRawTx>((resolve, _) => {
      resolve(
        this._rawTransactions.get(transactionHash.toString()) as BitcoinRawTx
      )
    })
  }

  getTransactionConfirmations(transactionHash: BitcoinTxHash): Promise<number> {
    return new Promise<number>((resolve, _) => {
      resolve(this._confirmations.get(transactionHash.toString()) as number)
    })
  }

  getTxHashesForPublicKeyHash(publicKeyHash: Hex): Promise<BitcoinTxHash[]> {
    return new Promise<BitcoinTxHash[]>((resolve, _) => {
      const hashes = this._transactionHashes.get(publicKeyHash.toString())
      if (hashes) {
        resolve(hashes)
      } else {
        resolve([])
      }
    })
  }

  latestBlockHeight(): Promise<number> {
    return new Promise<number>((resolve, _) => {
      resolve(this._latestHeight)
    })
  }

  getHeadersChain(blockHeight: number, chainLength: number): Promise<Hex> {
    return new Promise<Hex>((resolve, _) => {
      resolve(this._headersChain)
    })
  }

  getTransactionMerkle(
    transactionHash: BitcoinTxHash,
    blockHeight: number
  ): Promise<BitcoinTxMerkleBranch> {
    return new Promise<BitcoinTxMerkleBranch>((resolve, _) => {
      resolve(this._transactionMerkle)
    })
  }

  broadcast(transaction: BitcoinRawTx): Promise<void> {
    this._broadcastLog.push(transaction)
    return new Promise<void>((resolve, _) => {
      resolve()
    })
  }
}
