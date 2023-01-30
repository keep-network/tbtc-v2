import bcoin from "bcoin"
import { BigNumber } from "ethers"
import { Deposit } from "../src/deposit"
import { submitDepositRefundTransaction } from "../src/deposit-refund"
import {
  RawTransaction,
  TransactionHash,
  Client as BitcoinClient,
  UnspentTransactionOutput,
  Transaction,
  TransactionMerkleBranch,
} from "../src/bitcoin"

class TestBitcoinClient implements BitcoinClient {
  private client: any

  constructor(host: string, port: number, username: string, password: string) {
    this.client = new bcoin.NodeClient({
      host: host,
      port: port,
      username: username,
      password: password,
    })
  }

  getTransactionConfirmations(
    transactionHash: TransactionHash
  ): Promise<number> {
    // Not implemented.
    return new Promise<number>((resolve, _) => {
      resolve(0)
    })
  }

  getTransactionMerkle(
    transactionHash: TransactionHash,
    blockHeight: number
  ): Promise<TransactionMerkleBranch> {
    // Not implemented.
    return new Promise<TransactionMerkleBranch>((resolve, _) => {})
  }

  async getRawTransaction(
    transactionHash: TransactionHash
  ): Promise<RawTransaction> {
    const rawTx = await this.client.execute("getrawtransaction", [
      transactionHash.toString(),
    ])
    return new Promise<RawTransaction>((resolve, _) => {
      resolve({ transactionHex: rawTx })
    })
  }

  async getRawMempool(): Promise<void> {
    // Not implemented.
    return new Promise<void>((resolve, _) => {
      resolve()
    })
  }

  findAllUnspentTransactionOutputs(
    address: string
  ): Promise<UnspentTransactionOutput[]> {
    // Not implemented.
    return new Promise<UnspentTransactionOutput[]>((resolve, _) => {
      return new Promise<number>((resolve, _) => {})
    })
  }

  getTransaction(transactionHash: TransactionHash): Promise<Transaction> {
    // Not implemented.
    return new Promise<Transaction>((resolve, _) => {})
  }

  latestBlockHeight(): Promise<number> {
    // Not implemented.
    return new Promise<number>((resolve, _) => {})
  }

  getHeadersChain(blockHeight: number, confirmations: number): Promise<string> {
    // Not implemented.
    return new Promise<string>((resolve, _) => {})
  }

  async broadcast(transaction: RawTransaction): Promise<void> {
    await this.client.broadcast(transaction.transactionHex)
    return new Promise<void>((resolve, _) => {
      resolve()
    })
  }
}

const refunderPrivKey = ""

const deposit: Deposit = {
  depositor: { identifierHex: "f93f092b01bd4f49814c4309564090d16c8261fd" },
  amount: BigNumber.from(1000000),
  walletPublicKeyHash: "621dee7e4e7a9273fcca01855cda53243b9820e2",
  refundPublicKeyHash: "366bffb7bf2f141ec94be66105af17817856c1f9",
  blindingFactor: "95b33739d625fcc2",
  refundLocktime: "19cdca63",
}

async function run(): Promise<void> {
  bcoin.set("testnet")
  const client = new TestBitcoinClient("", 1234, "", "")

  const depositUtxo: UnspentTransactionOutput = {
    transactionHash: TransactionHash.from(
      "3ce2800830619d81260072294e7d8dda6d77f20c3bf7676ba29dad3347fdf835"
    ),
    outputIndex: 0,
    value: BigNumber.from(1000000),
  }

  const recipientAddress = "tb1qxe4lldal9u2paj2tuessttchs9u9ds0e5sy3v4"

  const refundTxHash = await submitDepositRefundTransaction(
    client,
    BigNumber.from(1520),
    depositUtxo,
    deposit,
    recipientAddress,
    refunderPrivKey,
    true
  )

  console.log(
    "Refund transaction hash",
    refundTxHash.transactionHash.toString()
  )
}

;(async () => {
  try {
    await run()
  } catch (e) {
    console.log("Exception called:", e)
  }
})()
