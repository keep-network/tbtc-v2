import {
  BitcoinAddressConverter,
  BitcoinHashUtils,
  BitcoinNetwork,
  BitcoinRawTx,
  BitcoinTx,
  BitcoinTxHash,
  BitcoinUtxo,
  Hex,
  NewWalletRegisteredEvent,
  RedemptionRequest,
  RedemptionsService,
  Wallet,
  WalletState,
  WalletTx,
} from "../../src"
import { MockBitcoinClient } from "../utils/mock-bitcoin-client"
import {
  findWalletForRedemptionData,
  multipleRedemptionsWithWitnessChange,
  RedemptionTestData,
  singleP2PKHRedemptionWithWitnessChange,
  walletPublicKey,
} from "../data/redemption"
import { MockBridge } from "../utils/mock-bridge"
import * as chai from "chai"
import { expect } from "chai"
import chaiAsPromised from "chai-as-promised"
import { BigNumber, BigNumberish } from "ethers"
import { MockTBTCContracts } from "../utils/mock-tbtc-contracts"

chai.use(chaiAsPromised)

describe("Redemptions", () => {
  describe("RedemptionsService", () => {
    describe("requestRedemption", () => {
      const data: RedemptionTestData = singleP2PKHRedemptionWithWitnessChange
      const { transactionHash, value } = data.mainUtxo
      const mainUtxo: BitcoinUtxo = {
        transactionHash,
        outputIndex: 0,
        value,
      }
      const redeemerOutputScript =
        data.pendingRedemptions[0].pendingRedemption.redeemerOutputScript
      const amount =
        data.pendingRedemptions[0].pendingRedemption.requestedAmount

      let tbtcContracts: MockTBTCContracts
      let bitcoinClient: MockBitcoinClient

      beforeEach(async () => {
        tbtcContracts = new MockTBTCContracts()
        bitcoinClient = new MockBitcoinClient()

        const walletPublicKeyHash =
          BitcoinHashUtils.computeHash160(walletPublicKey)

        // Prepare NewWalletRegisteredEvent history. Set only relevant fields.
        tbtcContracts.bridge.newWalletRegisteredEvents = [
          {
            walletPublicKeyHash,
          } as NewWalletRegisteredEvent,
        ]

        // Prepare wallet data in the Bridge. Set only relevant fields.
        tbtcContracts.bridge.setWallet(walletPublicKeyHash.toPrefixedString(), {
          state: WalletState.Live,
          walletPublicKey,
          pendingRedemptionsValue: BigNumber.from(0),
          mainUtxoHash: tbtcContracts.bridge.buildUtxoHash(mainUtxo),
        } as Wallet)

        const walletAddress = BitcoinAddressConverter.publicKeyHashToAddress(
          walletPublicKeyHash,
          true,
          BitcoinNetwork.Testnet
        )

        // Prepare wallet transaction history for main UTXO lookup.
        // Set only relevant fields.
        const transactionHistory = new Map<string, BitcoinTx[]>()
        transactionHistory.set(walletAddress, [
          {
            transactionHash: mainUtxo.transactionHash,
            outputs: [
              {
                outputIndex: mainUtxo.outputIndex,
                value: mainUtxo.value,
                scriptPubKey: BitcoinAddressConverter.addressToOutputScript(
                  walletAddress,
                  BitcoinNetwork.Testnet
                ),
              },
            ],
          } as BitcoinTx,
        ])
        bitcoinClient.transactionHistory = transactionHistory

        const redemptionsService = new RedemptionsService(
          tbtcContracts,
          bitcoinClient
        )

        await redemptionsService.requestRedemption(
          BitcoinAddressConverter.outputScriptToAddress(
            redeemerOutputScript,
            BitcoinNetwork.Testnet
          ),
          amount
        )
      })

      it("should submit redemption request with correct arguments", () => {
        const tokenLog = tbtcContracts.tbtcToken.requestRedemptionLog

        expect(tokenLog.length).to.equal(1)
        expect(tokenLog[0]).to.deep.equal({
          walletPublicKey,
          mainUtxo,
          redeemerOutputScript,
          amount,
        })
      })
    })

    describe("getRedemptionRequest", () => {
      context("when asked for a pending request", () => {
        const { redemptionKey, pendingRedemption: redemptionRequest } =
          multipleRedemptionsWithWitnessChange.pendingRedemptions[0]

        let tbtcContracts: MockTBTCContracts
        let bitcoinClient: MockBitcoinClient
        let redemptionsService: RedemptionsService

        beforeEach(async () => {
          tbtcContracts = new MockTBTCContracts()
          bitcoinClient = new MockBitcoinClient()

          const pendingRedemptions = new Map<BigNumberish, RedemptionRequest>()
          pendingRedemptions.set(redemptionKey, redemptionRequest)

          tbtcContracts.bridge.setPendingRedemptions(pendingRedemptions)

          redemptionsService = new RedemptionsService(
            tbtcContracts,
            bitcoinClient
          )
        })

        it("should return the expected redemption request", async () => {
          const actualRedemptionRequest =
            await redemptionsService.getRedemptionRequests(
              BitcoinAddressConverter.outputScriptToAddress(
                redemptionRequest.redeemerOutputScript,
                BitcoinNetwork.Testnet
              ),
              walletPublicKey,
              "pending"
            )

          expect(actualRedemptionRequest).to.be.eql(redemptionRequest)
        })
      })

      context("when asked for a timed-out request", () => {
        const { redemptionKey, pendingRedemption: redemptionRequest } =
          multipleRedemptionsWithWitnessChange.pendingRedemptions[0]

        let tbtcContracts: MockTBTCContracts
        let bitcoinClient: MockBitcoinClient
        let redemptionsService: RedemptionsService

        beforeEach(async () => {
          tbtcContracts = new MockTBTCContracts()
          bitcoinClient = new MockBitcoinClient()

          const timedOutRedemptions = new Map<BigNumberish, RedemptionRequest>()
          timedOutRedemptions.set(redemptionKey, redemptionRequest)

          tbtcContracts.bridge.setTimedOutRedemptions(timedOutRedemptions)

          redemptionsService = new RedemptionsService(
            tbtcContracts,
            bitcoinClient
          )
        })

        it("should return the expected redemption request", async () => {
          const actualRedemptionRequest =
            await redemptionsService.getRedemptionRequests(
              BitcoinAddressConverter.outputScriptToAddress(
                redemptionRequest.redeemerOutputScript,
                BitcoinNetwork.Testnet
              ),
              walletPublicKey,
              "timedOut"
            )

          expect(actualRedemptionRequest).to.be.eql(redemptionRequest)
        })
      })
    })

    describe("findWalletForRedemption", () => {
      class TestRedemptionsService extends RedemptionsService {
        public async findWalletForRedemption(
          redeemerOutputScript: Hex,
          amount: BigNumber
        ): Promise<{
          walletPublicKey: Hex
          mainUtxo: BitcoinUtxo
        }> {
          return super.findWalletForRedemption(redeemerOutputScript, amount)
        }
      }

      let tbtcContracts: MockTBTCContracts
      let bitcoinClient: MockBitcoinClient
      let redemptionsService: TestRedemptionsService
      // script for testnet P2WSH address
      // tb1qau95mxzh2249aa3y8exx76ltc2sq0e7kw8hj04936rdcmnynhswqqz02vv
      const redeemerOutputScript = Hex.from(
        "0x220020ef0b4d985752aa5ef6243e4c6f6bebc2a007e7d671ef27d4b1d0db8dcc93bc1c"
      )

      context(
        "when there are no wallets in the network that can handle redemption",
        () => {
          const amount: BigNumber = BigNumber.from("1000000") // 0.01 BTC
          beforeEach(() => {
            bitcoinClient = new MockBitcoinClient()
            tbtcContracts = new MockTBTCContracts()
            tbtcContracts.bridge.newWalletRegisteredEvents = []
            redemptionsService = new TestRedemptionsService(
              tbtcContracts,
              bitcoinClient
            )
          })

          it("should throw an error", async () => {
            await expect(
              redemptionsService.findWalletForRedemption(
                redeemerOutputScript,
                amount
              )
            ).to.be.rejectedWith(
              "Currently, there are no live wallets in the network."
            )
          })
        }
      )

      context("when there are registered wallets in the network", () => {
        let result: Awaited<ReturnType<any> | never>
        const walletsOrder = [
          findWalletForRedemptionData.nonLiveWallet,
          findWalletForRedemptionData.walletWithoutUtxo,
          findWalletForRedemptionData.walletWithPendingRedemption,
          findWalletForRedemptionData.liveWallet,
        ]

        beforeEach(async () => {
          bitcoinClient = new MockBitcoinClient()
          tbtcContracts = new MockTBTCContracts()

          tbtcContracts.bridge.newWalletRegisteredEvents = walletsOrder.map(
            (wallet) => wallet.event
          )

          const walletsTransactionHistory = new Map<string, BitcoinTx[]>()

          walletsOrder.forEach((wallet) => {
            const {
              state,
              mainUtxoHash,
              walletPublicKey,
              btcAddress,
              transactions,
              pendingRedemptionsValue,
            } = wallet.data

            walletsTransactionHistory.set(btcAddress, transactions)
            tbtcContracts.bridge.setWallet(
              wallet.event.walletPublicKeyHash.toPrefixedString(),
              {
                state,
                mainUtxoHash,
                walletPublicKey,
                pendingRedemptionsValue,
              } as Wallet
            )
          })

          bitcoinClient.transactionHistory = walletsTransactionHistory

          redemptionsService = new TestRedemptionsService(
            tbtcContracts,
            bitcoinClient
          )
        })

        context(
          "when there is a wallet that can handle the redemption request",
          () => {
            const amount: BigNumber = BigNumber.from("1000000") // 0.01 BTC
            beforeEach(async () => {
              result = await redemptionsService.findWalletForRedemption(
                redeemerOutputScript,
                amount
              )
            })

            it("should get all registered wallets", () => {
              const bridgeQueryEventsLog =
                tbtcContracts.bridge.newWalletRegisteredEventsLog

              expect(bridgeQueryEventsLog.length).to.equal(1)
              expect(bridgeQueryEventsLog[0]).to.deep.equal({
                options: undefined,
                filterArgs: [],
              })
            })

            it("should return the wallet data that can handle redemption request", () => {
              const expectedWalletData =
                findWalletForRedemptionData.walletWithPendingRedemption.data

              expect(result).to.deep.eq({
                walletPublicKey: expectedWalletData.walletPublicKey,
                mainUtxo: expectedWalletData.mainUtxo,
              })
            })
          }
        )

        context(
          "when the redemption request amount is too large and no wallet can handle the request",
          () => {
            const amount = BigNumber.from("10000000000") // 1 000 BTC
            const expectedMaxAmount = walletsOrder
              .map((wallet) => wallet.data)
              .map((wallet) => wallet.mainUtxo)
              .map((utxo) => utxo.value)
              .sort((a, b) => (b.gt(a) ? 0 : -1))[0]

            it("should throw an error", async () => {
              await expect(
                redemptionsService.findWalletForRedemption(
                  redeemerOutputScript,
                  amount
                )
              ).to.be.rejectedWith(
                `Could not find a wallet with enough funds. Maximum redemption amount is ${expectedMaxAmount.toString()} Satoshi.`
              )
            })
          }
        )

        context(
          "when there is pending redemption request from a given wallet to the same address",
          () => {
            beforeEach(async () => {
              const redeemerOutputScript =
                findWalletForRedemptionData.pendingRedemption
                  .redeemerOutputScript
              const amount: BigNumber = BigNumber.from("1000000") // 0.01 BTC

              const walletPublicKeyHash =
                findWalletForRedemptionData.walletWithPendingRedemption.event
                  .walletPublicKeyHash

              const pendingRedemptions = new Map<
                BigNumberish,
                RedemptionRequest
              >()

              const key = MockBridge.buildRedemptionKey(
                walletPublicKeyHash,
                redeemerOutputScript
              )

              pendingRedemptions.set(
                key,
                findWalletForRedemptionData.pendingRedemption
              )
              tbtcContracts.bridge.setPendingRedemptions(pendingRedemptions)

              result = await redemptionsService.findWalletForRedemption(
                redeemerOutputScript,
                amount
              )
            })

            it("should get all registered wallets", () => {
              const bridgeQueryEventsLog =
                tbtcContracts.bridge.newWalletRegisteredEventsLog

              expect(bridgeQueryEventsLog.length).to.equal(1)
              expect(bridgeQueryEventsLog[0]).to.deep.equal({
                options: undefined,
                filterArgs: [],
              })
            })

            it("should skip the wallet for which there is a pending redemption request to the same redeemer output script and return the wallet data that can handle redemption request", () => {
              const expectedWalletData =
                findWalletForRedemptionData.liveWallet.data

              expect(result).to.deep.eq({
                walletPublicKey: expectedWalletData.walletPublicKey,
                mainUtxo: expectedWalletData.mainUtxo,
              })
            })
          }
        )

        context(
          "when wallet has pending redemptions and the requested amount is greater than possible",
          () => {
            beforeEach(async () => {
              const wallet =
                findWalletForRedemptionData.walletWithPendingRedemption
              const walletBTCBalance = wallet.data.mainUtxo.value

              const amount: BigNumber = walletBTCBalance
                .sub(wallet.data.pendingRedemptionsValue)
                .add(BigNumber.from(500000)) // 0.005 BTC

              console.log("amount", amount.toString())

              result = await redemptionsService.findWalletForRedemption(
                redeemerOutputScript,
                amount
              )
            })

            it("should skip the wallet wallet with pending redemptions and return the wallet data that can handle redemption request ", () => {
              const expectedWalletData =
                findWalletForRedemptionData.liveWallet.data

              expect(result).to.deep.eq({
                walletPublicKey: expectedWalletData.walletPublicKey,
                mainUtxo: expectedWalletData.mainUtxo,
              })
            })
          }
        )

        context(
          "when all active wallets has pending redemption for a given Bitcoin address",
          () => {
            const amount: BigNumber = BigNumber.from("1000000") // 0.01 BTC
            const redeemerOutputScript =
              findWalletForRedemptionData.pendingRedemption.redeemerOutputScript

            beforeEach(async () => {
              const walletPublicKeyHash =
                findWalletForRedemptionData.walletWithPendingRedemption.event
                  .walletPublicKeyHash

              const pendingRedemptions = new Map<
                BigNumberish,
                RedemptionRequest
              >()

              const pendingRedemption1 = MockBridge.buildRedemptionKey(
                walletPublicKeyHash,
                redeemerOutputScript
              )

              const pendingRedemption2 = MockBridge.buildRedemptionKey(
                findWalletForRedemptionData.liveWallet.event
                  .walletPublicKeyHash,
                redeemerOutputScript
              )

              pendingRedemptions.set(
                pendingRedemption1,
                findWalletForRedemptionData.pendingRedemption
              )

              pendingRedemptions.set(
                pendingRedemption2,
                findWalletForRedemptionData.pendingRedemption
              )
              tbtcContracts.bridge.setPendingRedemptions(pendingRedemptions)
            })

            it("should throw an error", async () => {
              await expect(
                redemptionsService.findWalletForRedemption(
                  redeemerOutputScript,
                  amount
                )
              ).to.be.rejectedWith(
                "All live wallets in the network have the pending redemption for a given Bitcoin address. Please use another Bitcoin address."
              )
            })
          }
        )
      })
    })

    describe("determineWalletMainUtxo", () => {
      class TestRedemptionsService extends RedemptionsService {
        public async determineWalletMainUtxo(
          walletPublicKeyHash: Hex,
          bitcoinNetwork: BitcoinNetwork
        ): Promise<BitcoinUtxo | undefined> {
          return super.determineWalletMainUtxo(
            walletPublicKeyHash,
            bitcoinNetwork
          )
        }
      }

      // Just an arbitrary 20-byte wallet public key hash.
      const walletPublicKeyHash = Hex.from(
        "e6f9d74726b19b75f16fe1e9feaec048aa4fa1d0"
      )

      // Helper function facilitating creation of mock transactions.
      const mockTransaction = (
        hash: string,
        outputs: Record<string, number> // key: locking script, value: amount of locked satoshis
      ): BitcoinTx => {
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
      const walletWitnessTransactionHistory: BitcoinTx[] = [
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
      const walletLegacyTransactionHistory: BitcoinTx[] = [
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

      let tbtcContracts: MockTBTCContracts
      let bitcoinClient: MockBitcoinClient
      let bitcoinNetwork: BitcoinNetwork
      let redemptionsService: TestRedemptionsService

      beforeEach(async () => {
        tbtcContracts = new MockTBTCContracts()
        bitcoinClient = new MockBitcoinClient()
        redemptionsService = new TestRedemptionsService(
          tbtcContracts,
          bitcoinClient
        )
      })

      context("when wallet main UTXO is not set in the Bridge", () => {
        beforeEach(async () => {
          tbtcContracts.bridge.setWallet(
            walletPublicKeyHash.toPrefixedString(),
            {
              mainUtxoHash: Hex.from(
                "0x0000000000000000000000000000000000000000000000000000000000000000"
              ),
            } as Wallet
          )
        })

        it("should return undefined", async () => {
          const mainUtxo = await redemptionsService.determineWalletMainUtxo(
            walletPublicKeyHash,
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

                  const walletWitnessAddress =
                    BitcoinAddressConverter.publicKeyHashToAddress(
                      walletPublicKeyHash,
                      true,
                      bitcoinNetwork
                    )
                  const walletLegacyAddress =
                    BitcoinAddressConverter.publicKeyHashToAddress(
                      walletPublicKeyHash,
                      false,
                      bitcoinNetwork
                    )

                  // Record the fake transaction history for both address types.
                  const transactionHistory = new Map<string, BitcoinTx[]>()
                  transactionHistory.set(
                    walletWitnessAddress,
                    walletWitnessTransactionHistory
                  )
                  transactionHistory.set(
                    walletLegacyAddress,
                    walletLegacyTransactionHistory
                  )
                  bitcoinClient.transactionHistory = transactionHistory

                  tbtcContracts.bridge.setWallet(
                    walletPublicKeyHash.toPrefixedString(),
                    {
                      mainUtxoHash:
                        tbtcContracts.bridge.buildUtxoHash(actualMainUtxo),
                    } as Wallet
                  )
                })

                it("should return the expected main UTXO", async () => {
                  const mainUtxo =
                    await redemptionsService.determineWalletMainUtxo(
                      walletPublicKeyHash,
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
})

export async function runRedemptionScenario(
  walletPrivKey: string,
  bitcoinClient: MockBitcoinClient,
  tbtcContracts: MockTBTCContracts,
  data: RedemptionTestData
): Promise<{
  transactionHash: BitcoinTxHash
  newMainUtxo?: BitcoinUtxo
}> {
  const rawTransactions = new Map<string, BitcoinRawTx>()
  rawTransactions.set(data.mainUtxo.transactionHash.toString(), {
    transactionHex: data.mainUtxo.transactionHex,
  })
  bitcoinClient.rawTransactions = rawTransactions

  tbtcContracts.bridge.setPendingRedemptions(
    new Map<BigNumberish, RedemptionRequest>(
      data.pendingRedemptions.map((redemption) => [
        redemption.redemptionKey,
        redemption.pendingRedemption,
      ])
    )
  )

  const redeemerOutputScripts = data.pendingRedemptions.map(
    (redemption) => redemption.pendingRedemption.redeemerOutputScript
  )

  const walletTx = new WalletTx(tbtcContracts, bitcoinClient, data.witness)

  return walletTx.redemption.submitTransaction(
    walletPrivKey,
    data.mainUtxo,
    redeemerOutputScripts
  )
}
