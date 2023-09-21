import {
  Credentials as ElectrumCredentials,
  Client as ElectrumClient,
  computeScriptHash,
} from "../src/electrum"
import { BitcoinNetwork } from "../src/bitcoin-network"
import {
  testnetAddress,
  testnetHeadersChain,
  testnetRawTransaction,
  testnetTransaction,
  testnetTransactionMerkleBranch,
  testnetUTXO,
} from "./data/electrum"
import { expect } from "chai"
import https from "https"

const BLOCKSTREAM_TESTNET_API_URL = "https://blockstream.info/testnet/api"

const testnetCredentials: ElectrumCredentials[] = [
  // TODO: Enable all protocols test for test.tbtc.network servers once they are
  // publicly exposed.
  // // electrumx tcp
  // {
  //   host: "electrumx-server.test.tbtc.network",
  //   port: 80,
  //   protocol: "tcp",
  // },
  // electrumx ssl
  // {
  //   host: "electrumx-server.test.tbtc.network",
  //   port: 443,
  //   protocol: "ssl",
  // },
  // electrumx ws
  // {
  //   host: "electrumx-server.test.tbtc.network",
  //   port: 8080,
  //   protocol: "ws",
  // },
  // electrumx wss
  {
    host: "electrumx-server.test.tbtc.network",
    port: 8443,
    protocol: "wss",
  },
  // electrs-esplora tcp
  {
    host: "electrum.blockstream.info",
    port: 60001,
    protocol: "tcp",
  },
  // FIXME: https://github.com/keep-network/tbtc-v2/issues/502
  // // electrs-esplora ssl
  // {
  //   host: "electrum.blockstream.info",
  //   port: 60002,
  //   protocol: "ssl",
  // },
  // fulcrum tcp
  {
    host: "testnet.aranguren.org",
    port: 51001,
    protocol: "tcp",
  },
  // FIXME: https://github.com/keep-network/tbtc-v2/issues/502
  // fulcrum ssl
  // {
  //   host: "testnet.aranguren.org",
  //   port: 51002,
  //   protocol: "ssl",
  // },
]

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
describe("Electrum", () => {
  testnetCredentials.forEach((credentials) => {
    describe(`${credentials.protocol}://${credentials.host}:${credentials.port}`, async () => {
      let electrumClient: ElectrumClient

      before(async () => {
        electrumClient = new ElectrumClient([credentials])
      })

      describe("getNetwork", () => {
        it("should return proper network", async () => {
          const result = await electrumClient.getNetwork()
          expect(result).to.be.eql(BitcoinNetwork.Testnet)
        })
      })

      describe("findAllUnspentTransactionOutputs", () => {
        it("should return proper UTXOs for the given address", async () => {
          const result = await electrumClient.findAllUnspentTransactionOutputs(
            testnetAddress
          )
          expect(result).to.be.eql([testnetUTXO])
        })
      })

      describe("getTransactionHistory", () => {
        it("should return proper transaction history for the given address", async () => {
          // https://live.blockcypher.com/btc-testnet/address/tb1qumuaw3exkxdhtut0u85latkqfz4ylgwstkdzsx
          const transactions = await electrumClient.getTransactionHistory(
            "tb1qumuaw3exkxdhtut0u85latkqfz4ylgwstkdzsx",
            5
          )

          const transactionsHashes = transactions.map((t) =>
            t.transactionHash.toString()
          )

          expect(transactionsHashes).to.be.eql([
            "3ca4ae3f8ee3b48949192bc7a146c8d9862267816258c85e02a44678364551e1",
            "f65bc5029251f0042aedb37f90dbb2bfb63a2e81694beef9cae5ec62e954c22e",
            "44863a79ce2b8fec9792403d5048506e50ffa7338191db0e6c30d3d3358ea2f6",
            "4c6b33b7c0550e0e536a5d119ac7189d71e1296fcb0c258e0c115356895bc0e6",
            "605edd75ae0b4fa7cfc7aae8f1399119e9d7ecc212e6253156b60d60f4925d44",
          ])
        })
      })

      describe("getTransaction", () => {
        it("should return proper transaction for the given hash", async () => {
          const result = await electrumClient.getTransaction(
            testnetTransaction.transactionHash
          )
          expect(result).to.be.eql(testnetTransaction)
        })
        // TODO: Add case when transaction doesn't exist
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
        let result: number

        before(async () => {
          result = await electrumClient.getTransactionConfirmations(
            testnetTransaction.transactionHash
          )
        })

        it("should return value greater than 6", async () => {
          // Strict comparison is not possible as the number of confirmations
          // constantly grows. We just make sure it's 6+.
          expect(result).to.be.greaterThan(6)
        })

        // This test depends on `latestBlockHeight` function.
        it("should return proper confirmations number for the given hash", async () => {
          const latestBlockHeight = await electrumClient.latestBlockHeight()

          const expectedResult =
            latestBlockHeight - testnetTransactionMerkleBranch.blockHeight

          expect(result).to.be.closeTo(expectedResult, 3)
        })
      })

      describe("latestBlockHeight", () => {
        let result: number

        before(async () => {
          result = await electrumClient.latestBlockHeight()
        })

        it("should return value greater than 6", async () => {
          // Strict comparison is not possible as the latest block height
          // constantly grows. We just make sure it's bigger than 0.
          expect(result).to.be.greaterThan(0)
        })

        // This test depends on fetching the expected latest block height from Blockstream API.
        // It can fail if Blockstream API is down or if Blockstream API or if
        // Electrum Server used in tests is out-of-sync with the Blockstream API.
        it("should return proper latest block height", async () => {
          const expectedResult = await getExpectedLatestBlockHeight()

          expect(result).to.be.closeTo(expectedResult, 3)
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

      describe("computeScriptHash", () => {
        it("should convert Bitcoin script to an Electrum script hash correctly", () => {
          const script = "00144b47c798d12edd17dfb4ea98e5447926f664731c"
          const expectedScriptHash =
            "cabdea0bfc10fb3521721dde503487dd1f0e41dd6609da228066757563f292ab"

          expect(computeScriptHash(script)).to.be.equal(expectedScriptHash)
        })
      })
    })
  })

  describe("fallback connection", async () => {
    let electrumClient: ElectrumClient

    before(async () => {
      electrumClient = new ElectrumClient(
        [
          // Invalid server
          {
            host: "non-existing-host.local",
            port: 50001,
            protocol: "tcp",
          },
          // Valid server
          testnetCredentials[0],
        ],
        undefined,
        2,
        1000,
        2000
      )
    })

    it("should establish connection with a fallback server", async () => {
      const result = await electrumClient.getNetwork()
      expect(result).to.be.eql(BitcoinNetwork.Testnet)
    })
  })
})

/**
 * Gets the height of the last block fetched from the Blockstream API.
 * @returns Height of the last block.
 */
function getExpectedLatestBlockHeight(): Promise<number> {
  return new Promise((resolve, reject) => {
    https
      .get(`${BLOCKSTREAM_TESTNET_API_URL}/blocks/tip/height`, (resp) => {
        let data = ""

        // A chunk of data has been received.
        resp.on("data", (chunk) => {
          data += chunk
        })

        // The whole response has been received. Print out the result.
        resp.on("end", () => {
          resolve(JSON.parse(data))
        })
      })
      .on("error", (err) => {
        reject(err)
      })
  })
}
