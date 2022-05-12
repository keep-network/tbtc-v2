import TBTC from "./../src"
import { RawTransaction } from "../src/bitcoin"
// @ts-ignore
import bcoin from "bcoin"
import { MockBitcoinClient } from "./utils/mock-bitcoin-client"
import {
  walletPrivateKey,
  singleP2PKHAddressRedemption,
  singleP2WPKHAddressRedemption,
  singleP2SHAddressRedemption,
  singleP2WSHAddressRedemption,
  multipleAddressesRedemption,
  nonStandardAddressRedemption,
  noChangeRedemption,
  p2PKHChangeRedemption,
  RedemptionTestData,
  p2pkhWalletAddress,
  p2wpkhWalletAddress,
} from "./data/redemption"
import { RedemptionRequest } from "./redemption"
import { MockBridge } from "./utils/mock-bridge"
import * as chai from "chai"
import chaiAsPromised from "chai-as-promised"
chai.use(chaiAsPromised)
import { expect } from "chai"
import { BigNumberish, BigNumber } from "ethers"
import { PendingRedemption } from "./bridge"

describe("Redemption", () => {
  describe("redeemDeposits", () => {
    let bitcoinClient: MockBitcoinClient
    let bridge: MockBridge

    beforeEach(async () => {
      bcoin.set("testnet")
      bitcoinClient = new MockBitcoinClient()
      bridge = new MockBridge()
    })

    context("when there are redemption requests provided", () => {
      context("when there is a change UTXO is created", () => {
        context("when the change output is P2WPKH", () => {
          context("when there is a single redeemer", () => {
            context("when the redeemer address type is P2PKH", () => {
              const data: RedemptionTestData = singleP2PKHAddressRedemption

              beforeEach(async () => {
                await runRedemptionScenario(
                  walletPrivateKey,
                  bitcoinClient,
                  bridge,
                  data
                )
              })

              it("should broadcast redemption transaction with proper structure", () => {
                expect(bitcoinClient.broadcastLog.length).to.be.equal(1)
                expect(bitcoinClient.broadcastLog[0]).to.be.eql(
                  data.expectedRedemption.transaction
                )
              })
            })

            context("when the redeemer address type is P2WPKH", () => {
              const data: RedemptionTestData = singleP2WPKHAddressRedemption

              beforeEach(async () => {
                await runRedemptionScenario(
                  walletPrivateKey,
                  bitcoinClient,
                  bridge,
                  data
                )
              })

              it("should broadcast redemption transaction with proper structure", () => {
                expect(bitcoinClient.broadcastLog.length).to.be.equal(1)
                expect(bitcoinClient.broadcastLog[0]).to.be.eql(
                  data.expectedRedemption.transaction
                )
              })
            })

            context("when the redeemer address is P2SH", () => {
              const data: RedemptionTestData = singleP2SHAddressRedemption

              beforeEach(async () => {
                await runRedemptionScenario(
                  walletPrivateKey,
                  bitcoinClient,
                  bridge,
                  data
                )
              })

              it("should broadcast redemption transaction with proper structure", () => {
                expect(bitcoinClient.broadcastLog.length).to.be.equal(1)
                expect(bitcoinClient.broadcastLog[0]).to.be.eql(
                  data.expectedRedemption.transaction
                )
              })
            })

            context("when the redeemer address is P2WSH", () => {
              const data: RedemptionTestData = singleP2WSHAddressRedemption

              beforeEach(async () => {
                await runRedemptionScenario(
                  walletPrivateKey,
                  bitcoinClient,
                  bridge,
                  data
                )
              })

              it("should broadcast redemption transaction with proper structure", () => {
                expect(bitcoinClient.broadcastLog.length).to.be.equal(1)
                expect(bitcoinClient.broadcastLog[0]).to.be.eql(
                  data.expectedRedemption.transaction
                )
              })
            })
          })

          context("when there are multiple redeemers", () => {
            const data: RedemptionTestData = multipleAddressesRedemption

            beforeEach(async () => {
              await runRedemptionScenario(
                walletPrivateKey,
                bitcoinClient,
                bridge,
                data
              )
            })

            it("should broadcast redemption transaction with proper structure", () => {
              expect(bitcoinClient.broadcastLog.length).to.be.equal(1)
              expect(bitcoinClient.broadcastLog[0]).to.be.eql(
                data.expectedRedemption.transaction
              )
            })
          })
        })

        context("when the change output is P2PKH", () => {
          // The only difference between redemption transactions with P2PKH and
          // P2WPKH change is the output type.
          // Therefore only one test case was added for P2PKH transactions.
          const data: RedemptionTestData = p2PKHChangeRedemption

          beforeEach(async () => {
            await runRedemptionScenario(
              walletPrivateKey,
              bitcoinClient,
              bridge,
              data
            )
          })

          it("should broadcast redemption transaction with proper structure", () => {
            expect(bitcoinClient.broadcastLog.length).to.be.equal(1)
            expect(bitcoinClient.broadcastLog[0]).to.be.eql(
              data.expectedRedemption.transaction
            )
          })
        })
      })

      context("when there is no change UTXO created", () => {
        // Use test data with the treasury fees of all the redemption requests
        // set to 0. This is the only situation that the redemption transaction
        // will not contain the change output.
        const data: RedemptionTestData = noChangeRedemption

        beforeEach(async () => {
          await runRedemptionScenario(
            walletPrivateKey,
            bitcoinClient,
            bridge,
            data
          )
        })

        it("should broadcast redemption transaction with proper structure", () => {
          expect(bitcoinClient.broadcastLog.length).to.be.equal(1)
          expect(bitcoinClient.broadcastLog[0]).to.be.eql(
            data.expectedRedemption.transaction
          )
        })
      })
    })

    context("when there are no redemption requests provided", () => {
      const data: RedemptionTestData = singleP2WPKHAddressRedemption

      beforeEach(async () => {
        const rawTransactions = new Map<string, RawTransaction>()
        rawTransactions.set(data.mainUtxo.transactionHash, {
          transactionHex: data.mainUtxo.transactionHex,
        })
        bitcoinClient.rawTransactions = rawTransactions
      })

      it("should revert", async () => {
        await expect(
          TBTC.redeemDeposits(
            bitcoinClient,
            bridge,
            walletPrivateKey,
            data.mainUtxo,
            [],
            data.witness
          )
        ).to.be.rejectedWith("There must be at least one request to redeem")
      })
    })
  })

  describe("createRedemptionTransaction", () => {
    context("when there are redemption requests provided", () => {
      describe("when redeemer addresses are either P2PKH, P2WPKH, P2SH or P2WSH", () => {
        context("when there is a change UTXO is created", () => {
          describe("when the change output is P2WPKH", () => {
            context("when there is a single redeemer", () => {
              context("when the redeemer address type is P2PKH", () => {
                const data: RedemptionTestData = singleP2PKHAddressRedemption
                let transaction: RawTransaction

                beforeEach(async () => {
                  const redemptionRequests: RedemptionRequest[] =
                    buildRedemptionRequests(data)

                  transaction = await TBTC.createRedemptionTransaction(
                    walletPrivateKey,
                    data.mainUtxo,
                    redemptionRequests,
                    data.witness
                  )
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
                    data.expectedRedemption.transactionHash
                  )
                  expect(txJSON.version).to.be.equal(1)

                  // Validate inputs.
                  expect(txJSON.inputs.length).to.be.equal(1)

                  const input = txJSON.inputs[0]

                  expect(input.prevout.hash).to.be.equal(
                    data.mainUtxo.transactionHash
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
                  // The output value should be `requestedAmount` - `feeShare` - `treasuryFee`
                  // which is 10000 - 1600 - 1000 = 7400
                  expect(p2pkhOutput.value).to.be.equal(7400)
                  // The output script should correspond to:
                  // OP_DUP OP_HASH160 0x14 0x4130879211c54df460e484ddf9aac009cb38ee74
                  // OP_EQUALVERIFY OP_CHECKSIG
                  expect(p2pkhOutput.script).to.be.equal(
                    "76a9144130879211c54df460e484ddf9aac009cb38ee7488ac"
                  )
                  // The output address should be the P2PKH address passed within input
                  // data
                  expect(p2pkhOutput.address).to.be.equal(
                    data.redeemerAddresses[0]
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
              })

              context("when the redeemer address type is P2WPKH", () => {
                const data: RedemptionTestData = singleP2WPKHAddressRedemption
                let transaction: RawTransaction

                beforeEach(async () => {
                  const redemptionRequests: RedemptionRequest[] =
                    buildRedemptionRequests(data)

                  transaction = await TBTC.createRedemptionTransaction(
                    walletPrivateKey,
                    data.mainUtxo,
                    redemptionRequests,
                    data.witness
                  )
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
                    data.expectedRedemption.transactionHash
                  )
                  expect(txJSON.version).to.be.equal(1)

                  // Validate inputs.
                  expect(txJSON.inputs.length).to.be.equal(1)

                  const input = txJSON.inputs[0]

                  expect(input.prevout.hash).to.be.equal(
                    data.mainUtxo.transactionHash
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

                  // P2PKH output
                  // The output value should be `requestedAmount` - `feeShare` - `treasuryFee`
                  // which is 15000 - 1700 - 1100 = 12200
                  expect(p2wpkhOutput.value).to.be.equal(12200)
                  // The output script should correspond to:
                  // OP_0 0x14 0x4130879211c54df460e484ddf9aac009cb38ee74
                  expect(p2wpkhOutput.script).to.be.equal(
                    "00144130879211c54df460e484ddf9aac009cb38ee74"
                  )
                  // The output address should be the P2WPKH address passed within input
                  // data
                  expect(p2wpkhOutput.address).to.be.equal(
                    data.redeemerAddresses[0]
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
              })

              context("when the redeemer address type is P2SH", () => {
                const data: RedemptionTestData = singleP2SHAddressRedemption
                let transaction: RawTransaction

                beforeEach(async () => {
                  const redemptionRequests: RedemptionRequest[] =
                    buildRedemptionRequests(data)

                  transaction = await TBTC.createRedemptionTransaction(
                    walletPrivateKey,
                    data.mainUtxo,
                    redemptionRequests,
                    data.witness
                  )
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
                    data.expectedRedemption.transactionHash
                  )
                  expect(txJSON.version).to.be.equal(1)

                  // Validate inputs.
                  expect(txJSON.inputs.length).to.be.equal(1)

                  const input = txJSON.inputs[0]

                  expect(input.prevout.hash).to.be.equal(
                    data.mainUtxo.transactionHash
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
                  // The output value should be `requestedAmount` - `feeShare` - `treasuryFee`
                  // which is 13000 - 1700 - 800 = 10500
                  expect(p2shOutput.value).to.be.equal(10500)
                  // The output script should correspond to:
                  // OP_HASH160 0x14 0x3ec459d0f3c29286ae5df5fcc421e2786024277e OP_EQUAL
                  expect(p2shOutput.script).to.be.equal(
                    "a9143ec459d0f3c29286ae5df5fcc421e2786024277e87"
                  )
                  // The output address should be the P2SH address passed within input
                  // data
                  expect(p2shOutput.address).to.be.equal(
                    data.redeemerAddresses[0]
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
              })

              context("when the redeemer address type is P2WSH", () => {
                const data: RedemptionTestData = singleP2WSHAddressRedemption
                let transaction: RawTransaction

                beforeEach(async () => {
                  const redemptionRequests: RedemptionRequest[] =
                    buildRedemptionRequests(data)

                  transaction = await TBTC.createRedemptionTransaction(
                    walletPrivateKey,
                    data.mainUtxo,
                    redemptionRequests,
                    data.witness
                  )
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
                    data.expectedRedemption.transactionHash
                  )
                  expect(txJSON.version).to.be.equal(1)

                  // Validate inputs.
                  expect(txJSON.inputs.length).to.be.equal(1)

                  const input = txJSON.inputs[0]

                  expect(input.prevout.hash).to.be.equal(
                    data.mainUtxo.transactionHash
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
                  // The output value should be `requestedAmount` - `feeShare` - `treasuryFee`
                  // which is 18000 - 1400 - 1000 = 15600
                  expect(p2wshOutput.value).to.be.equal(15600)
                  // The output script should correspond to:
                  // OP_0 0x20 0x86a303cdd2e2eab1d1679f1a813835dc5a1b65321077cdccaf08f98cbf04ca96
                  expect(p2wshOutput.script).to.be.equal(
                    "002086a303cdd2e2eab1d1679f1a813835dc5a1b65321077cdccaf08f98cbf04ca96"
                  )
                  // The output address should be the P2WSH address passed within input
                  // data
                  expect(p2wshOutput.address).to.be.equal(
                    data.redeemerAddresses[0]
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
              })
            })

            context("when there are multiple redeemers", () => {
              const data: RedemptionTestData = multipleAddressesRedemption
              let transaction: RawTransaction

              beforeEach(async () => {
                const redemptionRequests: RedemptionRequest[] =
                  buildRedemptionRequests(data)

                transaction = await TBTC.createRedemptionTransaction(
                  walletPrivateKey,
                  data.mainUtxo,
                  redemptionRequests,
                  data.witness
                )
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
                  data.expectedRedemption.transactionHash
                )
                expect(txJSON.version).to.be.equal(1)

                // Validate inputs.
                expect(txJSON.inputs.length).to.be.equal(1)

                const input = txJSON.inputs[0]

                expect(input.prevout.hash).to.be.equal(
                  data.mainUtxo.transactionHash
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
                // The output value should be `requestedAmount` - `feeShare` - `treasuryFee`
                // which is 18000 - 1100 - 1000 = 15900
                expect(p2pkhOutput.value).to.be.equal(15900)
                // The output script should correspond to:
                // OP_DUP OP_HASH160 0x14 0x4130879211c54df460e484ddf9aac009cb38ee74
                // OP_EQUALVERIFY OP_CHECKSIG
                expect(p2pkhOutput.script).to.be.equal(
                  "76a9144130879211c54df460e484ddf9aac009cb38ee7488ac"
                )
                // The output address should be the P2PKH address passed within input
                // data
                expect(p2pkhOutput.address).to.be.equal(
                  data.redeemerAddresses[0]
                )

                // P2WPKH output
                // The output value should be `requestedAmount` - `feeShare` - `treasuryFee`
                // which is 13000 - 900 - 800 = 11300
                expect(p2wpkhOutput.value).to.be.equal(11300)
                // The output script should correspond to:
                // OP_0 0x14 0x4130879211c54df460e484ddf9aac009cb38ee74
                expect(p2wpkhOutput.script).to.be.equal(
                  "00144130879211c54df460e484ddf9aac009cb38ee74"
                )
                // The output address should be the P2WPKH address passed within input
                // data
                expect(p2wpkhOutput.address).to.be.equal(
                  data.redeemerAddresses[1]
                )

                // P2SH output
                // The output value should be `requestedAmount` - `feeShare` - `treasuryFee`
                // which is 12000 - 1000 - 1100 = 9900
                expect(p2shOutput.value).to.be.equal(9900)
                // The output script should correspond to:
                // OP_HASH160 0x14 0x3ec459d0f3c29286ae5df5fcc421e2786024277e OP_EQUAL
                expect(p2shOutput.script).to.be.equal(
                  "a9143ec459d0f3c29286ae5df5fcc421e2786024277e87"
                )
                // The output address should be the P2SH address passed within input
                // data
                expect(p2shOutput.address).to.be.equal(
                  data.redeemerAddresses[2]
                )

                // P2WSH output
                // The output value should be `requestedAmount` - `feeShare` - `treasuryFee`
                // which is 15000 - 1400 - 700 = 12900
                expect(p2wshOutput.value).to.be.equal(12900)
                // The output script should correspond to:
                // OP_0 0x20 0x86a303cdd2e2eab1d1679f1a813835dc5a1b65321077cdccaf08f98cbf04ca96
                expect(p2wshOutput.script).to.be.equal(
                  "002086a303cdd2e2eab1d1679f1a813835dc5a1b65321077cdccaf08f98cbf04ca96"
                )
                // The output address should be the P2WSH address passed within input
                // data
                expect(p2wshOutput.address).to.be.equal(
                  data.redeemerAddresses[3]
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
            })
          })

          describe("when the change output is P2PKH", () => {
            // The only difference between redemption transactions with P2PKH
            // change outputs and P2WPKH change outputs is the output type itself.
            // Therefore the tests for creating transactions with P2PKH are
            // limited to one single test case as more complicated scenarios are
            // covered for P2WPKH change output tests.
            const data: RedemptionTestData = p2PKHChangeRedemption
            let transaction: RawTransaction

            beforeEach(async () => {
              const redemptionRequests: RedemptionRequest[] =
                buildRedemptionRequests(data)

              transaction = await TBTC.createRedemptionTransaction(
                walletPrivateKey,
                data.mainUtxo,
                redemptionRequests,
                data.witness
              )
            })

            it("should return transaction with proper structure", async () => {
              // Compare HEXes.
              expect(transaction).to.be.eql(data.expectedRedemption.transaction)

              // Convert raw transaction to JSON to make detailed comparison.
              const buffer = Buffer.from(transaction.transactionHex, "hex")
              const txJSON = bcoin.TX.fromRaw(buffer).getJSON("testnet")

              expect(txJSON.hash).to.be.equal(
                data.expectedRedemption.transactionHash
              )
              expect(txJSON.version).to.be.equal(1)

              // Validate inputs.
              expect(txJSON.inputs.length).to.be.equal(1)

              const input = txJSON.inputs[0]

              expect(input.prevout.hash).to.be.equal(
                data.mainUtxo.transactionHash
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
              // The output value should be `requestedAmount` - `feeShare` - `treasuryFee`
              // which is 12000 - 1200 - 1000 = 9800
              expect(p2shOutput.value).to.be.equal(9800)
              // The output script should correspond to:
              // OP_HASH160 0x14 0x3ec459d0f3c29286ae5df5fcc421e2786024277e OP_EQUAL
              expect(p2shOutput.script).to.be.equal(
                "a9143ec459d0f3c29286ae5df5fcc421e2786024277e87"
              )
              // The output address should be the P2PKH address passed within input
              // data
              expect(p2shOutput.address).to.be.equal(data.redeemerAddresses[0])

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
          })
        })

        context("when there is no change UTXO created", () => {
          const data: RedemptionTestData = noChangeRedemption
          let transaction: RawTransaction

          beforeEach(async () => {
            const redemptionRequests: RedemptionRequest[] =
              buildRedemptionRequests(data)

            transaction = await TBTC.createRedemptionTransaction(
              walletPrivateKey,
              data.mainUtxo,
              redemptionRequests,
              data.witness
            )
          })

          it("should return transaction with proper structure", async () => {
            // Compare HEXes.
            expect(transaction).to.be.eql(data.expectedRedemption.transaction)

            // Convert raw transaction to JSON to make detailed comparison.
            const buffer = Buffer.from(transaction.transactionHex, "hex")
            const txJSON = bcoin.TX.fromRaw(buffer).getJSON("testnet")

            expect(txJSON.hash).to.be.equal(
              data.expectedRedemption.transactionHash
            )
            expect(txJSON.version).to.be.equal(1)

            // Validate inputs.
            expect(txJSON.inputs.length).to.be.equal(1)

            const input = txJSON.inputs[0]

            expect(input.prevout.hash).to.be.equal(
              data.mainUtxo.transactionHash
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
            // The output value should be `requestedAmount` - `feeShare` - `treasuryFee`
            // which is 6000 - 800 - 0 = 5200
            expect(p2pkhOutput.value).to.be.equal(5200)
            // The output script should correspond to:
            // OP_DUP OP_HASH160 0x14 0x4130879211c54df460e484ddf9aac009cb38ee74
            // OP_EQUALVERIFY OP_CHECKSIG
            expect(p2pkhOutput.script).to.be.equal(
              "76a9144130879211c54df460e484ddf9aac009cb38ee7488ac"
            )
            // The output address should be the P2PKH address passed within input
            // data
            expect(p2pkhOutput.address).to.be.equal(data.redeemerAddresses[0])

            // P2WPKH output
            // The output value should be `requestedAmount` - `feeShare` - `treasuryFee`
            // which is 4000 - 900 - 0 = 3100
            expect(p2wpkhOutput.value).to.be.equal(3100)
            // The output script should correspond to:
            // OP_0 0x14 0x4bf9ffb7ae0f8b0f5a622b154aca829126f6e769
            expect(p2wpkhOutput.script).to.be.equal(
              "00144bf9ffb7ae0f8b0f5a622b154aca829126f6e769"
            )
            // The output address should be the P2PKH address passed within input
            // data
            expect(p2wpkhOutput.address).to.be.equal(data.redeemerAddresses[1])
          })
        })
      })

      describe("when redeemer addresses are neither P2PKH, P2WPKH, P2SH nor P2WSH", () => {
        const data: RedemptionTestData = nonStandardAddressRedemption

        const redemptionRequests: RedemptionRequest[] = [
          {
            redeemerAddress: data.redeemerAddresses[0],
            requestedAmount: BigNumber.from(10000),
            feeShare: BigNumber.from(1000),
            treasuryFee: BigNumber.from(2000),
          },
        ]

        it("should revert", async () => {
          await expect(
            TBTC.createRedemptionTransaction(
              walletPrivateKey,
              data.mainUtxo,
              redemptionRequests,
              data.witness
            )
          ).to.be.rejectedWith(
            "Redemption address must be P2PKH, P2WPKH, P2SH or P2WSH"
          )
        })
      })
    })

    context("when there are no redemption requests provided", () => {
      const data: RedemptionTestData = singleP2PKHAddressRedemption

      it("should revert", async () => {
        await expect(
          TBTC.createRedemptionTransaction(
            walletPrivateKey,
            data.mainUtxo,
            [], // empty list of redemption requests
            data.witness
          )
        ).to.be.rejectedWith("There must be at least one request to redeem")
      })
    })
  })
})

async function runRedemptionScenario(
  walletPrivKey: string,
  bitcoinClient: MockBitcoinClient,
  bridge: MockBridge,
  data: RedemptionTestData
) {
  const rawTransactions = new Map<string, RawTransaction>()
  rawTransactions.set(data.mainUtxo.transactionHash, {
    transactionHex: data.mainUtxo.transactionHex,
  })
  bitcoinClient.rawTransactions = rawTransactions

  bridge.pendingRedemptions = new Map<BigNumberish, PendingRedemption>(
    data.pendingRedemptions.map((redemption) => [
      redemption.redemptionKey,
      redemption.pendingRedemption,
    ])
  )

  await TBTC.redeemDeposits(
    bitcoinClient,
    bridge,
    walletPrivKey,
    data.mainUtxo,
    data.redeemerAddresses,
    data.witness
  )
}

function buildRedemptionRequests(
  data: RedemptionTestData
): RedemptionRequest[] {
  const redemptionRequests: RedemptionRequest[] = []

  for (let i = 0; i < data.redeemerAddresses.length; i++) {
    const redemption = data.pendingRedemptions[i].pendingRedemption
    redemptionRequests.push({
      redeemerAddress: data.redeemerAddresses[i],
      requestedAmount: redemption.requestedAmount,
      feeShare: redemption.txMaxFee,
      treasuryFee: redemption.treasuryFee,
    })
  }

  return redemptionRequests
}
