import {
  BitcoinNetwork,
  Client,
  UnspentTransactionOutput,
  TransactionMerkleBranch,
  RawTransaction,
  Transaction,
  TransactionHash,
} from "../../src/lib/bitcoin"

/**
 * Mock Bitcoin client used for test purposes.
 */
export class MockBitcoinClient implements Client {
  private _unspentTransactionOutputs = new Map<
    string,
    UnspentTransactionOutput[]
  >()
  private _rawTransactions = new Map<string, RawTransaction>()
  private _transactions = new Map<string, Transaction>()
  private _confirmations = new Map<string, number>()
  private _latestHeight = 0
  private _headersChain = ""
  private _transactionMerkle: TransactionMerkleBranch = {
    blockHeight: 0,
    merkle: [],
    position: 0,
  }
  private _broadcastLog: RawTransaction[] = []
  private _transactionHistory = new Map<string, Transaction[]>()

  set unspentTransactionOutputs(
    value: Map<string, UnspentTransactionOutput[]>
  ) {
    this._unspentTransactionOutputs = value
  }

  set rawTransactions(value: Map<string, RawTransaction>) {
    this._rawTransactions = value
  }

  set transactions(value: Map<string, Transaction>) {
    this._transactions = value
  }

  set confirmations(value: Map<string, number>) {
    this._confirmations = value
  }

  set latestHeight(value: number) {
    this._latestHeight = value
  }

  set headersChain(value: string) {
    this._headersChain = value
  }

  set transactionMerkle(value: TransactionMerkleBranch) {
    this._transactionMerkle = value
  }

  set transactionHistory(value: Map<string, Transaction[]>) {
    this._transactionHistory = value
  }

  get broadcastLog(): RawTransaction[] {
    return this._broadcastLog
  }

  getNetwork(): Promise<BitcoinNetwork> {
    return new Promise<BitcoinNetwork>((resolve, _) => {
      resolve(BitcoinNetwork.Testnet)
    })
  }

  findAllUnspentTransactionOutputs(
    address: string
  ): Promise<UnspentTransactionOutput[]> {
    return new Promise<UnspentTransactionOutput[]>((resolve, _) => {
      resolve(
        this._unspentTransactionOutputs.get(
          address
        ) as UnspentTransactionOutput[]
      )
    })
  }

  getTransactionHistory(
    address: string,
    limit?: number
  ): Promise<Transaction[]> {
    return new Promise<Transaction[]>((resolve, _) => {
      let transactions = this._transactionHistory.get(address) as Transaction[]

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

  getTransaction(transactionHash: TransactionHash): Promise<Transaction> {
    return new Promise<Transaction>((resolve, _) => {
      resolve(this._transactions.get(transactionHash.toString()) as Transaction)
    })
  }

  getRawTransaction(transactionHash: TransactionHash): Promise<RawTransaction> {
    return new Promise<RawTransaction>((resolve, _) => {
      resolve(
        this._rawTransactions.get(transactionHash.toString()) as RawTransaction
      )
    })
  }

  getTransactionConfirmations(
    transactionHash: TransactionHash
  ): Promise<number> {
    return new Promise<number>((resolve, _) => {
      resolve(this._confirmations.get(transactionHash.toString()) as number)
    })
  }

  latestBlockHeight(): Promise<number> {
    return new Promise<number>((resolve, _) => {
      resolve(this._latestHeight)
    })
  }

  getHeadersChain(blockHeight: number, chainLength: number): Promise<string> {
    return new Promise<string>((resolve, _) => {
      resolve(this._headersChain)
    })
  }

  getTransactionMerkle(
    transactionHash: TransactionHash,
    blockHeight: number
  ): Promise<TransactionMerkleBranch> {
    return new Promise<TransactionMerkleBranch>((resolve, _) => {
      resolve(this._transactionMerkle)
    })
  }

  broadcast(transaction: RawTransaction): Promise<void> {
    this._broadcastLog.push(transaction)
    return new Promise<void>((resolve, _) => {
      resolve()
    })
  }
}
