import {
  Transaction,
  RawTransaction,
  TransactionHash,
  UnspentTransactionOutput,
} from "../src/bitcoin"
import bcoin from "bcoin"
import { MockBitcoinClient } from "./utils/mock-bitcoin-client"
import {
  walletPrivateKey,
  walletPublicKey,
  singleP2PKHRedemptionWithWitnessChange,
  singleP2WPKHRedemptionWithWitnessChange,
  singleP2SHRedemptionWithWitnessChange,
  singleP2WSHRedemptionWithWitnessChange,
  multipleRedemptionsWithWitnessChange,
  multipleRedemptionsWithoutChange,
  singleP2SHRedemptionWithNonWitnessChange,
  redemptionProof,
  p2pkhWalletAddress,
  p2wpkhWalletAddress,
  RedemptionTestData,
  findWalletForRedemptionData,
} from "./data/redemption"
import {
  assembleRedemptionTransaction,
  findWalletForRedemption,
  getRedemptionRequest,
  RedemptionRequest,
  requestRedemption,
  submitRedemptionProof,
  submitRedemptionTransaction,
} from "../src/redemption"
import { MockBridge } from "./utils/mock-bridge"
import * as chai from "chai"
import chaiAsPromised from "chai-as-promised"
import { expect } from "chai"
import { BigNumberish, BigNumber } from "ethers"
import { BitcoinNetwork } from "../src/bitcoin-network"
import { Wallet } from "../src/wallet"

chai.use(chaiAsPromised)

describe("Redemption", () => {
  describe("requestRedemption", () => {
    const data: RedemptionTestData = singleP2PKHRedemptionWithWitnessChange
    const mainUtxo = data.mainUtxo
    const redeemerOutputScript =
      data.pendingRedemptions[0].pendingRedemption.redeemerOutputScript
    const amount = data.pendingRedemptions[0].pendingRedemption.requestedAmount
    const bridge: MockBridge = new MockBridge()

    beforeEach(async () => {
      bcoin.set("testnet")

      await requestRedemption(
        walletPublicKey,
        mainUtxo,
        redeemerOutputScript,
        amount,
        bridge
      )
    })

    it("should submit redemption proof with correct arguments", () => {
      const bridgeLog = bridge.requestRedemptionLog
      expect(bridgeLog.length).to.equal(1)
      expect(bridgeLog[0].walletPublicKey).to.equal(
        redemptionProof.expectedRedemptionProof.walletPublicKey
      )
      expect(bridgeLog[0].mainUtxo).to.equal(mainUtxo)
      expect(bridgeLog[0].redeemerOutputScript).to.equal(redeemerOutputScript)
      expect(bridgeLog[0].amount).to.equal(amount)
    })
  })

  describe("submitRedemptionTransaction", () => {
    let bitcoinClient: MockBitcoinClient
    let bridge: MockBridge

    beforeEach(async () => {
      bcoin.set("testnet")
      bitcoinClient = new MockBitcoinClient()
      bridge = new MockBridge()
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

                    let transactionHash: TransactionHash
                    let newMainUtxo: UnspentTransactionOutput | undefined

                    beforeEach(async () => {
                      ;({ transactionHash, newMainUtxo } =
                        await runRedemptionScenario(
                          walletPrivateKey,
                          bitcoinClient,
                          bridge,
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

                    let transactionHash: TransactionHash
                    let newMainUtxo: UnspentTransactionOutput | undefined

                    beforeEach(async () => {
                      ;({ transactionHash, newMainUtxo } =
                        await runRedemptionScenario(
                          walletPrivateKey,
                          bitcoinClient,
                          bridge,
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

                    let transactionHash: TransactionHash
                    let newMainUtxo: UnspentTransactionOutput | undefined

                    beforeEach(async () => {
                      ;({ transactionHash, newMainUtxo } =
                        await runRedemptionScenario(
                          walletPrivateKey,
                          bitcoinClient,
                          bridge,
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

                    let transactionHash: TransactionHash
                    let newMainUtxo: UnspentTransactionOutput | undefined

                    beforeEach(async () => {
                      ;({ transactionHash, newMainUtxo } =
                        await runRedemptionScenario(
                          walletPrivateKey,
                          bitcoinClient,
                          bridge,
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

                let transactionHash: TransactionHash
                let newMainUtxo: UnspentTransactionOutput | undefined

                beforeEach(async () => {
                  ;({ transactionHash, newMainUtxo } =
                    await runRedemptionScenario(
                      walletPrivateKey,
                      bitcoinClient,
                      bridge,
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

              let transactionHash: TransactionHash
              let newMainUtxo: UnspentTransactionOutput | undefined

              beforeEach(async () => {
                ;({ transactionHash, newMainUtxo } =
                  await runRedemptionScenario(
                    walletPrivateKey,
                    bitcoinClient,
                    bridge,
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
            const data: RedemptionTestData = multipleRedemptionsWithoutChange

            let transactionHash: TransactionHash
            let newMainUtxo: UnspentTransactionOutput | undefined

            beforeEach(async () => {
              ;({ transactionHash, newMainUtxo } = await runRedemptionScenario(
                walletPrivateKey,
                bitcoinClient,
                bridge,
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
          const data: RedemptionTestData = multipleRedemptionsWithWitnessChange

          beforeEach(async () => {
            const rawTransactions = new Map<string, RawTransaction>()
            rawTransactions.set(data.mainUtxo.transactionHash.toString(), {
              transactionHex: data.mainUtxo.transactionHex,
            })
            bitcoinClient.rawTransactions = rawTransactions

            const pendingRedemptions = new Map<BigNumberish, RedemptionRequest>(
              data.pendingRedemptions.map((redemption) => [
                redemption.redemptionKey,
                redemption.pendingRedemption,
              ])
            )

            // Before setting the pending redemption map in the Bridge, delete
            // one element to simulate absence of that redemption
            pendingRedemptions.delete(data.pendingRedemptions[2].redemptionKey)
            bridge.setPendingRedemptions(pendingRedemptions)
          })

          it("should revert", async () => {
            const redeemerOutputScripts = data.pendingRedemptions.map(
              (redemption) => redemption.pendingRedemption.redeemerOutputScript
            )

            await expect(
              submitRedemptionTransaction(
                bitcoinClient,
                bridge,
                walletPrivateKey,
                data.mainUtxo,
                redeemerOutputScripts,
                data.witness
              )
            ).to.be.rejectedWith(
              "Provided redeemer output script and wallet public key do not identify a redemption request"
            )
          })
        }
      )
    })

    context("when there are no redemption requests provided", () => {
      const data: RedemptionTestData = singleP2WPKHRedemptionWithWitnessChange

      beforeEach(async () => {
        const rawTransactions = new Map<string, RawTransaction>()
        rawTransactions.set(data.mainUtxo.transactionHash.toString(), {
          transactionHex: data.mainUtxo.transactionHex,
        })
        bitcoinClient.rawTransactions = rawTransactions
      })

      it("should revert", async () => {
        await expect(
          submitRedemptionTransaction(
            bitcoinClient,
            bridge,
            walletPrivateKey,
            data.mainUtxo,
            [], // empty redeemer output script list
            data.witness
          )
        ).to.be.rejectedWith("There must be at least one request to redeem")
      })
    })
  })

  describe("assembleRedemptionTransaction", () => {
    context("when there are redemption requests provided", () => {
      context("when there is a change UTXO created", () => {
        describe("when the change output is P2WPKH", () => {
          context("when there is a single redeemer", () => {
            context(
              "when the redeemer output script is derived from a P2PKH address",
              () => {
                const data: RedemptionTestData =
                  singleP2PKHRedemptionWithWitnessChange

                let transactionHash: TransactionHash
                let newMainUtxo: UnspentTransactionOutput | undefined
                let transaction: RawTransaction

                beforeEach(async () => {
                  const redemptionRequests = data.pendingRedemptions.map(
                    (redemption) => redemption.pendingRedemption
                  )

                  ;({
                    transactionHash,
                    newMainUtxo,
                    rawTransaction: transaction,
                  } = await assembleRedemptionTransaction(
                    walletPrivateKey,
                    data.mainUtxo,
                    redemptionRequests,
                    data.witness
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

                let transactionHash: TransactionHash
                let newMainUtxo: UnspentTransactionOutput | undefined
                let transaction: RawTransaction

                beforeEach(async () => {
                  const redemptionRequests = data.pendingRedemptions.map(
                    (redemption) => redemption.pendingRedemption
                  )

                  ;({
                    transactionHash,
                    newMainUtxo,
                    rawTransaction: transaction,
                  } = await assembleRedemptionTransaction(
                    walletPrivateKey,
                    data.mainUtxo,
                    redemptionRequests,
                    data.witness
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

                let transactionHash: TransactionHash
                let newMainUtxo: UnspentTransactionOutput | undefined
                let transaction: RawTransaction

                beforeEach(async () => {
                  const redemptionRequests = data.pendingRedemptions.map(
                    (redemption) => redemption.pendingRedemption
                  )

                  ;({
                    transactionHash,
                    newMainUtxo,
                    rawTransaction: transaction,
                  } = await assembleRedemptionTransaction(
                    walletPrivateKey,
                    data.mainUtxo,
                    redemptionRequests,
                    data.witness
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

                let transactionHash: TransactionHash
                let newMainUtxo: UnspentTransactionOutput | undefined
                let transaction: RawTransaction

                beforeEach(async () => {
                  const redemptionRequests = data.pendingRedemptions.map(
                    (redemption) => redemption.pendingRedemption
                  )

                  ;({
                    transactionHash,
                    newMainUtxo,
                    rawTransaction: transaction,
                  } = await assembleRedemptionTransaction(
                    walletPrivateKey,
                    data.mainUtxo,
                    redemptionRequests,
                    data.witness
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

            let transactionHash: TransactionHash
            let newMainUtxo: UnspentTransactionOutput | undefined
            let transaction: RawTransaction

            beforeEach(async () => {
              const redemptionRequests = data.pendingRedemptions.map(
                (redemption) => redemption.pendingRedemption
              )

              ;({
                transactionHash,
                newMainUtxo,
                rawTransaction: transaction,
              } = await assembleRedemptionTransaction(
                walletPrivateKey,
                data.mainUtxo,
                redemptionRequests,
                data.witness
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

          let transactionHash: TransactionHash
          let newMainUtxo: UnspentTransactionOutput | undefined
          let transaction: RawTransaction

          beforeEach(async () => {
            const redemptionRequests = data.pendingRedemptions.map(
              (redemption) => redemption.pendingRedemption
            )

            ;({
              transactionHash,
              newMainUtxo,
              rawTransaction: transaction,
            } = await assembleRedemptionTransaction(
              walletPrivateKey,
              data.mainUtxo,
              redemptionRequests,
              data.witness
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

        let transactionHash: TransactionHash
        let newMainUtxo: UnspentTransactionOutput | undefined
        let transaction: RawTransaction

        beforeEach(async () => {
          const redemptionRequests = data.pendingRedemptions.map(
            (redemption) => redemption.pendingRedemption
          )

          ;({
            transactionHash,
            newMainUtxo,
            rawTransaction: transaction,
          } = await assembleRedemptionTransaction(
            walletPrivateKey,
            data.mainUtxo,
            redemptionRequests,
            data.witness
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
      const data: RedemptionTestData = singleP2PKHRedemptionWithWitnessChange

      it("should revert", async () => {
        await expect(
          assembleRedemptionTransaction(
            walletPrivateKey,
            data.mainUtxo,
            [], // empty list of redemption requests
            data.witness
          )
        ).to.be.rejectedWith("There must be at least one request to redeem")
      })
    })
  })

  describe("submitRedemptionProof", () => {
    const mainUtxo = {
      transactionHash: TransactionHash.from(
        "3d28bb5bf73379da51bc683f4d0ed31d7b024466c619d80ebd9378077d900be3"
      ),
      outputIndex: 1,
      value: BigNumber.from(1429580),
    }

    let bitcoinClient: MockBitcoinClient
    let bridge: MockBridge

    beforeEach(async () => {
      bcoin.set("testnet")

      bitcoinClient = new MockBitcoinClient()
      bridge = new MockBridge()

      const transactionHash =
        redemptionProof.bitcoinChainData.transaction.transactionHash

      const transactions = new Map<string, Transaction>()
      transactions.set(
        transactionHash.toString(),
        redemptionProof.bitcoinChainData.transaction
      )
      bitcoinClient.transactions = transactions

      const rawTransactions = new Map<string, RawTransaction>()
      rawTransactions.set(
        transactionHash.toString(),
        redemptionProof.bitcoinChainData.rawTransaction
      )
      bitcoinClient.rawTransactions = rawTransactions

      bitcoinClient.latestHeight =
        redemptionProof.bitcoinChainData.latestBlockHeight
      bitcoinClient.headersChain = redemptionProof.bitcoinChainData.headersChain
      bitcoinClient.transactionMerkle =
        redemptionProof.bitcoinChainData.transactionMerkleBranch
      const confirmations = new Map<string, number>()
      confirmations.set(
        transactionHash.toString(),
        redemptionProof.bitcoinChainData.accumulatedTxConfirmations
      )
      bitcoinClient.confirmations = confirmations

      await submitRedemptionProof(
        transactionHash,
        mainUtxo,
        walletPublicKey,
        bridge,
        bitcoinClient
      )
    })

    it("should submit redemption proof with correct arguments", () => {
      const bridgeLog = bridge.redemptionProofLog
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

  describe("getRedemptionRequest", () => {
    context("when asked for a pending request", () => {
      const { redemptionKey, pendingRedemption: redemptionRequest } =
        multipleRedemptionsWithWitnessChange.pendingRedemptions[0]

      let bridge: MockBridge

      beforeEach(async () => {
        const pendingRedemptions = new Map<BigNumberish, RedemptionRequest>()
        pendingRedemptions.set(redemptionKey, redemptionRequest)

        bridge = new MockBridge()
        bridge.setPendingRedemptions(pendingRedemptions)
      })

      it("should return the expected redemption request", async () => {
        const actualRedemptionRequest = await getRedemptionRequest(
          walletPublicKey,
          redemptionRequest.redeemerOutputScript,
          "pending",
          bridge
        )

        expect(actualRedemptionRequest).to.be.eql(redemptionRequest)
      })
    })

    context("when asked for a timed-out request", () => {
      const { redemptionKey, pendingRedemption: redemptionRequest } =
        multipleRedemptionsWithWitnessChange.pendingRedemptions[0]

      let bridge: MockBridge

      beforeEach(async () => {
        const pendingRedemptions = new Map<BigNumberish, RedemptionRequest>()
        pendingRedemptions.set(redemptionKey, redemptionRequest)

        bridge = new MockBridge()
        bridge.setTimedOutRedemptions(pendingRedemptions)
      })

      it("should return the expected redemption request", async () => {
        const actualRedemptionRequest = await getRedemptionRequest(
          walletPublicKey,
          redemptionRequest.redeemerOutputScript,
          "timedOut",
          bridge
        )

        expect(actualRedemptionRequest).to.be.eql(redemptionRequest)
      })
    })
  })

  describe("findWalletForRedemption", () => {
    let bridge: MockBridge
    let bitcoinClient: MockBitcoinClient

    context(
      "when there are no wallets in the network that can hanlde redemption",
      () => {
        const amount: BigNumber = BigNumber.from("1000000") // 0.01 BTC
        beforeEach(() => {
          bitcoinClient = new MockBitcoinClient()
          bridge = new MockBridge()
          bridge.newWalletRegisteredEvents = []
        })

        it("should throw an error", async () => {
          await expect(
            findWalletForRedemption(
              amount,
              bridge,
              bitcoinClient,
              BitcoinNetwork.Testnet
            )
          ).to.be.rejectedWith(
            "Could not find a wallet with enough funds. Maximum redemption amount is 0 Satoshi."
          )
        })
      }
    )

    context("when there are registered wallets in the network", () => {
      let result: Awaited<ReturnType<typeof findWalletForRedemption> | never>

      beforeEach(async () => {
        bitcoinClient = new MockBitcoinClient()
        bridge = new MockBridge()
        bridge.newWalletRegisteredEvents =
          findWalletForRedemptionData.newWalletRegisteredEvents
        const walletsUnspentTransacionOutputs = new Map<
          string,
          UnspentTransactionOutput[]
        >()
        for (const [
          key,
          { state, mainUtxoHash, walletPublicKey, btcAddress, utxos },
        ] of Object.entries(findWalletForRedemptionData.wallets)) {
          bridge.setWallet(key, {
            state,
            mainUtxoHash,
            walletPublicKey,
          } as Wallet)
          walletsUnspentTransacionOutputs.set(btcAddress, utxos)
        }

        bitcoinClient.unspentTransactionOutputs =
          walletsUnspentTransacionOutputs
      })

      context(
        "when there is a wallet that can handle the redemption request",
        () => {
          const amount: BigNumber = BigNumber.from("1000000") // 0.01 BTC
          beforeEach(async () => {
            result = await findWalletForRedemption(
              amount,
              bridge,
              bitcoinClient,
              BitcoinNetwork.Testnet
            )
          })

          it("should get all registered wallets", () => {
            const bridgeQueryEventsLog = bridge.newWalletRegisteredEventsLog

            expect(bridgeQueryEventsLog.length).to.equal(1)
            expect(bridgeQueryEventsLog[0]).to.deep.equal({
              options: undefined,
              filterArgs: [],
            })
          })

          it("should get wallet data details", () => {
            const bridgeWalletDetailsLogs = bridge.walletsLog

            expect(bridgeWalletDetailsLogs.length).to.eql(1)
            expect(bridgeWalletDetailsLogs[0].walletPublicKeyHash).to.eql(
              findWalletForRedemptionData.newWalletRegisteredEvents[0].walletPublicKeyHash.toPrefixedString()
            )
          })

          it("should return the wallet data that can handle redemption request", () => {
            const expectedWalletPublicKeyHash =
              findWalletForRedemptionData.newWalletRegisteredEvents[0]
                .walletPublicKeyHash
            const expectedWalletData =
              findWalletForRedemptionData.wallets[
                expectedWalletPublicKeyHash.toPrefixedString()
              ]
            expect(result).to.deep.eq({
              walletPublicKey: expectedWalletData.walletPublicKey.toString(),
              mainUTXO: expectedWalletData.utxos[0],
            })
          })
        }
      )

      context(
        "when the redemption request amount is too large and no wallet can handle the request",
        () => {
          const amount = BigNumber.from("10000000000") // 1 000 BTC
          const expectedMaxAmount = Object.values(
            findWalletForRedemptionData.wallets
          )
            .map((wallet) => wallet.utxos)
            .flat()
            .map((utxo) => utxo.value)
            .sort((a, b) => (b.gt(a) ? 0 : -1))[0]

          it("should throw an error", async () => {
            await expect(
              findWalletForRedemption(
                amount,
                bridge,
                bitcoinClient,
                BitcoinNetwork.Testnet
              )
            ).to.be.rejectedWith(
              `Could not find a wallet with enough funds. Maximum redemption amount is ${expectedMaxAmount.toString()} Satoshi.`
            )
          })
        }
      )
    })
  })
})

async function runRedemptionScenario(
  walletPrivKey: string,
  bitcoinClient: MockBitcoinClient,
  bridge: MockBridge,
  data: RedemptionTestData
): Promise<{
  transactionHash: TransactionHash
  newMainUtxo?: UnspentTransactionOutput
}> {
  const rawTransactions = new Map<string, RawTransaction>()
  rawTransactions.set(data.mainUtxo.transactionHash.toString(), {
    transactionHex: data.mainUtxo.transactionHex,
  })
  bitcoinClient.rawTransactions = rawTransactions

  bridge.setPendingRedemptions(
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

  return submitRedemptionTransaction(
    bitcoinClient,
    bridge,
    walletPrivKey,
    data.mainUtxo,
    redeemerOutputScripts,
    data.witness
  )
}
