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

  latestBlockHeight(): Promise<number> {
    return new Promise<number>((resolve, _) => {
      resolve(0)
    })
  }

  getHeadersChain(blockHeight: number, confirmations: number): Promise<string> {
    return new Promise<string>((resolve, _) => {
      resolve("")
    })
  }

  getTransactionMerkle(
    txHash: string,
    blockHeight: number
  ): Promise<TransactionMerkleBranch> {
    return new Promise<TransactionMerkleBranch>((resolve, _) => {
      resolve({
        blockHeight: 0,
        merkle: [],
        position: 0,
      })
    })
  }

  broadcast(transaction: RawTransaction): Promise<void> {
    this._broadcastLog.push(transaction)
    return new Promise<void>((resolve, _) => {
      resolve()
    })
  }
}
