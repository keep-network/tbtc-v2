import {
  BitcoinAddressConverter,
  BitcoinHashUtils,
  BitcoinNetwork,
  BitcoinRawTx,
  BitcoinTx,
  BitcoinTxHash,
  BitcoinUtxo,
  NewWalletRegisteredEvent,
  RedemptionRequest,
  Wallet,
  WalletState,
  RedemptionsService,
  WalletTx,
  MaintenanceService,
} from "../src"
import bcoin from "bcoin"
import { MockBitcoinClient } from "./utils/mock-bitcoin-client"
import {
  findWalletForRedemptionData,
  multipleRedemptionsWithoutChange,
  multipleRedemptionsWithWitnessChange,
  p2pkhWalletAddress,
  p2wpkhWalletAddress,
  redemptionProof,
  RedemptionTestData,
  singleP2PKHRedemptionWithWitnessChange,
  singleP2SHRedemptionWithNonWitnessChange,
  singleP2SHRedemptionWithWitnessChange,
  singleP2WPKHRedemptionWithWitnessChange,
  singleP2WSHRedemptionWithWitnessChange,
  walletPrivateKey,
  walletPublicKey,
} from "./data/redemption"
import { MockBridge } from "./utils/mock-bridge"
import * as chai from "chai"
import { expect } from "chai"
import chaiAsPromised from "chai-as-promised"
import { BigNumber, BigNumberish } from "ethers"
import { MockTBTCContracts } from "./utils/mock-tbtc-contracts"
import { Hex } from "../src"

chai.use(chaiAsPromised)

describe("Redemption", () => {
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
        bcoin.set("testnet")

        tbtcContracts = new MockTBTCContracts()
        bitcoinClient = new MockBitcoinClient()

        const walletPublicKeyHash = Hex.from(
          BitcoinHashUtils.computeHash160(walletPublicKey)
        )

        // Prepare NewWalletRegisteredEvent history. Set only relevant fields.
        tbtcContracts.bridge.newWalletRegisteredEvents = [
          {
            walletPublicKeyHash: walletPublicKeyHash,
          } as NewWalletRegisteredEvent,
        ]

        // Prepare wallet data in the Bridge. Set only relevant fields.
        tbtcContracts.bridge.setWallet(walletPublicKeyHash.toPrefixedString(), {
          state: WalletState.Live,
          walletPublicKey: Hex.from(walletPublicKey),
          pendingRedemptionsValue: BigNumber.from(0),
          mainUtxoHash: tbtcContracts.bridge.buildUtxoHash(mainUtxo),
        } as Wallet)

        const walletAddress = BitcoinAddressConverter.publicKeyHashToAddress(
          walletPublicKeyHash.toString(),
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
                scriptPubKey:
                  BitcoinAddressConverter.addressToOutputScript(walletAddress),
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
            Hex.from(redeemerOutputScript),
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
                Hex.from(redemptionRequest.redeemerOutputScript),
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
                Hex.from(redemptionRequest.redeemerOutputScript),
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
          redeemerOutputScript: string,
          amount: BigNumber
        ): Promise<{
          walletPublicKey: string
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
      const redeemerOutputScript =
        "0x220020ef0b4d985752aa5ef6243e4c6f6bebc2a007e7d671ef27d4b1d0db8dcc93bc1c"

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
                walletPublicKey: expectedWalletData.walletPublicKey.toString(),
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
                walletPublicKeyHash.toString(),
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
                walletPublicKey: expectedWalletData.walletPublicKey.toString(),
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
                walletPublicKey: expectedWalletData.walletPublicKey.toString(),
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
                walletPublicKeyHash.toString(),
                redeemerOutputScript
              )

              const pendingRedemption2 = MockBridge.buildRedemptionKey(
                findWalletForRedemptionData.liveWallet.event.walletPublicKeyHash.toString(),
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
                      walletPublicKeyHash.toString(),
                      true,
                      bitcoinNetwork
                    )
                  const walletLegacyAddress =
                    BitcoinAddressConverter.publicKeyHashToAddress(
                      walletPublicKeyHash.toString(),
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

  describe("WalletTx", () => {
    describe("Redemption", () => {
      describe("submitTransaction", () => {
        let tbtcContracts: MockTBTCContracts
        let bitcoinClient: MockBitcoinClient

        beforeEach(async () => {
          bcoin.set("testnet")

          tbtcContracts = new MockTBTCContracts()
          bitcoinClient = new MockBitcoinClient()
        })

        context("when there are redemption requests provided", () => {
          context(
            "when all redeemer output scripts identify pending redemptions",
            () => {
              context("when there is a change created", () => {
                context("when the change output is P2WPKH", () => {
                  context("when there is a single redeemer", () => {
                    context(
                      "when the redeemer output script is derived from a P2PKH address",
                      () => {
                        const data: RedemptionTestData =
                          singleP2PKHRedemptionWithWitnessChange

                        let transactionHash: BitcoinTxHash
                        let newMainUtxo: BitcoinUtxo | undefined

                        beforeEach(async () => {
                          ;({ transactionHash, newMainUtxo } =
                            await runRedemptionScenario(
                              walletPrivateKey,
                              bitcoinClient,
                              tbtcContracts,
                              data
                            ))
                        })

                        it("should broadcast redemption transaction with proper structure", () => {
                          expect(bitcoinClient.broadcastLog.length).to.be.equal(
                            1
                          )
                          expect(bitcoinClient.broadcastLog[0]).to.be.eql(
                            data.expectedRedemption.transaction
                          )
                        })

                        it("should return the proper transaction hash", async () => {
                          expect(transactionHash).to.be.deep.equal(
                            data.expectedRedemption.transactionHash
                          )
                        })

                        it("should return the proper new main UTXO", () => {
                          const expectedNewMainUtxo = {
                            transactionHash:
                              data.expectedRedemption.transactionHash,
                            outputIndex: 1,
                            value: BigNumber.from(1472680),
                          }

                          expect(newMainUtxo).to.be.eql(expectedNewMainUtxo)
                        })
                      }
                    )

                    context(
                      "when the redeemer output script is derived from a P2WPKH address",
                      () => {
                        const data: RedemptionTestData =
                          singleP2WPKHRedemptionWithWitnessChange

                        let transactionHash: BitcoinTxHash
                        let newMainUtxo: BitcoinUtxo | undefined

                        beforeEach(async () => {
                          ;({ transactionHash, newMainUtxo } =
                            await runRedemptionScenario(
                              walletPrivateKey,
                              bitcoinClient,
                              tbtcContracts,
                              data
                            ))
                        })

                        it("should broadcast redemption transaction with proper structure", () => {
                          expect(bitcoinClient.broadcastLog.length).to.be.equal(
                            1
                          )
                          expect(bitcoinClient.broadcastLog[0]).to.be.eql(
                            data.expectedRedemption.transaction
                          )
                        })

                        it("should return the proper transaction hash", async () => {
                          expect(transactionHash).to.be.deep.equal(
                            data.expectedRedemption.transactionHash
                          )
                        })

                        it("should return the proper new main UTXO", () => {
                          const expectedNewMainUtxo = {
                            transactionHash:
                              data.expectedRedemption.transactionHash,
                            outputIndex: 1,
                            value: BigNumber.from(1458780),
                          }

                          expect(newMainUtxo).to.be.eql(expectedNewMainUtxo)
                        })
                      }
                    )

                    context(
                      "when the redeemer output script is derived from a P2SH address",
                      () => {
                        const data: RedemptionTestData =
                          singleP2SHRedemptionWithWitnessChange

                        let transactionHash: BitcoinTxHash
                        let newMainUtxo: BitcoinUtxo | undefined

                        beforeEach(async () => {
                          ;({ transactionHash, newMainUtxo } =
                            await runRedemptionScenario(
                              walletPrivateKey,
                              bitcoinClient,
                              tbtcContracts,
                              data
                            ))
                        })

                        it("should broadcast redemption transaction with proper structure", () => {
                          expect(bitcoinClient.broadcastLog.length).to.be.equal(
                            1
                          )
                          expect(bitcoinClient.broadcastLog[0]).to.be.eql(
                            data.expectedRedemption.transaction
                          )
                        })

                        it("should return the proper transaction hash", async () => {
                          expect(transactionHash).to.be.deep.equal(
                            data.expectedRedemption.transactionHash
                          )
                        })

                        it("should return the proper new main UTXO", () => {
                          const expectedNewMainUtxo = {
                            transactionHash:
                              data.expectedRedemption.transactionHash,
                            outputIndex: 1,
                            value: BigNumber.from(1446580),
                          }

                          expect(newMainUtxo).to.be.eql(expectedNewMainUtxo)
                        })
                      }
                    )

                    context(
                      "when the redeemer output script is derived from a P2WSH address",
                      () => {
                        const data: RedemptionTestData =
                          singleP2WSHRedemptionWithWitnessChange

                        let transactionHash: BitcoinTxHash
                        let newMainUtxo: BitcoinUtxo | undefined

                        beforeEach(async () => {
                          ;({ transactionHash, newMainUtxo } =
                            await runRedemptionScenario(
                              walletPrivateKey,
                              bitcoinClient,
                              tbtcContracts,
                              data
                            ))
                        })

                        it("should broadcast redemption transaction with proper structure", () => {
                          expect(bitcoinClient.broadcastLog.length).to.be.equal(
                            1
                          )
                          expect(bitcoinClient.broadcastLog[0]).to.be.eql(
                            data.expectedRedemption.transaction
                          )
                        })

                        it("should return the proper transaction hash", async () => {
                          expect(transactionHash).to.be.deep.equal(
                            data.expectedRedemption.transactionHash
                          )
                        })

                        it("should return the proper new main UTXO", () => {
                          const expectedNewMainUtxo = {
                            transactionHash:
                              data.expectedRedemption.transactionHash,
                            outputIndex: 1,
                            value: BigNumber.from(1429580),
                          }

                          expect(newMainUtxo).to.be.eql(expectedNewMainUtxo)
                        })
                      }
                    )
                  })

                  context("when there are multiple redeemers", () => {
                    const data: RedemptionTestData =
                      multipleRedemptionsWithWitnessChange

                    let transactionHash: BitcoinTxHash
                    let newMainUtxo: BitcoinUtxo | undefined

                    beforeEach(async () => {
                      ;({ transactionHash, newMainUtxo } =
                        await runRedemptionScenario(
                          walletPrivateKey,
                          bitcoinClient,
                          tbtcContracts,
                          data
                        ))
                    })

                    it("should broadcast redemption transaction with proper structure", () => {
                      expect(bitcoinClient.broadcastLog.length).to.be.equal(1)
                      expect(bitcoinClient.broadcastLog[0]).to.be.eql(
                        data.expectedRedemption.transaction
                      )
                    })

                    it("should return the proper transaction hash", async () => {
                      expect(transactionHash).to.be.deep.equal(
                        data.expectedRedemption.transactionHash
                      )
                    })

                    it("should return the proper new main UTXO", () => {
                      const expectedNewMainUtxo = {
                        transactionHash:
                          data.expectedRedemption.transactionHash,
                        outputIndex: 4,
                        value: BigNumber.from(1375180),
                      }

                      expect(newMainUtxo).to.be.eql(expectedNewMainUtxo)
                    })
                  })
                })

                context("when the change output is P2PKH", () => {
                  // The only difference between redemption transactions with P2PKH and
                  // P2WPKH change is the output type.
                  // Therefore only one test case was added for P2PKH transactions.
                  const data: RedemptionTestData =
                    singleP2SHRedemptionWithNonWitnessChange

                  let transactionHash: BitcoinTxHash
                  let newMainUtxo: BitcoinUtxo | undefined

                  beforeEach(async () => {
                    ;({ transactionHash, newMainUtxo } =
                      await runRedemptionScenario(
                        walletPrivateKey,
                        bitcoinClient,
                        tbtcContracts,
                        data
                      ))
                  })

                  it("should broadcast redemption transaction with proper structure", () => {
                    expect(bitcoinClient.broadcastLog.length).to.be.equal(1)
                    expect(bitcoinClient.broadcastLog[0]).to.be.eql(
                      data.expectedRedemption.transaction
                    )
                  })

                  it("should return the proper transaction hash", async () => {
                    expect(transactionHash).to.be.deep.equal(
                      data.expectedRedemption.transactionHash
                    )
                  })

                  it("should return the proper new main UTXO", () => {
                    const expectedNewMainUtxo = {
                      transactionHash: data.expectedRedemption.transactionHash,
                      outputIndex: 1,
                      value: BigNumber.from(1364180),
                    }

                    expect(newMainUtxo).to.be.eql(expectedNewMainUtxo)
                  })
                })
              })

              context("when there is no change UTXO created", () => {
                // Use test data with the treasury fees of all the redemption requests
                // set to 0. This is the only situation that the redemption transaction
                // will not contain the change output.
                const data: RedemptionTestData =
                  multipleRedemptionsWithoutChange

                let transactionHash: BitcoinTxHash
                let newMainUtxo: BitcoinUtxo | undefined

                beforeEach(async () => {
                  ;({ transactionHash, newMainUtxo } =
                    await runRedemptionScenario(
                      walletPrivateKey,
                      bitcoinClient,
                      tbtcContracts,
                      data
                    ))
                })

                it("should broadcast redemption transaction with proper structure", () => {
                  expect(bitcoinClient.broadcastLog.length).to.be.equal(1)
                  expect(bitcoinClient.broadcastLog[0]).to.be.eql(
                    data.expectedRedemption.transaction
                  )
                })

                it("should return the proper transaction hash", async () => {
                  expect(transactionHash).to.be.deep.equal(
                    data.expectedRedemption.transactionHash
                  )
                })

                it("should not return the new main UTXO", () => {
                  expect(newMainUtxo).to.be.undefined
                })
              })
            }
          )

          context(
            "when not all redeemer output scripts identify pending redemptions",
            () => {
              const data: RedemptionTestData =
                multipleRedemptionsWithWitnessChange

              beforeEach(async () => {
                const rawTransactions = new Map<string, BitcoinRawTx>()
                rawTransactions.set(data.mainUtxo.transactionHash.toString(), {
                  transactionHex: data.mainUtxo.transactionHex,
                })
                bitcoinClient.rawTransactions = rawTransactions

                const pendingRedemptions = new Map<
                  BigNumberish,
                  RedemptionRequest
                >(
                  data.pendingRedemptions.map((redemption) => [
                    redemption.redemptionKey,
                    redemption.pendingRedemption,
                  ])
                )

                // Before setting the pending redemption map in the Bridge, delete
                // one element to simulate absence of that redemption
                pendingRedemptions.delete(
                  data.pendingRedemptions[2].redemptionKey
                )
                tbtcContracts.bridge.setPendingRedemptions(pendingRedemptions)
              })

              it("should revert", async () => {
                const redeemerOutputScripts = data.pendingRedemptions.map(
                  (redemption) =>
                    redemption.pendingRedemption.redeemerOutputScript
                )

                const walletTx = new WalletTx(
                  tbtcContracts,
                  bitcoinClient,
                  data.witness
                )

                await expect(
                  walletTx.redemption.submitTransaction(
                    walletPrivateKey,
                    data.mainUtxo,
                    redeemerOutputScripts
                  )
                ).to.be.rejectedWith("Redemption request does not exist")
              })
            }
          )
        })

        context("when there are no redemption requests provided", () => {
          const data: RedemptionTestData =
            singleP2WPKHRedemptionWithWitnessChange

          beforeEach(async () => {
            const rawTransactions = new Map<string, BitcoinRawTx>()
            rawTransactions.set(data.mainUtxo.transactionHash.toString(), {
              transactionHex: data.mainUtxo.transactionHex,
            })
            bitcoinClient.rawTransactions = rawTransactions
          })

          it("should revert", async () => {
            const walletTx = new WalletTx(
              tbtcContracts,
              bitcoinClient,
              data.witness
            )

            await expect(
              walletTx.redemption.submitTransaction(
                walletPrivateKey,
                data.mainUtxo,
                [] // empty redeemer output script list
              )
            ).to.be.rejectedWith("There must be at least one request to redeem")
          })
        })
      })

      describe("assembleTransaction", () => {
        let tbtcContracts: MockTBTCContracts
        let bitcoinClient: MockBitcoinClient

        beforeEach(async () => {
          tbtcContracts = new MockTBTCContracts()
          bitcoinClient = new MockBitcoinClient()
        })

        context("when there are redemption requests provided", () => {
          context("when there is a change UTXO created", () => {
            describe("when the change output is P2WPKH", () => {
              context("when there is a single redeemer", () => {
                context(
                  "when the redeemer output script is derived from a P2PKH address",
                  () => {
                    const data: RedemptionTestData =
                      singleP2PKHRedemptionWithWitnessChange

                    let transactionHash: BitcoinTxHash
                    let newMainUtxo: BitcoinUtxo | undefined
                    let transaction: BitcoinRawTx

                    beforeEach(async () => {
                      const redemptionRequests = data.pendingRedemptions.map(
                        (redemption) => redemption.pendingRedemption
                      )

                      const walletTx = new WalletTx(
                        tbtcContracts,
                        bitcoinClient,
                        data.witness
                      )

                      ;({
                        transactionHash,
                        newMainUtxo,
                        rawTransaction: transaction,
                      } = await walletTx.redemption.assembleTransaction(
                        walletPrivateKey,
                        data.mainUtxo,
                        redemptionRequests
                      ))
                    })

                    it("should return transaction with proper structure", async () => {
                      // Compare HEXes.
                      expect(transaction).to.be.eql(
                        data.expectedRedemption.transaction
                      )

                      // Convert raw transaction to JSON to make detailed comparison.
                      const buffer = Buffer.from(
                        transaction.transactionHex,
                        "hex"
                      )
                      const txJSON = bcoin.TX.fromRaw(buffer).getJSON("testnet")

                      expect(txJSON.hash).to.be.equal(
                        data.expectedRedemption.transactionHash.toString()
                      )
                      expect(txJSON.version).to.be.equal(1)

                      // Validate inputs.
                      expect(txJSON.inputs.length).to.be.equal(1)

                      const input = txJSON.inputs[0]

                      expect(input.prevout.hash).to.be.equal(
                        data.mainUtxo.transactionHash.toString()
                      )
                      expect(input.prevout.index).to.be.equal(
                        data.mainUtxo.outputIndex
                      )
                      // Transaction should be signed but this is SegWit input so the `script`
                      // field should be empty and the `witness` field should be filled instead.
                      expect(input.script.length).to.be.equal(0)
                      expect(input.witness.length).to.be.greaterThan(0)
                      expect(input.address).to.be.equal(p2wpkhWalletAddress)

                      // Validate outputs.
                      expect(txJSON.outputs.length).to.be.equal(2)

                      const p2pkhOutput = txJSON.outputs[0]
                      const changeOutput = txJSON.outputs[1]

                      // P2PKH output
                      // The output value should be `requestedAmount` - `txFee` - `treasuryFee`
                      // which is 10000 - 1600 - 1000 = 7400
                      expect(p2pkhOutput.value).to.be.equal(7400)
                      // The output script should correspond to:
                      // OP_DUP OP_HASH160 0x14 0x4130879211c54df460e484ddf9aac009cb38ee74
                      // OP_EQUALVERIFY OP_CHECKSIG
                      expect(p2pkhOutput.script).to.be.equal(
                        "76a9144130879211c54df460e484ddf9aac009cb38ee7488ac"
                      )
                      // The output address should be P2PKH
                      expect(p2pkhOutput.address).to.be.equal(
                        "mmTeMR8RKu6QzMGTG4ipA71uewm3EuJng5"
                      )

                      // P2WPKH output (change)
                      // The value of fee should be the fee share of the (only) redeem output
                      // which is 1600
                      // The output value should be main UTXO input value - fee - the
                      // value of the output, which is 1472680 = 1481680 - 1600 - 7400
                      expect(changeOutput.value).to.be.equal(1472680)
                      // The output script should correspond to:
                      // OP_0 0x14 0x8db50eb52063ea9d98b3eac91489a90f738986f6
                      expect(changeOutput.script).to.be.equal(
                        "00148db50eb52063ea9d98b3eac91489a90f738986f6"
                      )
                      // The change output address should be the P2WPKH address of the wallet
                      expect(changeOutput.address).to.be.equal(
                        p2wpkhWalletAddress
                      )
                    })

                    it("should return the proper transaction hash", async () => {
                      expect(transactionHash).to.be.deep.equal(
                        data.expectedRedemption.transactionHash
                      )
                    })

                    it("should return the proper new main UTXO", () => {
                      const expectedNewMainUtxo = {
                        transactionHash:
                          data.expectedRedemption.transactionHash,
                        outputIndex: 1,
                        value: BigNumber.from(1472680),
                      }

                      expect(newMainUtxo).to.be.eql(expectedNewMainUtxo)
                    })
                  }
                )

                context(
                  "when the redeemer output script is derived from a P2WPKH address",
                  () => {
                    const data: RedemptionTestData =
                      singleP2WPKHRedemptionWithWitnessChange

                    let transactionHash: BitcoinTxHash
                    let newMainUtxo: BitcoinUtxo | undefined
                    let transaction: BitcoinRawTx

                    beforeEach(async () => {
                      const redemptionRequests = data.pendingRedemptions.map(
                        (redemption) => redemption.pendingRedemption
                      )

                      const walletTx = new WalletTx(
                        tbtcContracts,
                        bitcoinClient,
                        data.witness
                      )

                      ;({
                        transactionHash,
                        newMainUtxo,
                        rawTransaction: transaction,
                      } = await walletTx.redemption.assembleTransaction(
                        walletPrivateKey,
                        data.mainUtxo,
                        redemptionRequests
                      ))
                    })

                    it("should return transaction with proper structure", async () => {
                      // Compare HEXes.
                      expect(transaction).to.be.eql(
                        data.expectedRedemption.transaction
                      )

                      // Convert raw transaction to JSON to make detailed comparison.
                      const buffer = Buffer.from(
                        transaction.transactionHex,
                        "hex"
                      )
                      const txJSON = bcoin.TX.fromRaw(buffer).getJSON("testnet")

                      expect(txJSON.hash).to.be.equal(
                        data.expectedRedemption.transactionHash.toString()
                      )
                      expect(txJSON.version).to.be.equal(1)

                      // Validate inputs.
                      expect(txJSON.inputs.length).to.be.equal(1)

                      const input = txJSON.inputs[0]

                      expect(input.prevout.hash).to.be.equal(
                        data.mainUtxo.transactionHash.toString()
                      )
                      expect(input.prevout.index).to.be.equal(
                        data.mainUtxo.outputIndex
                      )
                      // Transaction should be signed but this is SegWit input so the `script`
                      // field should be empty and the `witness` field should be filled instead.
                      expect(input.script.length).to.be.equal(0)
                      expect(input.witness.length).to.be.greaterThan(0)
                      expect(input.address).to.be.equal(p2wpkhWalletAddress)

                      // Validate outputs.
                      expect(txJSON.outputs.length).to.be.equal(2)

                      const p2wpkhOutput = txJSON.outputs[0]
                      const changeOutput = txJSON.outputs[1]

                      // P2WPKH output
                      // The output value should be `requestedAmount` - `txFee` - `treasuryFee`
                      // which is 15000 - 1700 - 1100 = 12200
                      expect(p2wpkhOutput.value).to.be.equal(12200)
                      // The output script should correspond to:
                      // OP_0 0x14 0x4130879211c54df460e484ddf9aac009cb38ee74
                      expect(p2wpkhOutput.script).to.be.equal(
                        "00144130879211c54df460e484ddf9aac009cb38ee74"
                      )
                      // The output address should be P2WPKH
                      expect(p2wpkhOutput.address).to.be.equal(
                        "tb1qgycg0ys3c4xlgc8ysnwln2kqp89n3mn5ts7z3l"
                      )

                      // P2WPKH output (change)
                      // The value of fee should be the fee share of the (only) redeem output
                      // which is 1700
                      // The output value should be main UTXO input value - fee - the
                      // value of the output, which is 1458780 = 1472680 - 1700 - 12200
                      expect(changeOutput.value).to.be.equal(1458780)
                      // The output script should correspond to:
                      // OP_0 0x14 0x8db50eb52063ea9d98b3eac91489a90f738986f6
                      expect(changeOutput.script).to.be.equal(
                        "00148db50eb52063ea9d98b3eac91489a90f738986f6"
                      )
                      // The change output address should be the P2WPKH address of the wallet
                      expect(changeOutput.address).to.be.equal(
                        p2wpkhWalletAddress
                      )
                    })

                    it("should return the proper transaction hash", async () => {
                      expect(transactionHash).to.be.deep.equal(
                        data.expectedRedemption.transactionHash
                      )
                    })

                    it("should return the proper new main UTXO", () => {
                      const expectedNewMainUtxo = {
                        transactionHash:
                          data.expectedRedemption.transactionHash,
                        outputIndex: 1,
                        value: BigNumber.from(1458780),
                      }

                      expect(newMainUtxo).to.be.eql(expectedNewMainUtxo)
                    })
                  }
                )

                context(
                  "when the redeemer output script is derived from a P2SH address",
                  () => {
                    const data: RedemptionTestData =
                      singleP2SHRedemptionWithWitnessChange

                    let transactionHash: BitcoinTxHash
                    let newMainUtxo: BitcoinUtxo | undefined
                    let transaction: BitcoinRawTx

                    beforeEach(async () => {
                      const redemptionRequests = data.pendingRedemptions.map(
                        (redemption) => redemption.pendingRedemption
                      )

                      const walletTx = new WalletTx(
                        tbtcContracts,
                        bitcoinClient,
                        data.witness
                      )

                      ;({
                        transactionHash,
                        newMainUtxo,
                        rawTransaction: transaction,
                      } = await walletTx.redemption.assembleTransaction(
                        walletPrivateKey,
                        data.mainUtxo,
                        redemptionRequests
                      ))
                    })

                    it("should return transaction with proper structure", async () => {
                      // Compare HEXes.
                      expect(transaction).to.be.eql(
                        data.expectedRedemption.transaction
                      )

                      // Convert raw transaction to JSON to make detailed comparison.
                      const buffer = Buffer.from(
                        transaction.transactionHex,
                        "hex"
                      )
                      const txJSON = bcoin.TX.fromRaw(buffer).getJSON("testnet")

                      expect(txJSON.hash).to.be.equal(
                        data.expectedRedemption.transactionHash.toString()
                      )
                      expect(txJSON.version).to.be.equal(1)

                      // Validate inputs.
                      expect(txJSON.inputs.length).to.be.equal(1)

                      const input = txJSON.inputs[0]

                      expect(input.prevout.hash).to.be.equal(
                        data.mainUtxo.transactionHash.toString()
                      )
                      expect(input.prevout.index).to.be.equal(
                        data.mainUtxo.outputIndex
                      )
                      // Transaction should be signed but this is SegWit input so the `script`
                      // field should be empty and the `witness` field should be filled instead.
                      expect(input.script.length).to.be.equal(0)
                      expect(input.witness.length).to.be.greaterThan(0)
                      expect(input.address).to.be.equal(p2wpkhWalletAddress)

                      // Validate outputs.
                      expect(txJSON.outputs.length).to.be.equal(2)

                      const p2shOutput = txJSON.outputs[0]
                      const changeOutput = txJSON.outputs[1]

                      // P2SH output
                      // The output value should be `requestedAmount` - `txFee` - `treasuryFee`
                      // which is 13000 - 1700 - 800 = 10500
                      expect(p2shOutput.value).to.be.equal(10500)
                      // The output script should correspond to:
                      // OP_HASH160 0x14 0x3ec459d0f3c29286ae5df5fcc421e2786024277e OP_EQUAL
                      expect(p2shOutput.script).to.be.equal(
                        "a9143ec459d0f3c29286ae5df5fcc421e2786024277e87"
                      )
                      // The output address should be P2SH
                      expect(p2shOutput.address).to.be.equal(
                        "2Mxy76sc1qAxiJ1fXMXDXqHvVcPLh6Lf12C"
                      )

                      // P2WPKH output (change)
                      // The value of fee should be the fee share of the (only) redeem output
                      // which is 1700
                      // The output value should be main UTXO input value - fee - the
                      // value of the output, which is 1446580 = 1458780 - 1700 - 10500
                      expect(changeOutput.value).to.be.equal(1446580)
                      // The output script should correspond to:
                      // OP_0 0x14 0x8db50eb52063ea9d98b3eac91489a90f738986f6
                      expect(changeOutput.script).to.be.equal(
                        "00148db50eb52063ea9d98b3eac91489a90f738986f6"
                      )
                      // The change output address should be the P2WPKH address of the wallet
                      expect(changeOutput.address).to.be.equal(
                        p2wpkhWalletAddress
                      )
                    })

                    it("should return the proper transaction hash", async () => {
                      expect(transactionHash).to.be.deep.equal(
                        data.expectedRedemption.transactionHash
                      )
                    })

                    it("should return the proper new main UTXO", () => {
                      const expectedNewMainUtxo = {
                        transactionHash:
                          data.expectedRedemption.transactionHash,
                        outputIndex: 1,
                        value: BigNumber.from(1446580),
                      }

                      expect(newMainUtxo).to.be.eql(expectedNewMainUtxo)
                    })
                  }
                )

                context(
                  "when the redeemer output script is derived from a P2WSH address",
                  () => {
                    const data: RedemptionTestData =
                      singleP2WSHRedemptionWithWitnessChange

                    let transactionHash: BitcoinTxHash
                    let newMainUtxo: BitcoinUtxo | undefined
                    let transaction: BitcoinRawTx

                    beforeEach(async () => {
                      const redemptionRequests = data.pendingRedemptions.map(
                        (redemption) => redemption.pendingRedemption
                      )

                      const walletTx = new WalletTx(
                        tbtcContracts,
                        bitcoinClient,
                        data.witness
                      )

                      ;({
                        transactionHash,
                        newMainUtxo,
                        rawTransaction: transaction,
                      } = await walletTx.redemption.assembleTransaction(
                        walletPrivateKey,
                        data.mainUtxo,
                        redemptionRequests
                      ))
                    })

                    it("should return transaction with proper structure", async () => {
                      // Compare HEXes.
                      expect(transaction).to.be.eql(
                        data.expectedRedemption.transaction
                      )

                      // Convert raw transaction to JSON to make detailed comparison.
                      const buffer = Buffer.from(
                        transaction.transactionHex,
                        "hex"
                      )
                      const txJSON = bcoin.TX.fromRaw(buffer).getJSON("testnet")

                      expect(txJSON.hash).to.be.equal(
                        data.expectedRedemption.transactionHash.toString()
                      )
                      expect(txJSON.version).to.be.equal(1)

                      // Validate inputs.
                      expect(txJSON.inputs.length).to.be.equal(1)

                      const input = txJSON.inputs[0]

                      expect(input.prevout.hash).to.be.equal(
                        data.mainUtxo.transactionHash.toString()
                      )
                      expect(input.prevout.index).to.be.equal(
                        data.mainUtxo.outputIndex
                      )
                      // Transaction should be signed but this is SegWit input so the `script`
                      // field should be empty and the `witness` field should be filled instead.
                      expect(input.script.length).to.be.equal(0)
                      expect(input.witness.length).to.be.greaterThan(0)
                      expect(input.address).to.be.equal(p2wpkhWalletAddress)

                      // Validate outputs.
                      expect(txJSON.outputs.length).to.be.equal(2)

                      const p2wshOutput = txJSON.outputs[0]
                      const changeOutput = txJSON.outputs[1]

                      // P2WSH output
                      // The output value should be `requestedAmount` - `txFee` - `treasuryFee`
                      // which is 18000 - 1400 - 1000 = 15600
                      expect(p2wshOutput.value).to.be.equal(15600)
                      // The output script should correspond to:
                      // OP_0 0x20 0x86a303cdd2e2eab1d1679f1a813835dc5a1b65321077cdccaf08f98cbf04ca96
                      expect(p2wshOutput.script).to.be.equal(
                        "002086a303cdd2e2eab1d1679f1a813835dc5a1b65321077cdccaf08f98cbf04ca96"
                      )
                      // The output address should be P2WSH
                      expect(p2wshOutput.address).to.be.equal(
                        "tb1qs63s8nwjut4tr5t8nudgzwp4m3dpkefjzpmumn90pruce0cye2tq2jkq0y"
                      )

                      // P2WPKH output (change)
                      // The value of fee should be the fee share of the (only) redeem output
                      // which is 1400
                      // The output value should be main UTXO input value - fee - the
                      // value of the output, which is 1429580 = 1446580 - 1400 - 15600
                      expect(changeOutput.value).to.be.equal(1429580)
                      // The output script should correspond to:
                      // OP_0 0x14 0x8db50eb52063ea9d98b3eac91489a90f738986f6
                      expect(changeOutput.script).to.be.equal(
                        "00148db50eb52063ea9d98b3eac91489a90f738986f6"
                      )
                      // The change output address should be the P2WPKH address of the wallet
                      expect(changeOutput.address).to.be.equal(
                        p2wpkhWalletAddress
                      )
                    })

                    it("should return the proper transaction hash", async () => {
                      expect(transactionHash).to.be.deep.equal(
                        data.expectedRedemption.transactionHash
                      )
                    })

                    it("should return the proper new main UTXO", () => {
                      const expectedNewMainUtxo = {
                        transactionHash:
                          data.expectedRedemption.transactionHash,
                        outputIndex: 1,
                        value: BigNumber.from(1429580),
                      }

                      expect(newMainUtxo).to.be.eql(expectedNewMainUtxo)
                    })
                  }
                )
              })

              context("when there are multiple redeemers", () => {
                const data: RedemptionTestData =
                  multipleRedemptionsWithWitnessChange

                let transactionHash: BitcoinTxHash
                let newMainUtxo: BitcoinUtxo | undefined
                let transaction: BitcoinRawTx

                beforeEach(async () => {
                  const redemptionRequests = data.pendingRedemptions.map(
                    (redemption) => redemption.pendingRedemption
                  )

                  const walletTx = new WalletTx(
                    tbtcContracts,
                    bitcoinClient,
                    data.witness
                  )

                  ;({
                    transactionHash,
                    newMainUtxo,
                    rawTransaction: transaction,
                  } = await walletTx.redemption.assembleTransaction(
                    walletPrivateKey,
                    data.mainUtxo,
                    redemptionRequests
                  ))
                })

                it("should return transaction with proper structure", async () => {
                  // Compare HEXes.
                  expect(transaction).to.be.eql(
                    data.expectedRedemption.transaction
                  )

                  // Convert raw transaction to JSON to make detailed comparison.
                  const buffer = Buffer.from(transaction.transactionHex, "hex")
                  const txJSON = bcoin.TX.fromRaw(buffer).getJSON("testnet")

                  expect(txJSON.hash).to.be.equal(
                    data.expectedRedemption.transactionHash.toString()
                  )
                  expect(txJSON.version).to.be.equal(1)

                  // Validate inputs.
                  expect(txJSON.inputs.length).to.be.equal(1)

                  const input = txJSON.inputs[0]

                  expect(input.prevout.hash).to.be.equal(
                    data.mainUtxo.transactionHash.toString()
                  )
                  expect(input.prevout.index).to.be.equal(
                    data.mainUtxo.outputIndex
                  )
                  // Transaction should be signed but this is SegWit input so the `script`
                  // field should be empty and the `witness` field should be filled instead.
                  expect(input.script.length).to.be.equal(0)
                  expect(input.witness.length).to.be.greaterThan(0)
                  expect(input.address).to.be.equal(p2wpkhWalletAddress)

                  // Validate outputs.
                  expect(txJSON.outputs.length).to.be.equal(5)

                  const p2pkhOutput = txJSON.outputs[0]
                  const p2wpkhOutput = txJSON.outputs[1]
                  const p2shOutput = txJSON.outputs[2]
                  const p2wshOutput = txJSON.outputs[3]
                  const changeOutput = txJSON.outputs[4]

                  // P2PKH output
                  // The output value should be `requestedAmount` - `txFee` - `treasuryFee`
                  // which is 18000 - 1100 - 1000 = 15900
                  expect(p2pkhOutput.value).to.be.equal(15900)
                  // The output script should correspond to:
                  // OP_DUP OP_HASH160 0x14 0x4130879211c54df460e484ddf9aac009cb38ee74
                  // OP_EQUALVERIFY OP_CHECKSIG
                  expect(p2pkhOutput.script).to.be.equal(
                    "76a9144130879211c54df460e484ddf9aac009cb38ee7488ac"
                  )
                  // The output address should be P2PKH
                  expect(p2pkhOutput.address).to.be.equal(
                    "mmTeMR8RKu6QzMGTG4ipA71uewm3EuJng5"
                  )

                  // P2WPKH output
                  // The output value should be `requestedAmount` - `txFee` - `treasuryFee`
                  // which is 13000 - 900 - 800 = 11300
                  expect(p2wpkhOutput.value).to.be.equal(11300)
                  // The output script should correspond to:
                  // OP_0 0x14 0x4130879211c54df460e484ddf9aac009cb38ee74
                  expect(p2wpkhOutput.script).to.be.equal(
                    "00144130879211c54df460e484ddf9aac009cb38ee74"
                  )
                  // The output address should be P2WPKH
                  expect(p2wpkhOutput.address).to.be.equal(
                    "tb1qgycg0ys3c4xlgc8ysnwln2kqp89n3mn5ts7z3l"
                  )

                  // P2SH output
                  // The output value should be `requestedAmount` - `txFee` - `treasuryFee`
                  // which is 12000 - 1000 - 1100 = 9900
                  expect(p2shOutput.value).to.be.equal(9900)
                  // The output script should correspond to:
                  // OP_HASH160 0x14 0x3ec459d0f3c29286ae5df5fcc421e2786024277e OP_EQUAL
                  expect(p2shOutput.script).to.be.equal(
                    "a9143ec459d0f3c29286ae5df5fcc421e2786024277e87"
                  )
                  // The output address should be P2SH
                  expect(p2shOutput.address).to.be.equal(
                    "2Mxy76sc1qAxiJ1fXMXDXqHvVcPLh6Lf12C"
                  )

                  // P2WSH output
                  // The output value should be `requestedAmount` - `txFee` - `treasuryFee`
                  // which is 15000 - 1400 - 700 = 12900
                  expect(p2wshOutput.value).to.be.equal(12900)
                  // The output script should correspond to:
                  // OP_0 0x20 0x86a303cdd2e2eab1d1679f1a813835dc5a1b65321077cdccaf08f98cbf04ca96
                  expect(p2wshOutput.script).to.be.equal(
                    "002086a303cdd2e2eab1d1679f1a813835dc5a1b65321077cdccaf08f98cbf04ca96"
                  )
                  // The output address should be P2WSH
                  expect(p2wshOutput.address).to.be.equal(
                    "tb1qs63s8nwjut4tr5t8nudgzwp4m3dpkefjzpmumn90pruce0cye2tq2jkq0y"
                  )

                  // P2WPKH output (change)
                  // The value of fee should be the sum of fee share of all redeem outputs
                  // which is 1100 + 900 + 1000 + 1400 = 4400
                  // The output value should be main UTXO input value - fee - sum of all
                  // outputs, which is 1375180 = 1429580 - 4400 - (15900 + 11300 + 9900 + 12900)
                  expect(changeOutput.value).to.be.equal(1375180)
                  // The output script should correspond to:
                  // OP_0 0x14 0x8db50eb52063ea9d98b3eac91489a90f738986f6
                  expect(changeOutput.script).to.be.equal(
                    "00148db50eb52063ea9d98b3eac91489a90f738986f6"
                  )
                  // The change output address should be the P2WPKH address of the wallet
                  expect(changeOutput.address).to.be.equal(p2wpkhWalletAddress)
                })

                it("should return the proper transaction hash", async () => {
                  expect(transactionHash).to.be.deep.equal(
                    data.expectedRedemption.transactionHash
                  )
                })

                it("should return the proper new main UTXO", () => {
                  const expectedNewMainUtxo = {
                    transactionHash: data.expectedRedemption.transactionHash,
                    outputIndex: 4,
                    value: BigNumber.from(1375180),
                  }

                  expect(newMainUtxo).to.be.deep.equal(expectedNewMainUtxo)
                })
              })
            })

            describe("when the change output is P2PKH", () => {
              // The only difference between redemption transactions with P2PKH
              // change outputs and P2WPKH change outputs is the output type itself.
              // Therefore the tests for creating transactions with P2PKH are
              // limited to one single test case as more complicated scenarios are
              // covered for P2WPKH change output tests.
              const data: RedemptionTestData =
                singleP2SHRedemptionWithNonWitnessChange

              let transactionHash: BitcoinTxHash
              let newMainUtxo: BitcoinUtxo | undefined
              let transaction: BitcoinRawTx

              beforeEach(async () => {
                const redemptionRequests = data.pendingRedemptions.map(
                  (redemption) => redemption.pendingRedemption
                )

                const walletTx = new WalletTx(
                  tbtcContracts,
                  bitcoinClient,
                  data.witness
                )

                ;({
                  transactionHash,
                  newMainUtxo,
                  rawTransaction: transaction,
                } = await walletTx.redemption.assembleTransaction(
                  walletPrivateKey,
                  data.mainUtxo,
                  redemptionRequests
                ))
              })

              it("should return transaction with proper structure", async () => {
                // Compare HEXes.
                expect(transaction).to.be.eql(
                  data.expectedRedemption.transaction
                )

                // Convert raw transaction to JSON to make detailed comparison.
                const buffer = Buffer.from(transaction.transactionHex, "hex")
                const txJSON = bcoin.TX.fromRaw(buffer).getJSON("testnet")

                expect(txJSON.hash).to.be.equal(
                  data.expectedRedemption.transactionHash.toString()
                )
                expect(txJSON.version).to.be.equal(1)

                // Validate inputs.
                expect(txJSON.inputs.length).to.be.equal(1)

                const input = txJSON.inputs[0]

                expect(input.prevout.hash).to.be.equal(
                  data.mainUtxo.transactionHash.toString()
                )
                expect(input.prevout.index).to.be.equal(
                  data.mainUtxo.outputIndex
                )
                // Transaction should be signed but this is SegWit input so the `script`
                // field should be empty and the `witness` field should be filled instead.
                expect(input.script.length).to.be.equal(0)
                expect(input.witness.length).to.be.greaterThan(0)
                expect(input.address).to.be.equal(p2wpkhWalletAddress)

                // Validate outputs.
                expect(txJSON.outputs.length).to.be.equal(2)

                const p2shOutput = txJSON.outputs[0]
                const changeOutput = txJSON.outputs[1]

                // P2SH output
                // The output value should be `requestedAmount` - `txFee` - `treasuryFee`
                // which is 12000 - 1200 - 1000 = 9800
                expect(p2shOutput.value).to.be.equal(9800)
                // The output script should correspond to:
                // OP_HASH160 0x14 0x3ec459d0f3c29286ae5df5fcc421e2786024277e OP_EQUAL
                expect(p2shOutput.script).to.be.equal(
                  "a9143ec459d0f3c29286ae5df5fcc421e2786024277e87"
                )
                // The output address should be P2SH
                expect(p2shOutput.address).to.be.equal(
                  "2Mxy76sc1qAxiJ1fXMXDXqHvVcPLh6Lf12C"
                )

                // P2PKH output (change)
                // The value of fee should be the fee share of the (only) redeem output
                // which is 1200
                // The output value should be main UTXO input value - fee - the value
                // of the redeem output, which is 1364180 = 1375180 - 1200 - 9800
                expect(changeOutput.value).to.be.equal(1364180)
                // The output script should correspond to:
                // OP_DUP OP_HASH160 0x14 0x8db50eb52063ea9d98b3eac91489a90f738986f6
                // OP_EQUALVERIFY OP_CHECKSIG
                expect(changeOutput.script).to.be.equal(
                  "76a9148db50eb52063ea9d98b3eac91489a90f738986f688ac"
                )
                // The change output address should be the P2PKH address of the wallet
                expect(changeOutput.address).to.be.equal(p2pkhWalletAddress)
              })

              it("should return the proper transaction hash", async () => {
                expect(transactionHash).to.be.deep.equal(
                  data.expectedRedemption.transactionHash
                )
              })

              it("should return the proper new main UTXO", () => {
                const expectedNewMainUtxo = {
                  transactionHash: data.expectedRedemption.transactionHash,
                  outputIndex: 1,
                  value: BigNumber.from(1364180),
                }

                expect(newMainUtxo).to.be.deep.equal(expectedNewMainUtxo)
              })
            })
          })

          context("when there is no change UTXO created", () => {
            const data: RedemptionTestData = multipleRedemptionsWithoutChange

            let transactionHash: BitcoinTxHash
            let newMainUtxo: BitcoinUtxo | undefined
            let transaction: BitcoinRawTx

            beforeEach(async () => {
              const redemptionRequests = data.pendingRedemptions.map(
                (redemption) => redemption.pendingRedemption
              )

              const walletTx = new WalletTx(
                tbtcContracts,
                bitcoinClient,
                data.witness
              )

              ;({
                transactionHash,
                newMainUtxo,
                rawTransaction: transaction,
              } = await walletTx.redemption.assembleTransaction(
                walletPrivateKey,
                data.mainUtxo,
                redemptionRequests
              ))
            })

            it("should return transaction with proper structure", async () => {
              // Compare HEXes.
              expect(transaction).to.be.eql(data.expectedRedemption.transaction)

              // Convert raw transaction to JSON to make detailed comparison.
              const buffer = Buffer.from(transaction.transactionHex, "hex")
              const txJSON = bcoin.TX.fromRaw(buffer).getJSON("testnet")

              expect(txJSON.hash).to.be.equal(
                data.expectedRedemption.transactionHash.toString()
              )
              expect(txJSON.version).to.be.equal(1)

              // Validate inputs.
              expect(txJSON.inputs.length).to.be.equal(1)

              const input = txJSON.inputs[0]

              expect(input.prevout.hash).to.be.equal(
                data.mainUtxo.transactionHash.toString()
              )
              expect(input.prevout.index).to.be.equal(data.mainUtxo.outputIndex)
              // Transaction should be signed but this is SegWit input so the `script`
              // field should be empty and the `witness` field should be filled instead.
              expect(input.script.length).to.be.equal(0)
              expect(input.witness.length).to.be.greaterThan(0)
              expect(input.address).to.be.equal(p2wpkhWalletAddress)

              // Validate outputs.
              expect(txJSON.outputs.length).to.be.equal(2)

              const p2pkhOutput = txJSON.outputs[0]
              const p2wpkhOutput = txJSON.outputs[1]

              // P2PKH output
              // The output value should be `requestedAmount` - `txFee` - `treasuryFee`
              // which is 6000 - 800 - 0 = 5200
              expect(p2pkhOutput.value).to.be.equal(5200)
              // The output script should correspond to:
              // OP_DUP OP_HASH160 0x14 0x4130879211c54df460e484ddf9aac009cb38ee74
              // OP_EQUALVERIFY OP_CHECKSIG
              expect(p2pkhOutput.script).to.be.equal(
                "76a9144130879211c54df460e484ddf9aac009cb38ee7488ac"
              )
              // The output address should be P2PK
              expect(p2pkhOutput.address).to.be.equal(
                "mmTeMR8RKu6QzMGTG4ipA71uewm3EuJng5"
              )

              // P2WPKH output
              // The output value should be `requestedAmount` - `txFee` - `treasuryFee`
              // which is 4000 - 900 - 0 = 3100
              expect(p2wpkhOutput.value).to.be.equal(3100)
              // The output script should correspond to:
              // OP_0 0x14 0x4bf9ffb7ae0f8b0f5a622b154aca829126f6e769
              expect(p2wpkhOutput.script).to.be.equal(
                "00144bf9ffb7ae0f8b0f5a622b154aca829126f6e769"
              )
              // The output address should be P2PKH
              expect(p2wpkhOutput.address).to.be.equal(
                "tb1qf0ulldawp79s7knz9v254j5zjyn0demfx2d0xx"
              )
            })

            it("should return the proper transaction hash", async () => {
              expect(transactionHash).to.be.deep.equal(
                data.expectedRedemption.transactionHash
              )
            })

            it("should not return the new main UTXO", () => {
              expect(newMainUtxo).to.be.undefined
            })
          })
        })

        context("when there are no redemption requests provided", () => {
          const data: RedemptionTestData =
            singleP2PKHRedemptionWithWitnessChange

          it("should revert", async () => {
            const walletTx = new WalletTx(
              tbtcContracts,
              bitcoinClient,
              data.witness
            )

            await expect(
              walletTx.redemption.assembleTransaction(
                walletPrivateKey,
                data.mainUtxo,
                [] // empty list of redemption requests
              )
            ).to.be.rejectedWith("There must be at least one request to redeem")
          })
        })
      })
    })
  })

  describe("Spv", () => {
    describe("submitRedemptionProof", () => {
      const mainUtxo = {
        transactionHash: BitcoinTxHash.from(
          "3d28bb5bf73379da51bc683f4d0ed31d7b024466c619d80ebd9378077d900be3"
        ),
        outputIndex: 1,
        value: BigNumber.from(1429580),
      }

      let bitcoinClient: MockBitcoinClient
      let tbtcContracts: MockTBTCContracts
      let maintenanceService: MaintenanceService

      beforeEach(async () => {
        bcoin.set("testnet")

        bitcoinClient = new MockBitcoinClient()
        tbtcContracts = new MockTBTCContracts()

        maintenanceService = new MaintenanceService(
          tbtcContracts,
          bitcoinClient
        )

        const transactionHash =
          redemptionProof.bitcoinChainData.transaction.transactionHash

        const transactions = new Map<string, BitcoinTx>()
        transactions.set(
          transactionHash.toString(),
          redemptionProof.bitcoinChainData.transaction
        )
        bitcoinClient.transactions = transactions

        const rawTransactions = new Map<string, BitcoinRawTx>()
        rawTransactions.set(
          transactionHash.toString(),
          redemptionProof.bitcoinChainData.rawTransaction
        )
        bitcoinClient.rawTransactions = rawTransactions

        bitcoinClient.latestHeight =
          redemptionProof.bitcoinChainData.latestBlockHeight
        bitcoinClient.headersChain =
          redemptionProof.bitcoinChainData.headersChain
        bitcoinClient.transactionMerkle =
          redemptionProof.bitcoinChainData.transactionMerkleBranch
        const confirmations = new Map<string, number>()
        confirmations.set(
          transactionHash.toString(),
          redemptionProof.bitcoinChainData.accumulatedTxConfirmations
        )
        bitcoinClient.confirmations = confirmations

        await maintenanceService.spv.submitRedemptionProof(
          transactionHash,
          mainUtxo,
          walletPublicKey
        )
      })

      it("should submit redemption proof with correct arguments", () => {
        const bridgeLog = tbtcContracts.bridge.redemptionProofLog
        expect(bridgeLog.length).to.equal(1)
        expect(bridgeLog[0].mainUtxo).to.equal(mainUtxo)
        expect(bridgeLog[0].walletPublicKey).to.equal(
          redemptionProof.expectedRedemptionProof.walletPublicKey
        )
        expect(bridgeLog[0].redemptionTx).to.deep.equal(
          redemptionProof.expectedRedemptionProof.redemptionTx
        )
        expect(bridgeLog[0].redemptionProof.txIndexInBlock).to.deep.equal(
          redemptionProof.expectedRedemptionProof.redemptionProof.txIndexInBlock
        )
        expect(bridgeLog[0].redemptionProof.merkleProof).to.deep.equal(
          redemptionProof.expectedRedemptionProof.redemptionProof.merkleProof
        )
        expect(bridgeLog[0].redemptionProof.bitcoinHeaders).to.deep.equal(
          redemptionProof.expectedRedemptionProof.redemptionProof.bitcoinHeaders
        )
      })
    })
  })
})

async function runRedemptionScenario(
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
