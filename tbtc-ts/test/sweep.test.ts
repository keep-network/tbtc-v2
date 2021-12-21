import TBTC from "./../src"
import { expect } from "chai"
import { BigNumber } from "ethers"
import {
  testnetTransactionHash1,
  testnetTransactionHash2,
  testnetTransactionHash3,
  testnetTransaction1,
  testnetTransaction2,
  testnetTransaction3,
  testnetUTXO1,
  testnetUTXO2,
  testnetUTXO3,
  testnetUTXOraw1,
  testnetUTXOraw2,
  testnetUTXOraw3,
  testnetPrivateKey,
  testnetAddress,
} from "./data/bitcoin"
import {
  RawTransaction,
  Client as BitcoinClient,
  UnspentTransactionOutput,
  Transaction,
} from "../src/bitcoin"
// @ts-ignore
import bcoin from "bcoin"

describe("Sweep", () => {
  const fee = BigNumber.from(2500)
  let bitcoinClient: MockBitcoinClient

  describe("sweepUtxos", () => {
    describe("when there is a single UTXO", () => {
      const expectedSweepTransaction: RawTransaction = {
        transactionHex:
          "010000000001018348cdeb551134fe1f19d378a8adec9b146671cb67b945b71bf5" +
          "6b20dc2b952f0100000000ffffffff014cfa3b00000000001600147ac2d9378a1c" +
          "47e589dfb8095ca95ed2140d2726024830450221008c4a73984afb7675fada5b25" +
          "1dff991db6ecce6fc4dc0057d5f762649793146d02203a63920754094eadea41f3" +
          "8d43624dff17af4f67d4ea7863853006bfc3848157012102ee067a0273f2e3ba88" +
          "d23140a24fdb290f27bbcd0f94117a9c65be3911c5c04e00000000",
      }

      beforeEach(async () => {
        bcoin.set("testnet")

        bitcoinClient = new MockBitcoinClient()
        // Tie testnetTransaction to testnetUTXO. This is needed since sweepUtxos
        // attach transaction data to each UTXO.
        const rawTransactions = new Map<string, RawTransaction>()
        rawTransactions.set(testnetTransactionHash1, testnetTransaction1)

        bitcoinClient.rawTransactions = rawTransactions

        await TBTC.sweepUtxos(
          [testnetUTXO1],
          fee,
          testnetPrivateKey,
          bitcoinClient
        )
      })

      it("should broadcast transaction with proper structure", async () => {
        expect(bitcoinClient.broadcastLog.length).to.be.equal(1)
        expect(bitcoinClient.broadcastLog[0]).to.be.eql(
          expectedSweepTransaction
        )
      })
    })

    describe("when there are multiple UTXOs", () => {
      const expectedSweepTransaction: RawTransaction = {
        transactionHex:
          "010000000001037055df85d5a592e81f87dbc7244f78e217d2de1274b42b31b1c4" +
          "b93e5a09ca3d0100000000ffffffff8348cdeb551134fe1f19d378a8adec9b1466" +
          "71cb67b945b71bf56b20dc2b952f0100000000ffffffffe808675700d07ae1e743" +
          "3c14c650dfe89f9cc0c328f0ca03940a8f81734c649b0100000000ffffffff01f9" +
          "509500000000001600147ac2d9378a1c47e589dfb8095ca95ed2140d2726024730" +
          "4402205ef312ea9eda9a0278981b16de90795fa975038a83f7391cbc6b285a9014" +
          "465c022079b4f3098fa039ddbef65a1a3a3020f0eed3feaab83a9f2841c66d686e" +
          "534412012102ee067a0273f2e3ba88d23140a24fdb290f27bbcd0f94117a9c65be" +
          "3911c5c04e0247304402201033da0ef3f5865f20a4c0a1734c2d41a1cc1810e344" +
          "637942ed5f30cb1fa93b02201515cb2cb351f848b74358efbe0b54526b442fd82e" +
          "3fcd990dc096bc77e163c4012102ee067a0273f2e3ba88d23140a24fdb290f27bb" +
          "cd0f94117a9c65be3911c5c04e024730440220688bc12d336f02b35c34b9bde35c" +
          "1172bed538eda4a7f9a040b6cd89f711b6db0220371467b6512f6156dce5527dc5" +
          "884a3937243d9d8fe3ad142b337df72cb877f2012102ee067a0273f2e3ba88d231" +
          "40a24fdb290f27bbcd0f94117a9c65be3911c5c04e00000000",
      }

      beforeEach(async () => {
        bcoin.set("testnet")

        bitcoinClient = new MockBitcoinClient()
        // Tie testnetTransaction to testnetUTXO. This is needed since sweepUtxos
        // attach transaction data to each UTXO.
        const rawTransactions = new Map<string, RawTransaction>()
        rawTransactions.set(testnetTransactionHash1, testnetTransaction1)
        rawTransactions.set(testnetTransactionHash2, testnetTransaction2)
        rawTransactions.set(testnetTransactionHash3, testnetTransaction3)

        bitcoinClient.rawTransactions = rawTransactions

        await TBTC.sweepUtxos(
          [testnetUTXO1, testnetUTXO2, testnetUTXO3],
          fee,
          testnetPrivateKey,
          bitcoinClient
        )
      })

      it("should broadcast transaction with proper structure", async () => {
        expect(bitcoinClient.broadcastLog.length).to.be.equal(1)
        expect(bitcoinClient.broadcastLog[0]).to.be.eql(
          expectedSweepTransaction
        )
      })
    })
  })

  describe("createSweepTransaction", () => {
    let transaction: RawTransaction

    describe("when there is a single UTXO", () => {
      beforeEach(async () => {
        transaction = await TBTC.createSweepTransaction(
          [testnetUTXOraw1],
          fee,
          testnetPrivateKey
        )
      })

      it("should return transaction with proper structure", async () => {
        // Convert raw transaction to JSON.
        bcoin.set("testnet")
        const buffer = Buffer.from(transaction.transactionHex, "hex")
        const txJSON = bcoin.TX.fromRaw(buffer).toJSON()

        expect(txJSON.hash).to.be.equal(
          "4af1d81942704013b0871bcc9d74a513f9e151eecca73252ad91a08abee2b99a"
        )
        expect(txJSON.version).to.be.equal(1)

        // Validate inputs.
        expect(txJSON.inputs.length).to.be.equal(1)

        const input = txJSON.inputs[0]
        expect(input.prevout.hash).to.be.equal(testnetUTXOraw1.transactionHash)
        expect(input.prevout.index).to.be.equal(testnetUTXOraw1.outputIndex)
        // Transaction should be signed but this is SegWit input so the `script`
        // field should be empty and the `witness` field should be filled instead.
        expect(input.script.length).to.be.equal(0)
        expect(input.witness.length).to.be.greaterThan(0)
        expect(input.address).to.be.equal(testnetAddress)

        // Validate output (there is no change)
        expect(txJSON.outputs.length).to.be.equal(1)
        const output = txJSON.outputs[0]

        // Value should be equal to the sum of input values minus fee.
        const expectedOutputAmount = testnetUTXOraw1.value - fee.toNumber()
        expect(output.value).to.be.equal(expectedOutputAmount)
        // Should be OP_0 <public-key-hash>. Public key corresponds to
        // wallet BTC address.
        expect(output.script).to.be.equal(
          "00147ac2d9378a1c47e589dfb8095ca95ed2140d2726"
        )
        // Should return the wallet address
        expect(output.address).to.be.equal(
          "tb1q0tpdjdu2r3r7tzwlhqy4e2276g2q6fexsz4j0m"
        )
      })
    })

    describe("when there are multiple UTXOs", () => {
      beforeEach(async () => {
        transaction = await TBTC.createSweepTransaction(
          [testnetUTXOraw1, testnetUTXOraw2, testnetUTXOraw3],
          fee,
          testnetPrivateKey
        )
      })

      it("should return transaction with proper structure", async () => {
        // Convert raw transaction to JSON.
        bcoin.set("testnet")
        const buffer = Buffer.from(transaction.transactionHex, "hex")
        const txJSON = bcoin.TX.fromRaw(buffer).toJSON()

        expect(txJSON.hash).to.be.equal(
          "83667d7171a8ec1c206f340afd34bfa0ebde2607a33361738e79e948c614e943"
        )
        expect(txJSON.version).to.be.equal(1)

        // Validate inputs.
        expect(txJSON.inputs.length).to.be.equal(3)

        const input2 = txJSON.inputs[0]
        expect(input2.prevout.hash).to.be.equal(testnetUTXOraw2.transactionHash)
        expect(input2.prevout.index).to.be.equal(testnetUTXOraw2.outputIndex)
        // Transaction should be signed but this is SegWit input so the `script`
        // field should be empty and the `witness` field should be filled instead.
        expect(input2.script.length).to.be.equal(0)
        expect(input2.witness.length).to.be.greaterThan(0)
        expect(input2.address).to.be.equal(testnetAddress)

        const input1 = txJSON.inputs[1]
        expect(input1.prevout.hash).to.be.equal(testnetUTXOraw1.transactionHash)
        expect(input1.prevout.index).to.be.equal(testnetUTXOraw1.outputIndex)
        expect(input1.script.length).to.be.equal(0)
        expect(input1.witness.length).to.be.greaterThan(0)
        expect(input1.address).to.be.equal(testnetAddress)

        const input3 = txJSON.inputs[2]
        expect(input3.prevout.hash).to.be.equal(testnetUTXOraw3.transactionHash)
        expect(input3.prevout.index).to.be.equal(testnetUTXOraw3.outputIndex)
        expect(input3.script.length).to.be.equal(0)
        expect(input3.witness.length).to.be.greaterThan(0)
        expect(input3.address).to.be.equal(testnetAddress)

        // Validate output (there is no change)
        expect(txJSON.outputs.length).to.be.equal(1)
        const output = txJSON.outputs[0]

        // Value should be equal to the sum of input values minus fee.
        const expectedOutputAmount =
          testnetUTXOraw1.value +
          testnetUTXOraw2.value +
          testnetUTXOraw3.value -
          fee.toNumber()
        expect(output.value).to.be.equal(expectedOutputAmount)
        // Should be OP_0 <public-key-hash>. Public key corresponds to
        // wallet BTC address.
        expect(output.script).to.be.equal(
          "00147ac2d9378a1c47e589dfb8095ca95ed2140d2726"
        )
        // Should return the wallet address
        expect(output.address).to.be.equal(
          "tb1q0tpdjdu2r3r7tzwlhqy4e2276g2q6fexsz4j0m"
        )
      })
    })
  })
})

class MockBitcoinClient implements BitcoinClient {
  private _rawTransactions = new Map<string, RawTransaction>()

  private _broadcastLog: RawTransaction[] = []

  set rawTransactions(value: Map<string, RawTransaction>) {
    this._rawTransactions = value
  }

  get broadcastLog(): RawTransaction[] {
    return this._broadcastLog
  }

  findAllUnspentTransactionOutputs(
    address: string
  ): Promise<UnspentTransactionOutput[]> {
    // Not implemented
    return new Promise<UnspentTransactionOutput[]>((resolve, _) => {})
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
