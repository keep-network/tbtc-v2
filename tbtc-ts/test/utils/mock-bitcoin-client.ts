import {
  Client,
  UnspentTransactionOutput,
  TransactionMerkleBranch,
  RawTransaction,
  Transaction,
} from "../../src/bitcoin"

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

  get broadcastLog(): RawTransaction[] {
    return this._broadcastLog
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

  getTransaction(transactionHash: string): Promise<Transaction> {
    return new Promise<Transaction>((resolve, _) => {
      resolve(this._transactions.get(transactionHash) as Transaction)
    })
  }

  getRawTransaction(transactionHash: string): Promise<RawTransaction> {
    return new Promise<RawTransaction>((resolve, _) => {
      resolve(this._rawTransactions.get(transactionHash) as RawTransaction)
    })
  }

  getTransactionConfirmations(transactionHash: string): Promise<number> {
    return new Promise<number>((resolve, _) => {
      resolve(this._confirmations.get(transactionHash) as number)
    })
  }

  latestBlockHeight(): Promise<number> {
    return new Promise<number>((resolve, _) => {
      resolve(this._latestHeight)
    })
  }

  getHeadersChain(blockHeight: number, confirmations: number): Promise<string> {
    return new Promise<string>((resolve, _) => {
      resolve(this._headersChain)
    })
  }

  getTransactionMerkle(
    txHash: string,
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
