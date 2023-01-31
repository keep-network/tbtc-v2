import { BigNumber } from "ethers"
import { Deposit } from "../src/deposit"
import { submitDepositRefundTransaction } from "../src/deposit-refund"
import { TransactionHash, UnspentTransactionOutput } from "../src/bitcoin"
import { Client as ElectrumClient } from "../src/electrum"
import { program } from "commander"
import fs from "fs"

program
  .version("0.0.1")
  .requiredOption(
    "-d, --deposit-json-path <deposit-json-path>",
    "deposit JSON file path"
  )
  .requiredOption(
    "-a, --deposit-amount <amount-to-refund>",
    "amount of BTC to refund"
  )
  .requiredOption(
    "-t, --deposit-transaction-id <transaction-id>",
    "transaction id of the original deposit"
  )
  .requiredOption(
    "-i, --deposit-transaction-index <transaction-index>",
    "deposit transaction index"
  )
  .requiredOption(
    "-k, --private-key <private-key>",
    "private key of the BTC wallet"
  )
  .requiredOption(
    "-f, --transaction-fee <transaction-fee>",
    "recovery address of the BTC wallet"
  )
  .requiredOption("-o, --host <host>", "network name")
  .requiredOption("-p, --port <port>", "network name")
  .requiredOption("-r, --protocol <protocol>", "network name")
  .parse(process.argv)

// Parse the program options
const options = program.opts()
const depositJsonPath = options.depositJsonPath
const refundAmount = options.depositAmount // in satoshi
const transactionId = options.depositTransactionId
const transactionIndex = options.depositTransactionIndex
const refunderPrivateKey = options.privateKey
const fee = options.transactionFee
const electrumCredentials = {
  host: options.host,
  port: options.port,
  protocol: options.protocol,
}

const depositJson = JSON.parse(fs.readFileSync(depositJsonPath, "utf-8"))

const deposit: Deposit = {
  depositor: depositJson.depositor,
  amount: BigNumber.from(refundAmount),
  walletPublicKeyHash: depositJson.walletPublicKeyHash,
  refundPublicKeyHash: depositJson.refundPublicKeyHash,
  blindingFactor: depositJson.blindingFactor,
  refundLocktime: depositJson.refundLocktime,
}
const recoveryAddress = depositJson.btcRecoveryAddress

console.log("======= refund provided data ========")
console.log("deposit JSON: ", deposit)
console.log("deposit recovery amount: ", refundAmount)
console.log("deposit transaction ID: ", transactionId)
console.log("deposit transaction index: ", transactionIndex)
console.log("recovery address: ", recoveryAddress)
console.log("electrum credentials:", electrumCredentials)
console.log("=====================================")

async function run(): Promise<void> {
  const client = new ElectrumClient(electrumCredentials)

  const depositUtxo: UnspentTransactionOutput = {
    transactionHash: TransactionHash.from(transactionId),
    outputIndex: Number(transactionIndex),
    value: BigNumber.from(refundAmount),
  }

  const refundTxHash = await submitDepositRefundTransaction(
    client,
    BigNumber.from(fee),
    depositUtxo,
    deposit,
    recoveryAddress,
    refunderPrivateKey
  )

  console.log("Refund transaction ID", refundTxHash.transactionHash.toString())
}

;(async () => {
  try {
    await run()
  } catch (e) {
    console.log("Exception called:", e)
  }
})()
