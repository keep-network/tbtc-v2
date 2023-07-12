import { MockBitcoinClient } from "./utils/mock-bitcoin-client"
import { MockBridge } from "./utils/mock-bridge"
import { BitcoinNetwork, BitcoinTransaction, Hex } from "../src"
import { determineWalletMainUtxo, Wallet } from "../src/wallet"
import { expect } from "chai"
import { encodeToBitcoinAddress } from "../src/bitcoin"
import { BigNumber } from "ethers"

describe("Wallet", () => {
  describe("determineWalletMainUtxo", () => {
    // Just an arbitrary 20-byte wallet public key hash.
    const walletPublicKeyHash = Hex.from(
      "e6f9d74726b19b75f16fe1e9feaec048aa4fa1d0"
    )

    // Helper function facilitating creation of mock transactions.
    const mockTransaction = (
      hash: string,
      outputs: Record<string, number> // key: locking script, value: amount of locked satoshis
    ): BitcoinTransaction => {
      return {
        transactionHash: Hex.from(hash),
        inputs: [], // not relevant in this test scenario
        outputs: Object.entries(outputs).map(
          ([scriptPubKey, value], index) => ({
            outputIndex: index,
            value: BigNumber.from(value),
            scriptPubKey: Hex.from(scriptPubKey),
          })
        ),
      }
    }

    // Create a fake wallet witness transaction history that consists of 6 transactions.
    const walletWitnessTransactionHistory: BitcoinTransaction[] = [
      mockTransaction(
        "3ca4ae3f8ee3b48949192bc7a146c8d9862267816258c85e02a44678364551e1",
        {
          "0014e6f9d74726b19b75f16fe1e9feaec048aa4fa1d0": 100000, // wallet witness output
          "00140000000000000000000000000000000000000001": 200000,
        }
      ),
      mockTransaction(
        "4c6b33b7c0550e0e536a5d119ac7189d71e1296fcb0c258e0c115356895bc0e6",
        {
          "00140000000000000000000000000000000000000001": 100000,
          "0014e6f9d74726b19b75f16fe1e9feaec048aa4fa1d0": 200000, // wallet witness output
        }
      ),
      mockTransaction(
        "44863a79ce2b8fec9792403d5048506e50ffa7338191db0e6c30d3d3358ea2f6",
        {
          "00140000000000000000000000000000000000000001": 100000,
          "00140000000000000000000000000000000000000002": 200000,
          "0014e6f9d74726b19b75f16fe1e9feaec048aa4fa1d0": 300000, // wallet witness output
        }
      ),
      mockTransaction(
        "f65bc5029251f0042aedb37f90dbb2bfb63a2e81694beef9cae5ec62e954c22e",
        {
          "0014e6f9d74726b19b75f16fe1e9feaec048aa4fa1d0": 100000, // wallet witness output
          "00140000000000000000000000000000000000000001": 200000,
        }
      ),
      mockTransaction(
        "2724545276df61f43f1e92c4b9f1dd3c9109595c022dbd9dc003efbad8ded38b",
        {
          "0014e6f9d74726b19b75f16fe1e9feaec048aa4fa1d0": 100000, // wallet witness output
          "00140000000000000000000000000000000000000001": 200000,
        }
      ),
      mockTransaction(
        "ea374ab6842723c647c3fc0ab281ca0641eaa768576cf9df695ca5b827140214",
        {
          "00140000000000000000000000000000000000000001": 100000,
          "0014e6f9d74726b19b75f16fe1e9feaec048aa4fa1d0": 200000, // wallet witness output
        }
      ),
    ]

    // Create a fake wallet legacy transaction history that consists of 6 transactions.
    const walletLegacyTransactionHistory: BitcoinTransaction[] = [
      mockTransaction(
        "230a19d8867ff3f5b409e924d9dd6413188e215f9bb52f1c47de6154dac42267",
        {
          "00140000000000000000000000000000000000000001": 100000,
          "76a914e6f9d74726b19b75f16fe1e9feaec048aa4fa1d088ac": 200000, // wallet legacy output
        }
      ),
      mockTransaction(
        "b11bfc481b95769b8488bd661d5f61a35f7c3c757160494d63f6e04e532dfcb9",
        {
          "00140000000000000000000000000000000000000001": 100000,
          "00140000000000000000000000000000000000000002": 200000,
          "76a914e6f9d74726b19b75f16fe1e9feaec048aa4fa1d088ac": 300000, // wallet legacy output
        }
      ),
      mockTransaction(
        "7e91580d989f8541489a37431381ff9babd596111232f1bc7a1a1ba503c27dee",
        {
          "76a914e6f9d74726b19b75f16fe1e9feaec048aa4fa1d088ac": 100000, // wallet legacy output
          "00140000000000000000000000000000000000000001": 200000,
        }
      ),
      mockTransaction(
        "5404e339ba82e6e52fcc24cb40029bed8425baa4c7f869626ef9de956186f910",
        {
          "76a914e6f9d74726b19b75f16fe1e9feaec048aa4fa1d088ac": 100000, // wallet legacy output
          "00140000000000000000000000000000000000000001": 200000,
        }
      ),
      mockTransaction(
        "05dabb0291c0a6aa522de5ded5cb6d14ee2159e7ff109d3ef0f21de128b56b94",
        {
          "76a914e6f9d74726b19b75f16fe1e9feaec048aa4fa1d088ac": 100000, // wallet legacy output
          "00140000000000000000000000000000000000000001": 200000,
        }
      ),
      mockTransaction(
        "00cc0cd13fc4de7a15cb41ab6d58f8b31c75b6b9b4194958c381441a67d09b08",
        {
          "00140000000000000000000000000000000000000001": 100000,
          "76a914e6f9d74726b19b75f16fe1e9feaec048aa4fa1d088ac": 200000, // wallet legacy output
        }
      ),
    ]

    let bridge: MockBridge
    let bitcoinClient: MockBitcoinClient
    let bitcoinNetwork: BitcoinNetwork

    beforeEach(async () => {
      bridge = new MockBridge()
      bitcoinClient = new MockBitcoinClient()
    })

    context("when wallet main UTXO is not set in the Bridge", () => {
      beforeEach(async () => {
        bridge.setWallet(walletPublicKeyHash.toPrefixedString(), {
          mainUtxoHash: Hex.from(
            "0x0000000000000000000000000000000000000000000000000000000000000000"
          ),
        } as Wallet)
      })

      it("should return undefined", async () => {
        const mainUtxo = await determineWalletMainUtxo(
          walletPublicKeyHash,
          bridge,
          bitcoinClient,
          bitcoinNetwork
        )

        expect(mainUtxo).to.be.undefined
      })
    })

    context("when wallet main UTXO is set in the Bridge", () => {
      const tests = [
        {
          testName: "recent witness transaction",
          // Set the main UTXO hash based on the latest transaction from walletWitnessTransactionHistory.
          actualMainUtxo: {
            transactionHash: Hex.from(
              "ea374ab6842723c647c3fc0ab281ca0641eaa768576cf9df695ca5b827140214"
            ),
            outputIndex: 1,
            value: BigNumber.from(200000),
          },
          expectedMainUtxo: {
            transactionHash: Hex.from(
              "ea374ab6842723c647c3fc0ab281ca0641eaa768576cf9df695ca5b827140214"
            ),
            outputIndex: 1,
            value: BigNumber.from(200000),
          },
        },
        {
          testName: "recent legacy transaction",
          // Set the main UTXO hash based on the second last transaction from walletLegacyTransactionHistory.
          actualMainUtxo: {
            transactionHash: Hex.from(
              "05dabb0291c0a6aa522de5ded5cb6d14ee2159e7ff109d3ef0f21de128b56b94"
            ),
            outputIndex: 0,
            value: BigNumber.from(100000),
          },
          expectedMainUtxo: {
            transactionHash: Hex.from(
              "05dabb0291c0a6aa522de5ded5cb6d14ee2159e7ff109d3ef0f21de128b56b94"
            ),
            outputIndex: 0,
            value: BigNumber.from(100000),
          },
        },
        {
          testName: "old witness transaction",
          // Set the main UTXO hash based on the oldest transaction from walletWitnessTransactionHistory.
          actualMainUtxo: {
            transactionHash: Hex.from(
              "3ca4ae3f8ee3b48949192bc7a146c8d9862267816258c85e02a44678364551e1"
            ),
            outputIndex: 0,
            value: BigNumber.from(100000),
          },
          expectedMainUtxo: undefined,
        },
        {
          testName: "old legacy transaction",
          // Set the main UTXO hash based on the oldest transaction from walletLegacyTransactionHistory.
          actualMainUtxo: {
            transactionHash: Hex.from(
              "230a19d8867ff3f5b409e924d9dd6413188e215f9bb52f1c47de6154dac42267"
            ),
            outputIndex: 1,
            value: BigNumber.from(200000),
          },
          expectedMainUtxo: undefined,
        },
      ]

      tests.forEach(({ testName, actualMainUtxo, expectedMainUtxo }) => {
        context(`with main UTXO coming from ${testName}`, () => {
          const networkTests = [
            {
              networkTestName: "bitcoin testnet",
              network: BitcoinNetwork.Testnet,
            },
            {
              networkTestName: "bitcoin mainnet",
              network: BitcoinNetwork.Mainnet,
            },
          ]

          networkTests.forEach(({ networkTestName, network }) => {
            context(`with ${networkTestName} network`, () => {
              beforeEach(async () => {
                bitcoinNetwork = network

                const walletWitnessAddress = encodeToBitcoinAddress(
                  walletPublicKeyHash.toString(),
                  true,
                  bitcoinNetwork
                )
                const walletLegacyAddress = encodeToBitcoinAddress(
                  walletPublicKeyHash.toString(),
                  false,
                  bitcoinNetwork
                )

                // Record the fake transaction history for both address types.
                const transactionHistory = new Map<
                  string,
                  BitcoinTransaction[]
                >()
                transactionHistory.set(
                  walletWitnessAddress,
                  walletWitnessTransactionHistory
                )
                transactionHistory.set(
                  walletLegacyAddress,
                  walletLegacyTransactionHistory
                )
                bitcoinClient.transactionHistory = transactionHistory

                bridge.setWallet(walletPublicKeyHash.toPrefixedString(), {
                  mainUtxoHash: bridge.buildUtxoHash(actualMainUtxo),
                } as Wallet)
              })

              it("should return the expected main UTXO", async () => {
                const mainUtxo = await determineWalletMainUtxo(
                  walletPublicKeyHash,
                  bridge,
                  bitcoinClient,
                  bitcoinNetwork
                )

                expect(mainUtxo).to.be.eql(expectedMainUtxo)
              })
            })
          })
        })
      })
    })
  })
})
