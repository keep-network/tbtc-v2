import { BigNumber } from "ethers"
import {
  BitcoinRawTx,
  BitcoinTxHash,
  BitcoinUtxo,
  BitcoinTx,
  MaintenanceService,
  WalletTx,
} from "../src"
import {
  testnetDepositScripthashAddress,
  testnetDepositWitnessScripthashAddress,
  testnetWalletAddress,
  testnetWalletPrivateKey,
} from "./data/deposit"
import {
  depositSweepWithWitnessMainUtxoAndWitnessOutput,
  depositSweepWithNoMainUtxoAndWitnessOutput,
  depositSweepWithNoMainUtxoAndNonWitnessOutput,
  depositSweepWithNonWitnessMainUtxoAndWitnessOutput,
  depositSweepProof,
  NO_MAIN_UTXO,
} from "./data/deposit-sweep"
import { MockBitcoinClient } from "./utils/mock-bitcoin-client"
import bcoin from "bcoin"
import * as chai from "chai"
import chaiAsPromised from "chai-as-promised"
chai.use(chaiAsPromised)
import { expect } from "chai"
import { MockTBTCContracts } from "./utils/mock-tbtc-contracts"

describe("Sweep", () => {
  const fee = BigNumber.from(1600)

  describe("WalletTx", () => {
    describe("DepositSweep", () => {
      describe("submitTransaction", () => {
        let tbtcContracts: MockTBTCContracts
        let bitcoinClient: MockBitcoinClient

        beforeEach(async () => {
          bcoin.set("testnet")

          tbtcContracts = new MockTBTCContracts()
          bitcoinClient = new MockBitcoinClient()
        })

        context("when the new main UTXO is requested to be witness", () => {
          context(
            "when there is no main UTXO from previous deposit sweep",
            () => {
              let transactionHash: BitcoinTxHash
              let newMainUtxo: BitcoinUtxo

              beforeEach(async () => {
                // Map transaction hashes for UTXOs to transactions in hexadecimal and
                // set the mapping in the mock Bitcoin client
                const rawTransactions = new Map<string, BitcoinRawTx>()
                for (const deposit of depositSweepWithNoMainUtxoAndWitnessOutput.deposits) {
                  rawTransactions.set(deposit.utxo.transactionHash.toString(), {
                    transactionHex: deposit.utxo.transactionHex,
                  })
                }
                bitcoinClient.rawTransactions = rawTransactions

                const utxos: BitcoinUtxo[] =
                  depositSweepWithNoMainUtxoAndWitnessOutput.deposits.map(
                    (data) => {
                      return data.utxo
                    }
                  )

                const deposit =
                  depositSweepWithNoMainUtxoAndWitnessOutput.deposits.map(
                    (deposit) => {
                      return deposit.data
                    }
                  )
                const witness =
                  depositSweepWithNoMainUtxoAndWitnessOutput.witness

                const walletTx = new WalletTx(
                  tbtcContracts,
                  bitcoinClient,
                  witness
                )

                ;({ transactionHash, newMainUtxo } =
                  await walletTx.depositSweep.submitTransaction(
                    fee,
                    testnetWalletPrivateKey,
                    utxos,
                    deposit
                  ))
              })

              it("should broadcast sweep transaction with proper structure", async () => {
                expect(bitcoinClient.broadcastLog.length).to.be.equal(1)
                expect(bitcoinClient.broadcastLog[0]).to.be.eql(
                  depositSweepWithNoMainUtxoAndWitnessOutput.expectedSweep
                    .transaction
                )
              })

              it("should return the proper transaction hash", async () => {
                expect(transactionHash).to.be.deep.equal(
                  depositSweepWithNoMainUtxoAndWitnessOutput.expectedSweep
                    .transactionHash
                )
              })

              it("should return the proper new main UTXO", () => {
                const expectedNewMainUtxo = {
                  transactionHash:
                    depositSweepWithNoMainUtxoAndWitnessOutput.expectedSweep
                      .transactionHash,
                  outputIndex: 0,
                  value: BigNumber.from(35400),
                }

                expect(newMainUtxo).to.be.eql(expectedNewMainUtxo)
              })
            }
          )

          context("when there is main UTXO from previous deposit sweep", () => {
            context(
              "when main UTXO from previous deposit sweep is witness",
              () => {
                let transactionHash: BitcoinTxHash
                let newMainUtxo: BitcoinUtxo

                beforeEach(async () => {
                  // Map transaction hashes for UTXOs to transactions in hexadecimal and
                  // set the mapping in the mock Bitcoin client
                  const rawTransactions = new Map<string, BitcoinRawTx>()
                  for (const deposit of depositSweepWithWitnessMainUtxoAndWitnessOutput.deposits) {
                    rawTransactions.set(
                      deposit.utxo.transactionHash.toString(),
                      {
                        transactionHex: deposit.utxo.transactionHex,
                      }
                    )
                  }
                  // The main UTXO resulting from another data set was used as input.
                  // Set raw data of that main UTXO as well.
                  rawTransactions.set(
                    depositSweepWithNoMainUtxoAndWitnessOutput.expectedSweep.transactionHash.toString(),
                    depositSweepWithNoMainUtxoAndWitnessOutput.expectedSweep
                      .transaction
                  )
                  bitcoinClient.rawTransactions = rawTransactions

                  const utxos: BitcoinUtxo[] =
                    depositSweepWithWitnessMainUtxoAndWitnessOutput.deposits.map(
                      (deposit) => {
                        return deposit.utxo
                      }
                    )

                  const deposit =
                    depositSweepWithWitnessMainUtxoAndWitnessOutput.deposits.map(
                      (deposit) => {
                        return deposit.data
                      }
                    )

                  const witness =
                    depositSweepWithWitnessMainUtxoAndWitnessOutput.witness

                  const mainUtxo =
                    depositSweepWithWitnessMainUtxoAndWitnessOutput.mainUtxo

                  const walletTx = new WalletTx(
                    tbtcContracts,
                    bitcoinClient,
                    witness
                  )

                  ;({ transactionHash, newMainUtxo } =
                    await walletTx.depositSweep.submitTransaction(
                      fee,
                      testnetWalletPrivateKey,
                      utxos,
                      deposit,
                      mainUtxo
                    ))
                })

                it("should broadcast sweep transaction with proper structure", async () => {
                  expect(bitcoinClient.broadcastLog.length).to.be.equal(1)
                  expect(bitcoinClient.broadcastLog[0]).to.be.eql(
                    depositSweepWithWitnessMainUtxoAndWitnessOutput
                      .expectedSweep.transaction
                  )
                })

                it("should return the proper transaction hash", async () => {
                  expect(transactionHash).to.be.deep.equal(
                    depositSweepWithWitnessMainUtxoAndWitnessOutput
                      .expectedSweep.transactionHash
                  )
                })

                it("should return the proper new main UTXO", () => {
                  const expectedNewMainUtxo = {
                    transactionHash:
                      depositSweepWithWitnessMainUtxoAndWitnessOutput
                        .expectedSweep.transactionHash,
                    outputIndex: 0,
                    value: BigNumber.from(60800),
                  }

                  expect(newMainUtxo).to.be.eql(expectedNewMainUtxo)
                })
              }
            )

            context(
              "when main UTXO from previous deposit sweep is non-witness",
              () => {
                let transactionHash: BitcoinTxHash
                let newMainUtxo: BitcoinUtxo

                beforeEach(async () => {
                  // Map transaction hashes for UTXOs to transactions in hexadecimal and
                  // set the mapping in the mock Bitcoin client
                  const rawTransactions = new Map<string, BitcoinRawTx>()
                  for (const deposit of depositSweepWithNonWitnessMainUtxoAndWitnessOutput.deposits) {
                    rawTransactions.set(
                      deposit.utxo.transactionHash.toString(),
                      {
                        transactionHex: deposit.utxo.transactionHex,
                      }
                    )
                  }
                  rawTransactions.set(
                    depositSweepWithNonWitnessMainUtxoAndWitnessOutput.mainUtxo.transactionHash.toString(),
                    {
                      transactionHex:
                        depositSweepWithNonWitnessMainUtxoAndWitnessOutput
                          .mainUtxo.transactionHex,
                    }
                  )
                  bitcoinClient.rawTransactions = rawTransactions

                  const utxos: BitcoinUtxo[] =
                    depositSweepWithNonWitnessMainUtxoAndWitnessOutput.deposits.map(
                      (deposit) => {
                        return deposit.utxo
                      }
                    )

                  const deposit =
                    depositSweepWithNonWitnessMainUtxoAndWitnessOutput.deposits.map(
                      (deposit) => {
                        return deposit.data
                      }
                    )

                  const witness =
                    depositSweepWithNonWitnessMainUtxoAndWitnessOutput.witness

                  const mainUtxo =
                    depositSweepWithNonWitnessMainUtxoAndWitnessOutput.mainUtxo

                  const walletTx = new WalletTx(
                    tbtcContracts,
                    bitcoinClient,
                    witness
                  )

                  ;({ transactionHash, newMainUtxo } =
                    await walletTx.depositSweep.submitTransaction(
                      fee,
                      testnetWalletPrivateKey,
                      utxos,
                      deposit,
                      mainUtxo
                    ))
                })

                it("should broadcast sweep transaction with proper structure", async () => {
                  expect(bitcoinClient.broadcastLog.length).to.be.equal(1)
                  expect(bitcoinClient.broadcastLog[0]).to.be.eql(
                    depositSweepWithNonWitnessMainUtxoAndWitnessOutput
                      .expectedSweep.transaction
                  )
                })

                it("should return the proper transaction hash", async () => {
                  expect(transactionHash).to.be.deep.equal(
                    depositSweepWithNonWitnessMainUtxoAndWitnessOutput
                      .expectedSweep.transactionHash
                  )
                })

                it("should return the proper new main UTXO", () => {
                  const expectedNewMainUtxo = {
                    transactionHash:
                      depositSweepWithNonWitnessMainUtxoAndWitnessOutput
                        .expectedSweep.transactionHash,
                    outputIndex: 0,
                    value: BigNumber.from(33800),
                  }

                  expect(newMainUtxo).to.be.eql(expectedNewMainUtxo)
                })
              }
            )
          })
        })

        context("when the new main UTXO is requested to be non-witness", () => {
          // The only difference between deposit sweep transactions with witness and
          // non-witness output is the output type itself.
          // Therefore only one test case was added for non-witness transactions.
          let transactionHash: BitcoinTxHash
          let newMainUtxo: BitcoinUtxo

          beforeEach(async () => {
            // Map transaction hashes for UTXOs to transactions in hexadecimal and
            // set the mapping in the mock Bitcoin client
            const rawTransactions = new Map<string, BitcoinRawTx>()
            for (const deposit of depositSweepWithNoMainUtxoAndNonWitnessOutput.deposits) {
              rawTransactions.set(deposit.utxo.transactionHash.toString(), {
                transactionHex: deposit.utxo.transactionHex,
              })
            }
            bitcoinClient.rawTransactions = rawTransactions

            const utxos =
              depositSweepWithNoMainUtxoAndNonWitnessOutput.deposits.map(
                (data) => {
                  return data.utxo
                }
              )

            const deposits =
              depositSweepWithNoMainUtxoAndNonWitnessOutput.deposits.map(
                (deposit) => {
                  return deposit.data
                }
              )
            const witness =
              depositSweepWithNoMainUtxoAndNonWitnessOutput.witness

            const walletTx = new WalletTx(tbtcContracts, bitcoinClient, witness)

            ;({ transactionHash, newMainUtxo } =
              await walletTx.depositSweep.submitTransaction(
                fee,
                testnetWalletPrivateKey,
                utxos,
                deposits
              ))
          })

          it("should broadcast sweep transaction with proper structure", async () => {
            expect(bitcoinClient.broadcastLog.length).to.be.equal(1)
            expect(bitcoinClient.broadcastLog[0]).to.be.eql(
              depositSweepWithNoMainUtxoAndNonWitnessOutput.expectedSweep
                .transaction
            )
          })

          it("should return the proper transaction hash", async () => {
            expect(transactionHash).to.be.deep.equal(
              depositSweepWithNoMainUtxoAndNonWitnessOutput.expectedSweep
                .transactionHash
            )
          })

          it("should return the proper new main UTXO", () => {
            const expectedNewMainUtxo = {
              transactionHash:
                depositSweepWithNoMainUtxoAndNonWitnessOutput.expectedSweep
                  .transactionHash,
              outputIndex: 0,
              value: BigNumber.from(13400),
            }

            expect(newMainUtxo).to.be.eql(expectedNewMainUtxo)
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

        context("when the new main UTXO is requested to be witness", () => {
          context(
            "when there is no main UTXO from previous deposit sweep",
            () => {
              let transactionHash: BitcoinTxHash
              let newMainUtxo: BitcoinUtxo
              let transaction: BitcoinRawTx

              const utxosWithRaw =
                depositSweepWithNoMainUtxoAndWitnessOutput.deposits.map(
                  (data) => {
                    return data.utxo
                  }
                )

              const deposit =
                depositSweepWithNoMainUtxoAndWitnessOutput.deposits.map(
                  (deposit) => {
                    return deposit.data
                  }
                )

              const witness = depositSweepWithNoMainUtxoAndWitnessOutput.witness

              const walletTx = new WalletTx(
                tbtcContracts,
                bitcoinClient,
                witness
              )

              beforeEach(async () => {
                ;({
                  transactionHash,
                  newMainUtxo,
                  rawTransaction: transaction,
                } = await walletTx.depositSweep.assembleTransaction(
                  fee,
                  testnetWalletPrivateKey,
                  utxosWithRaw,
                  deposit
                ))
              })

              it("should return sweep transaction with proper structure", () => {
                // Compare HEXes.
                expect(transaction).to.be.eql(
                  depositSweepWithNoMainUtxoAndWitnessOutput.expectedSweep
                    .transaction
                )

                // Convert raw transaction to JSON to make detailed comparison.
                const buffer = Buffer.from(transaction.transactionHex, "hex")
                const txJSON = bcoin.TX.fromRaw(buffer).getJSON("testnet")

                expect(txJSON.hash).to.be.equal(
                  depositSweepWithNoMainUtxoAndWitnessOutput.expectedSweep.transactionHash.toString()
                )
                expect(txJSON.version).to.be.equal(1)

                // Validate inputs.
                expect(txJSON.inputs.length).to.be.equal(2)

                const p2shInput = txJSON.inputs[0]
                expect(p2shInput.prevout.hash).to.be.equal(
                  depositSweepWithNoMainUtxoAndWitnessOutput.deposits[0].utxo.transactionHash.toString()
                )
                expect(p2shInput.prevout.index).to.be.equal(
                  depositSweepWithNoMainUtxoAndWitnessOutput.deposits[0].utxo
                    .outputIndex
                )
                // Transaction should be signed. As it's not SegWit input, the `witness`
                // field should be empty, while the `script` field should be filled.
                expect(p2shInput.witness).to.be.equal("00")
                expect(p2shInput.script.length).to.be.greaterThan(0)
                // Input's address should be set to the address generated from deposit
                // script hash
                expect(p2shInput.address).to.be.equal(
                  testnetDepositScripthashAddress
                )

                const p2wshInput = txJSON.inputs[1]
                expect(p2wshInput.prevout.hash).to.be.equal(
                  depositSweepWithNoMainUtxoAndWitnessOutput.deposits[1].utxo.transactionHash.toString()
                )
                expect(p2wshInput.prevout.index).to.be.equal(
                  depositSweepWithNoMainUtxoAndWitnessOutput.deposits[1].utxo
                    .outputIndex
                )
                // Transaction should be signed. As it's a SegWit input, the `witness`
                // field should be filled, while the `script` field should be empty.
                expect(p2wshInput.witness.length).to.be.greaterThan(0)
                expect(p2wshInput.script.length).to.be.equal(0)
                // Input's address should be set to the address generated from deposit
                // witness script hash
                expect(p2wshInput.address).to.be.equal(
                  testnetDepositWitnessScripthashAddress
                )

                // Validate outputs.
                expect(txJSON.outputs.length).to.be.equal(1)
                const sweepOutput = txJSON.outputs[0]

                // Should be OP_0 <public-key-hash>. Public key corresponds to the
                // wallet BTC address.
                expect(sweepOutput.script).to.be.equal(
                  "00148db50eb52063ea9d98b3eac91489a90f738986f6"
                )
                // The output's address should be the wallet's address
                expect(sweepOutput.address).to.be.equal(testnetWalletAddress)
                // The output's value should be equal to the sum of all input values
                // minus fee (25000 + 12000 - 1600)
                expect(sweepOutput.value).to.be.equal(35400)
              })

              it("should return the proper transaction hash", async () => {
                expect(transactionHash).to.be.deep.equal(
                  depositSweepWithNoMainUtxoAndWitnessOutput.expectedSweep
                    .transactionHash
                )
              })

              it("should return the proper new main UTXO", () => {
                const expectedNewMainUtxo = {
                  transactionHash:
                    depositSweepWithNoMainUtxoAndWitnessOutput.expectedSweep
                      .transactionHash,
                  outputIndex: 0,
                  value: BigNumber.from(35400),
                }

                expect(newMainUtxo).to.be.eql(expectedNewMainUtxo)
              })
            }
          )

          context("when there is main UTXO from previous deposit sweep", () => {
            context(
              "when main UTXO prom previous deposit sweep is witness",
              () => {
                let transactionHash: BitcoinTxHash
                let newMainUtxo: BitcoinUtxo
                let transaction: BitcoinRawTx

                const utxosWithRaw =
                  depositSweepWithWitnessMainUtxoAndWitnessOutput.deposits.map(
                    (deposit) => {
                      return deposit.utxo
                    }
                  )

                const deposit =
                  depositSweepWithWitnessMainUtxoAndWitnessOutput.deposits.map(
                    (deposit) => {
                      return deposit.data
                    }
                  )

                // P2WPKH
                const mainUtxoWithRaw =
                  depositSweepWithWitnessMainUtxoAndWitnessOutput.mainUtxo

                const witness =
                  depositSweepWithWitnessMainUtxoAndWitnessOutput.witness

                const walletTx = new WalletTx(
                  tbtcContracts,
                  bitcoinClient,
                  witness
                )

                beforeEach(async () => {
                  ;({
                    transactionHash,
                    newMainUtxo,
                    rawTransaction: transaction,
                  } = await walletTx.depositSweep.assembleTransaction(
                    fee,
                    testnetWalletPrivateKey,
                    utxosWithRaw,
                    deposit,
                    mainUtxoWithRaw
                  ))
                })

                it("should return sweep transaction with proper structure", () => {
                  // Compare HEXes.
                  expect(transaction).to.be.eql(
                    depositSweepWithWitnessMainUtxoAndWitnessOutput
                      .expectedSweep.transaction
                  )

                  // Convert raw transaction to JSON to make detailed comparison.
                  const buffer = Buffer.from(transaction.transactionHex, "hex")
                  const txJSON = bcoin.TX.fromRaw(buffer).getJSON("testnet")

                  expect(txJSON.hash).to.be.equal(
                    depositSweepWithWitnessMainUtxoAndWitnessOutput.expectedSweep.transactionHash.toString()
                  )
                  expect(txJSON.version).to.be.equal(1)

                  // Validate inputs.
                  expect(txJSON.inputs.length).to.be.equal(3)

                  const p2wkhInput = txJSON.inputs[0]
                  expect(p2wkhInput.prevout.hash).to.be.equal(
                    depositSweepWithWitnessMainUtxoAndWitnessOutput.mainUtxo.transactionHash.toString()
                  )
                  expect(p2wkhInput.prevout.index).to.be.equal(
                    depositSweepWithWitnessMainUtxoAndWitnessOutput.mainUtxo
                      .outputIndex
                  )
                  // Transaction should be signed. As it's a SegWit input, the `witness`
                  // field should be filled, while the `script` field should be empty.
                  expect(p2wkhInput.witness.length).to.be.greaterThan(0)
                  expect(p2wkhInput.script.length).to.be.equal(0)
                  // The input comes from the main UTXO so the input should be the
                  // wallet's address
                  expect(p2wkhInput.address).to.be.equal(testnetWalletAddress)

                  const p2shInput = txJSON.inputs[1]
                  expect(p2shInput.prevout.hash).to.be.equal(
                    depositSweepWithWitnessMainUtxoAndWitnessOutput.deposits[0].utxo.transactionHash.toString()
                  )
                  expect(p2shInput.prevout.index).to.be.equal(
                    depositSweepWithWitnessMainUtxoAndWitnessOutput.deposits[0]
                      .utxo.outputIndex
                  )
                  // Transaction should be signed. As it's not SegWit input, the `witness`
                  // field should be empty, while the `script` field should be filled.
                  expect(p2shInput.witness).to.be.equal("00")
                  expect(p2shInput.script.length).to.be.greaterThan(0)
                  // Input's address should be set to the address generated from deposit
                  // script hash
                  expect(p2shInput.address).to.be.equal(
                    testnetDepositScripthashAddress
                  )

                  const p2wshInput = txJSON.inputs[2]
                  expect(p2wshInput.prevout.hash).to.be.equal(
                    depositSweepWithWitnessMainUtxoAndWitnessOutput.deposits[1].utxo.transactionHash.toString()
                  )
                  expect(p2wshInput.prevout.index).to.be.equal(
                    depositSweepWithWitnessMainUtxoAndWitnessOutput.deposits[1]
                      .utxo.outputIndex
                  )
                  // Transaction should be signed. As it's a SegWit input, the `witness`
                  // field should be filled, while the `script` field should be empty.
                  expect(p2wshInput.witness.length).to.be.greaterThan(0)
                  expect(p2wshInput.script.length).to.be.equal(0)
                  // Input's address should be set to the address generated from deposit
                  // witness script hash
                  expect(p2wshInput.address).to.be.equal(
                    testnetDepositWitnessScripthashAddress
                  )

                  // Validate outputs.
                  expect(txJSON.outputs.length).to.be.equal(1)

                  const sweepOutput = txJSON.outputs[0]
                  // Should be OP_0 <public-key-hash>. Public key corresponds to the
                  // wallet BTC address.
                  expect(sweepOutput.script).to.be.equal(
                    "00148db50eb52063ea9d98b3eac91489a90f738986f6"
                  )
                  // The output's address should be the wallet's address
                  expect(sweepOutput.address).to.be.equal(testnetWalletAddress)
                  // The output's value should be equal to the sum of all input values
                  // minus fee (17000 + 10000 + 35400 - 1600)
                  expect(sweepOutput.value).to.be.equal(60800)
                })

                it("should return the proper transaction hash", async () => {
                  expect(transactionHash).to.be.deep.equal(
                    depositSweepWithWitnessMainUtxoAndWitnessOutput
                      .expectedSweep.transactionHash
                  )
                })

                it("should return the proper new main UTXO", () => {
                  const expectedNewMainUtxo = {
                    transactionHash:
                      depositSweepWithWitnessMainUtxoAndWitnessOutput
                        .expectedSweep.transactionHash,
                    outputIndex: 0,
                    value: BigNumber.from(60800),
                  }

                  expect(newMainUtxo).to.be.eql(expectedNewMainUtxo)
                })
              }
            )

            context(
              "when main UTXO from previous deposit sweep is non-witness",
              () => {
                let transactionHash: BitcoinTxHash
                let newMainUtxo: BitcoinUtxo
                let transaction: BitcoinRawTx

                const utxosWithRaw =
                  depositSweepWithNonWitnessMainUtxoAndWitnessOutput.deposits.map(
                    (deposit) => {
                      return deposit.utxo
                    }
                  )

                const deposit =
                  depositSweepWithNonWitnessMainUtxoAndWitnessOutput.deposits.map(
                    (deposit) => {
                      return deposit.data
                    }
                  )

                // P2WPKH
                const mainUtxoWithRaw =
                  depositSweepWithNonWitnessMainUtxoAndWitnessOutput.mainUtxo

                const witness =
                  depositSweepWithNonWitnessMainUtxoAndWitnessOutput.witness

                const walletTx = new WalletTx(
                  tbtcContracts,
                  bitcoinClient,
                  witness
                )

                beforeEach(async () => {
                  ;({
                    transactionHash,
                    newMainUtxo,
                    rawTransaction: transaction,
                  } = await walletTx.depositSweep.assembleTransaction(
                    fee,
                    testnetWalletPrivateKey,
                    utxosWithRaw,
                    deposit,
                    mainUtxoWithRaw
                  ))
                })

                it("should return sweep transaction with proper structure", () => {
                  // Compare HEXes.
                  expect(transaction).to.be.eql(
                    depositSweepWithNonWitnessMainUtxoAndWitnessOutput
                      .expectedSweep.transaction
                  )

                  // Convert raw transaction to JSON to make detailed comparison.
                  const buffer = Buffer.from(transaction.transactionHex, "hex")
                  const txJSON = bcoin.TX.fromRaw(buffer).getJSON("testnet")

                  expect(txJSON.hash).to.be.equal(
                    depositSweepWithNonWitnessMainUtxoAndWitnessOutput.expectedSweep.transactionHash.toString()
                  )
                  expect(txJSON.version).to.be.equal(1)

                  // Validate inputs.
                  expect(txJSON.inputs.length).to.be.equal(2)

                  const p2wshInput = txJSON.inputs[0]
                  expect(p2wshInput.prevout.hash).to.be.equal(
                    depositSweepWithNonWitnessMainUtxoAndWitnessOutput.deposits[0].utxo.transactionHash.toString()
                  )
                  expect(p2wshInput.prevout.index).to.be.equal(
                    depositSweepWithNonWitnessMainUtxoAndWitnessOutput
                      .deposits[0].utxo.outputIndex
                  )
                  // Transaction should be signed. As it's a SegWit input, the `witness`
                  // field should be filled, while the `script` field should be empty.
                  expect(p2wshInput.witness.length).to.be.greaterThan(0)
                  expect(p2wshInput.script.length).to.be.equal(0)
                  // Input's address should be set to the address generated from deposit
                  // script hash
                  expect(p2wshInput.address).to.be.equal(
                    "tb1qk8urugnf08wfle6wslmdxq7mkz9z0gw8e6gkvspn7dx87tfpfntshdm7qr"
                  )

                  const p2pkhInput = txJSON.inputs[1] // main UTXO
                  expect(p2pkhInput.prevout.hash).to.be.equal(
                    depositSweepWithNonWitnessMainUtxoAndWitnessOutput.mainUtxo.transactionHash.toString()
                  )
                  expect(p2pkhInput.prevout.index).to.be.equal(
                    depositSweepWithNonWitnessMainUtxoAndWitnessOutput.mainUtxo
                      .outputIndex
                  )
                  // Transaction should be signed. As it's not SegWit input, the `witness`
                  // field should be empty, while the `script` field should be filled.
                  expect(p2pkhInput.witness).to.be.equal("00")
                  expect(p2pkhInput.script.length).to.be.greaterThan(0)
                  // The input comes from the main UTXO so the input should be the
                  // wallet's address
                  expect(p2pkhInput.address).to.be.equal(
                    "mtSEUCE7G8om9zJttG9twtjoiSsUz7QnY9"
                  )

                  // Validate outputs.
                  expect(txJSON.outputs.length).to.be.equal(1)

                  const sweepOutput = txJSON.outputs[0]
                  // Should be OP_0 <public-key-hash>. Public key corresponds to the
                  // wallet BTC address.
                  expect(sweepOutput.script).to.be.equal(
                    "00148db50eb52063ea9d98b3eac91489a90f738986f6"
                  )
                  // The output's address should be the wallet's address
                  expect(sweepOutput.address).to.be.equal(testnetWalletAddress)
                  // The output's value should be equal to the sum of all input values
                  // minus fee (16400 + 19000 - 1600)
                  expect(sweepOutput.value).to.be.equal(33800)
                })

                it("should return the proper transaction hash", async () => {
                  expect(transactionHash).to.be.deep.equal(
                    depositSweepWithNonWitnessMainUtxoAndWitnessOutput
                      .expectedSweep.transactionHash
                  )
                })

                it("should return the proper new main UTXO", () => {
                  const expectedNewMainUtxo = {
                    transactionHash:
                      depositSweepWithNonWitnessMainUtxoAndWitnessOutput
                        .expectedSweep.transactionHash,
                    outputIndex: 0,
                    value: BigNumber.from(33800),
                  }

                  expect(newMainUtxo).to.be.eql(expectedNewMainUtxo)
                })
              }
            )
          })
        })

        context("when the new main UTXO is requested to be non-witness", () => {
          // The only difference between deposit sweep transactions with witness and
          // non-witness output is the output type itself.
          // Therefore only one test case was added for non-witness transactions.
          let transactionHash: BitcoinTxHash
          let newMainUtxo: BitcoinUtxo
          let transaction: BitcoinRawTx

          const utxosWithRaw =
            depositSweepWithNoMainUtxoAndNonWitnessOutput.deposits.map(
              (deposit) => {
                return deposit.utxo
              }
            )

          const deposit =
            depositSweepWithNoMainUtxoAndNonWitnessOutput.deposits.map(
              (deposit) => {
                return deposit.data
              }
            )

          const witness = depositSweepWithNoMainUtxoAndNonWitnessOutput.witness

          const walletTx = new WalletTx(tbtcContracts, bitcoinClient, witness)

          beforeEach(async () => {
            ;({
              transactionHash,
              newMainUtxo,
              rawTransaction: transaction,
            } = await walletTx.depositSweep.assembleTransaction(
              fee,
              testnetWalletPrivateKey,
              utxosWithRaw,
              deposit
            ))
          })

          it("should return sweep transaction with proper structure", () => {
            // Compare HEXes.
            expect(transaction).to.be.eql(
              depositSweepWithNoMainUtxoAndNonWitnessOutput.expectedSweep
                .transaction
            )

            // Convert raw transaction to JSON to make detailed comparison.
            const buffer = Buffer.from(transaction.transactionHex, "hex")
            const txJSON = bcoin.TX.fromRaw(buffer).getJSON("testnet")

            expect(txJSON.hash).to.be.equal(
              depositSweepWithNoMainUtxoAndNonWitnessOutput.expectedSweep.transactionHash.toString()
            )
            expect(txJSON.version).to.be.equal(1)

            // Validate inputs.
            expect(txJSON.inputs.length).to.be.equal(1)

            const p2shInput = txJSON.inputs[0]
            expect(p2shInput.prevout.hash).to.be.equal(
              depositSweepWithNoMainUtxoAndNonWitnessOutput.deposits[0].utxo.transactionHash.toString()
            )
            expect(p2shInput.prevout.index).to.be.equal(
              depositSweepWithNoMainUtxoAndNonWitnessOutput.deposits[0].utxo
                .outputIndex
            )
            // Transaction should be signed. As it's not SegWit input, the `witness`
            // field should be empty, while the `script` field should be filled.
            expect(p2shInput.witness).to.be.equal("00")
            expect(p2shInput.script.length).to.be.greaterThan(0)
            // Input's address should be set to the address generated from deposit
            // script hash
            expect(p2shInput.address).to.be.equal(
              "2N8iF1pRndihBzgLDna9MfRhmqktwTdHejA"
            )

            // Validate outputs.
            expect(txJSON.outputs.length).to.be.equal(1)

            const sweepOutput = txJSON.outputs[0]
            // OP_DUP OP_HASH160 0x14 0x8db50eb52063ea9d98b3eac91489a90f738986f6
            // OP_EQUALVERIFY OP_CHECKSIG
            expect(sweepOutput.script).to.be.equal(
              "76a9148db50eb52063ea9d98b3eac91489a90f738986f688ac"
            )
            // The output's address should be the wallet's address
            expect(sweepOutput.address).to.be.equal(
              "mtSEUCE7G8om9zJttG9twtjoiSsUz7QnY9"
            )
            // The output's value should be equal to the sum of all input values
            // minus fee (15000- 1600)
            expect(sweepOutput.value).to.be.equal(13400)
          })

          it("should return the proper transaction hash", async () => {
            expect(transactionHash).to.be.deep.equal(
              depositSweepWithNoMainUtxoAndNonWitnessOutput.expectedSweep
                .transactionHash
            )
          })

          it("should return the proper new main UTXO", () => {
            const expectedNewMainUtxo = {
              transactionHash:
                depositSweepWithNoMainUtxoAndNonWitnessOutput.expectedSweep
                  .transactionHash,
              outputIndex: 0,
              value: BigNumber.from(13400),
            }

            expect(newMainUtxo).to.be.deep.equal(expectedNewMainUtxo)
          })
        })

        context("when there are no UTXOs", () => {
          it("should revert", async () => {
            const walletTx = new WalletTx(tbtcContracts, bitcoinClient)

            await expect(
              walletTx.depositSweep.assembleTransaction(
                fee,
                testnetWalletPrivateKey,
                [],
                []
              )
            ).to.be.rejectedWith(
              "There must be at least one deposit UTXO to sweep"
            )
          })
        })

        context(
          "when the numbers of UTXOs and deposit elements are not equal",
          () => {
            const utxosWithRaw =
              depositSweepWithNoMainUtxoAndWitnessOutput.deposits.map(
                (data) => {
                  return data.utxo
                }
              )

            // Add only one element to the deposit
            const deposit = [
              depositSweepWithNoMainUtxoAndWitnessOutput.deposits[0].data,
            ]

            const witness = depositSweepWithNoMainUtxoAndWitnessOutput.witness

            it("should revert", async () => {
              const walletTx = new WalletTx(
                tbtcContracts,
                bitcoinClient,
                witness
              )

              await expect(
                walletTx.depositSweep.assembleTransaction(
                  fee,
                  testnetWalletPrivateKey,
                  utxosWithRaw,
                  deposit
                )
              ).to.be.rejectedWith(
                "Number of UTXOs must equal the number of deposit elements"
              )
            })
          }
        )

        context("when the main UTXO does not belong to the wallet", () => {
          const utxoWithRaw =
            depositSweepWithNoMainUtxoAndWitnessOutput.deposits[0].utxo
          const deposit =
            depositSweepWithNoMainUtxoAndWitnessOutput.deposits[0].data

          // The UTXO below does not belong to the wallet
          const mainUtxoWithRaw = {
            transactionHash: BitcoinTxHash.from(
              "2f952bdc206bf51bb745b967cb7166149becada878d3191ffe341155ebcd4883"
            ),
            outputIndex: 1,
            value: BigNumber.from(3933200),
            transactionHex:
              "0100000000010162cae24e74ad64f9f0493b09f3964908b3b3038f4924882d3d" +
              "bd853b4c9bc7390100000000ffffffff02102700000000000017a914867120d5" +
              "480a9cc0c11c1193fa59b3a92e852da78710043c00000000001600147ac2d937" +
              "8a1c47e589dfb8095ca95ed2140d272602483045022100b70bd9b7f5d230444a" +
              "542c7971bea79786b4ebde6703cee7b6ee8cd16e115ebf02204d50ea9d1ee08d" +
              "e9741498c2cc64266e40d52c4adb9ef68e65aa2727cd4208b5012102ee067a02" +
              "73f2e3ba88d23140a24fdb290f27bbcd0f94117a9c65be3911c5c04e00000000",
          }

          it("should revert", async () => {
            const walletTx = new WalletTx(tbtcContracts, bitcoinClient)

            await expect(
              walletTx.depositSweep.assembleTransaction(
                fee,
                testnetWalletPrivateKey,
                [utxoWithRaw],
                [deposit],
                mainUtxoWithRaw
              )
            ).to.be.rejectedWith("UTXO does not belong to the wallet")
          })
        })

        context(
          "when the wallet private does not correspond to the wallet public key",
          () => {
            const utxoWithRaw =
              depositSweepWithNoMainUtxoAndWitnessOutput.deposits[0].utxo
            const deposit =
              depositSweepWithNoMainUtxoAndWitnessOutput.deposits[0].data
            const anotherPrivateKey =
              "cRJvyxtoggjAm9A94cB86hZ7Y62z2ei5VNJHLksFi2xdnz1GJ6xt"

            it("should revert", async () => {
              const walletTx = new WalletTx(tbtcContracts, bitcoinClient)

              await expect(
                walletTx.depositSweep.assembleTransaction(
                  fee,
                  anotherPrivateKey,
                  [utxoWithRaw],
                  [deposit]
                )
              ).to.be.rejectedWith(
                "Wallet public key does not correspond to wallet private key"
              )
            })
          }
        )

        context("when the type of UTXO is unsupported", () => {
          // Use coinbase transaction of some block
          const utxoWithRaw = {
            transactionHash: BitcoinTxHash.from(
              "025de155e6f2ffbbf4851493e0d28dad54020db221a3f38bf63c1f65e3d3595b"
            ),
            outputIndex: 0,
            value: BigNumber.from(5000000000),
            transactionHex:
              "010000000100000000000000000000000000000000000000000000000000000000" +
              "00000000ffffffff0e04db07c34f0103062f503253482fffffffff0100f2052a01" +
              "000000232102db6a0f2ef2e970eb1d2a84eabb5337f9cac0d85b49f209bffc4ec6" +
              "805802e6a5ac00000000",
          }
          const deposit =
            depositSweepWithNoMainUtxoAndWitnessOutput.deposits[0].data

          it("should revert", async () => {
            const walletTx = new WalletTx(tbtcContracts, bitcoinClient)

            await expect(
              walletTx.depositSweep.assembleTransaction(
                fee,
                testnetWalletPrivateKey,
                [utxoWithRaw],
                [deposit]
              )
            ).to.be.rejectedWith("Unsupported UTXO script type")
          })
        })
      })
    })
  })

  describe("Spv", () => {
    describe("submitDepositSweepProof", () => {
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
          depositSweepProof.bitcoinChainData.transaction.transactionHash
        const transactions = new Map<string, BitcoinTx>()
        transactions.set(
          transactionHash.toString(),
          depositSweepProof.bitcoinChainData.transaction
        )
        bitcoinClient.transactions = transactions

        const rawTransactions = new Map<string, BitcoinRawTx>()
        rawTransactions.set(
          transactionHash.toString(),
          depositSweepProof.bitcoinChainData.rawTransaction
        )
        bitcoinClient.rawTransactions = rawTransactions

        bitcoinClient.latestHeight =
          depositSweepProof.bitcoinChainData.latestBlockHeight
        bitcoinClient.headersChain =
          depositSweepProof.bitcoinChainData.headersChain
        bitcoinClient.transactionMerkle =
          depositSweepProof.bitcoinChainData.transactionMerkleBranch
        const confirmations = new Map<string, number>()
        confirmations.set(
          transactionHash.toString(),
          depositSweepProof.bitcoinChainData.accumulatedTxConfirmations
        )
        bitcoinClient.confirmations = confirmations
        await maintenanceService.spv.submitDepositSweepProof(
          transactionHash,
          NO_MAIN_UTXO
        )
      })

      it("should submit deposit sweep proof with correct arguments", () => {
        const bridgeLog = tbtcContracts.bridge.depositSweepProofLog
        expect(bridgeLog.length).to.equal(1)
        expect(bridgeLog[0].mainUtxo).to.equal(NO_MAIN_UTXO)
        expect(bridgeLog[0].sweepTx).to.deep.equal(
          depositSweepProof.expectedSweepProof.sweepTx
        )
        expect(bridgeLog[0].sweepProof.txIndexInBlock).to.deep.equal(
          depositSweepProof.expectedSweepProof.sweepProof.txIndexInBlock
        )
        expect(bridgeLog[0].sweepProof.merkleProof).to.deep.equal(
          depositSweepProof.expectedSweepProof.sweepProof.merkleProof
        )
        expect(bridgeLog[0].sweepProof.bitcoinHeaders).to.deep.equal(
          depositSweepProof.expectedSweepProof.sweepProof.bitcoinHeaders
        )
      })
    })
  })
})
