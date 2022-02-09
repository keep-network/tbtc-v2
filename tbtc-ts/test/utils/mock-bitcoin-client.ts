import {
  Client,
  UnspentTransactionOutput,
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

  private _broadcastLog: RawTransaction[] = []

  set unspentTransactionOutputs(
    value: Map<string, UnspentTransactionOutput[]>
  ) {
    this._unspentTransactionOutputs = value
  }

  set rawTransactions(value: Map<string, RawTransaction>) {
    this._rawTransactions = value
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
    // Not implemented.
    return new Promise<Transaction>((resolve, _) => {})
  }

  getRawTransaction(transactionHash: string): Promise<RawTransaction> {
    return new Promise<RawTransaction>((resolve, _) => {
      resolve(this._rawTransactions.get(transactionHash) as RawTransaction)
    })
  }

  broadcast(transaction: RawTransaction): Promise<void> {
    this._broadcastLog.push(transaction)
    return new Promise<void>((resolve, _) => {
      resolve()
    })
  }
}
