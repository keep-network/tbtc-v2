import {
  Credentials as ElectrumCredentials,
  Client as ElectrumClient,
} from "../src/electrum"
import { BitcoinNetwork } from "../src/bitcoin/network"
import { TestnetTestData, MainnetTestData } from "./data/electrum"
import { expect } from "chai"
import https from "https"

const electrumTestData = new Map<string, any>([
  [BitcoinNetwork.Testnet.toString(), TestnetTestData],
  [BitcoinNetwork.Mainnet.toString(), MainnetTestData],
])

const blockstreamApiUrl = new Map<string, string>([
  [BitcoinNetwork.Testnet.toString(), "https://blockstream.info/testnet/api"],
  [BitcoinNetwork.Mainnet.toString(), "https://blockstream.info/api"],
])

type TestElectrumCredentials = ElectrumCredentials & { network: BitcoinNetwork }

const servers: TestElectrumCredentials[] = [
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
    network: BitcoinNetwork.Testnet,
  },
  // electrs-esplora tcp
  {
    host: "electrum.blockstream.info",
    port: 60001,
    protocol: "tcp",
    network: BitcoinNetwork.Testnet,
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
    network: BitcoinNetwork.Testnet,
  },
  // FIXME: https://github.com/keep-network/tbtc-v2/issues/502
  // fulcrum ssl
  // {
  //   host: "testnet.aranguren.org",
  //   port: 51002,
  //   protocol: "ssl",
  // },
  {
    host: "electrumx-server.tbtc.network",
    port: 8443,
    protocol: "wss",
    network: BitcoinNetwork.Mainnet,
  },
  // electrs-esplora tcp
  {
    host: "electrum.blockstream.info",
    port: 50001,
    protocol: "tcp",
    network: BitcoinNetwork.Mainnet,
  },
  // TODO: Add more servers
  // TODO: Consider extracting communication with real servers to integration tests suite
  // and mock electrum server.
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
describe.only("Electrum", () => {
  servers.forEach((server) => {
    context(
      `${server.network}: ${server.protocol}://${server.host}:${server.port}`,
      async () => {
        // Skip some tests for mainnet until test data are provided.
        const describeSkipMainnet =
          server.network === BitcoinNetwork.Mainnet ? describe.skip : describe

        let testData: any
        let electrumClient: ElectrumClient

        before(async () => {
          testData = electrumTestData.get(server.network.toString())
          electrumClient = new ElectrumClient(server)
        })

        describe("getNetwork", () => {
          it("should return proper network", async () => {
            const result = await electrumClient.getNetwork()
            expect(result).to.be.eql(server.network)
          })
        })

        describeSkipMainnet("findAllUnspentTransactionOutputs", () => {
          it("should return proper UTXOs for the given address", async () => {
            const result =
              await electrumClient.findAllUnspentTransactionOutputs(
                testData.address
              )
            expect(result).to.be.eql([testData.UTXO])
          })
        })

        describeSkipMainnet("getTransaction", () => {
          it("should return proper transaction for the given hash", async () => {
            const result = await electrumClient.getTransaction(
              testData.transaction.transactionHash
            )
            expect(result).to.be.eql(testData.transaction)
          })
          // TODO: Add case when transaction doesn't exist
        })

        describeSkipMainnet("getRawTransaction", () => {
          it("should return proper raw transaction for the given hash", async () => {
            const result = await electrumClient.getRawTransaction(
              testData.transaction.transactionHash
            )
            expect(result).to.be.eql(testData.rawTransaction)
          })
        })

        describeSkipMainnet("getTransactionConfirmations", () => {
          let result: number

          before(async () => {
            result = await electrumClient.getTransactionConfirmations(
              testData.transaction.transactionHash
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
              latestBlockHeight - testData.transactionMerkleBranch.blockHeight

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
            const expectedResult = await getExpectedLatestBlockHeight(
              server.network
            )

            expect(result).to.be.closeTo(expectedResult, 3)
          })
        })

        describeSkipMainnet("getHeadersChain", () => {
          it("should return proper headers chain", async () => {
            const result = await electrumClient.getHeadersChain(
              testData.headersChain.blockHeight,
              testData.headersChain.headersChainLength
            )
            expect(result).to.be.eql(testData.headersChain.headersChain)
          })
        })

        describeSkipMainnet("getTransactionMerkle", () => {
          it("should return proper transaction merkle", async () => {
            const result = await electrumClient.getTransactionMerkle(
              testData.transaction.transactionHash,
              testData.transactionMerkleBranch.blockHeight
            )
            expect(result).to.be.eql(testData.transactionMerkleBranch)
          })
        })
      }
    )
  })
})

/**
 * Gets the height of the last block fetched from the Blockstream API.
 * @param network Bitcoin network.
 * @returns Height of the last block.
 */
function getExpectedLatestBlockHeight(
  network: BitcoinNetwork
): Promise<number> {
  return new Promise((resolve, reject) => {
    https
      .get(
        `${blockstreamApiUrl.get(network.toString())}/blocks/tip/height`,
        (resp) => {
          let data = ""

          // A chunk of data has been received.
          resp.on("data", (chunk) => {
            data += chunk
          })

          // The whole response has been received. Print out the result.
          resp.on("end", () => {
            resolve(JSON.parse(data))
          })
        }
      )
      .on("error", (err) => {
        reject(err)
      })
  })
}
