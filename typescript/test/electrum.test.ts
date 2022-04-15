import {
  Credentials as ElectrumCredentials,
  Client as ElectrumClient,
} from "../src/electrum"
import {
  testnetAddress,
  testnetHeadersChain,
  testnetRawTransaction,
  testnetTransaction,
  testnetTransactionMerkleBranch,
  testnetUTXO,
} from "./data/electrum"
import { expect } from "chai"

const testnetCredentials: ElectrumCredentials = {
  host: "electrumx-server.test.tbtc.network",
  port: 8443,
  protocol: "wss",
}

/**
 * This test suite is meant to check the behavior of the Electrum-based
 * Bitcoin client implementation. This suite requires an integration with a
 * real testnet Electrum server. That requirement makes those tests
 * time-consuming and vulnerable to external service health fluctuations.
 * Because of that, they are skipped by default and should be run only
 * on demand. Worth noting this test suite does not provide full coverage
 * of all Electrum client functions. The `broadcast` function is not covered
 * since it requires a proper Bitcoin transaction hex for each run which is
 * out of scope of this suite. The `broadcast` function was tested manually
 * though.
 */
describe.skip("Electrum", () => {
  let electrumClient: ElectrumClient

  before(async () => {
    electrumClient = new ElectrumClient(testnetCredentials)
  })

  describe("findAllUnspentTransactionOutputs", () => {
    it("should return proper UTXOs for the given address", async () => {
      const result = await electrumClient.findAllUnspentTransactionOutputs(
        testnetAddress
      )
      expect(result).to.be.eql([testnetUTXO])
    })
  })

  describe("getTransaction", () => {
    it("should return proper transaction for the given hash", async () => {
      const result = await electrumClient.getTransaction(
        testnetTransaction.transactionHash
      )
      expect(result).to.be.eql(testnetTransaction)
    })
  })

  describe("getRawTransaction", () => {
    it("should return proper raw transaction for the given hash", async () => {
      const result = await electrumClient.getRawTransaction(
        testnetTransaction.transactionHash
      )
      expect(result).to.be.eql(testnetRawTransaction)
    })
  })

  describe("getTransactionConfirmations", () => {
    it("should return proper confirmations number for the given hash", async () => {
      const result = await electrumClient.getTransactionConfirmations(
        testnetTransaction.transactionHash
      )
      // Strict comparison is not possible as the number of confirmations
      // constantly grows. We just make sure it's 6+.
      expect(result).to.be.greaterThan(6)
    })
  })

  describe("latestBlockHeight", () => {
    it("should return proper latest block height", async () => {
      const result = await electrumClient.latestBlockHeight()
      // Strict comparison is not possible as the latest block height
      // constantly grows. We just make sure it's bigger than 0.
      expect(result).to.be.greaterThan(0)
    })
  })

  describe("getHeadersChain", () => {
    it("should return proper headers chain", async () => {
      const result = await electrumClient.getHeadersChain(
        testnetHeadersChain.blockHeight,
        testnetHeadersChain.headersChainLength
      )
      expect(result).to.be.eql(testnetHeadersChain.headersChain)
    })
  })

  describe("getTransactionMerkle", () => {
    it("should return proper transaction merkle", async () => {
      const result = await electrumClient.getTransactionMerkle(
        testnetTransaction.transactionHash,
        testnetTransactionMerkleBranch.blockHeight
      )
      expect(result).to.be.eql(testnetTransactionMerkleBranch)
    })
  })
})
