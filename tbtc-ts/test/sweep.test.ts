import TBTC from "./../src"
import { BigNumber } from "ethers"
import { RawTransaction, UnspentTransactionOutput } from "../src/bitcoin"
import {
  testnetDepositScripthashAddress,
  testnetDepositWitnessScripthashAddress,
  testnetWalletAddress,
  testnetWalletPrivateKey,
} from "./data/deposit"
import {
  sweepWithMainUtxo,
  sweepWithNoMainUtxo,
  sweepProof,
  NO_MAIN_UTXO,
} from "./data/sweep"
import { Transaction } from "../src/bitcoin"
import { MockBitcoinClient } from "./utils/mock-bitcoin-client"
import { MockBridge } from "./utils/mock-bridge"
// @ts-ignore
import bcoin from "bcoin"
import * as chai from "chai"
import chaiAsPromised from "chai-as-promised"
chai.use(chaiAsPromised)
import { expect } from "chai"

describe("Sweep", () => {
  const fee = BigNumber.from(1600)

  describe("sweepDeposits", () => {
    let bitcoinClient: MockBitcoinClient

    beforeEach(async () => {
      bcoin.set("testnet")
      bitcoinClient = new MockBitcoinClient()

      // Map transaction hashes for UTXOs to transactions in hexadecimal and
      // set the mapping in the mock Bitcoin client
      const rawTransactions = new Map<string, RawTransaction>()
      for (const deposit of sweepWithNoMainUtxo.deposits) {
        rawTransactions.set(deposit.utxo.transactionHash, {
          transactionHex: deposit.utxo.transactionHex,
        })
      }
      for (const deposit of sweepWithMainUtxo.deposits) {
        rawTransactions.set(deposit.utxo.transactionHash, {
          transactionHex: deposit.utxo.transactionHex,
        })
      }
      rawTransactions.set(
        sweepWithNoMainUtxo.expectedSweep.transactionHash,
        sweepWithNoMainUtxo.expectedSweep.transaction
      )
      bitcoinClient.rawTransactions = rawTransactions
    })

    context("when there is no main UTXO", () => {
      beforeEach(async () => {
        const utxos: UnspentTransactionOutput[] =
          sweepWithNoMainUtxo.deposits.map((data) => {
            return data.utxo
          })

        const depositData = sweepWithNoMainUtxo.deposits.map((deposit) => {
          return deposit.data
        })

        await TBTC.sweepDeposits(
          bitcoinClient,
          fee,
          testnetWalletPrivateKey,
          utxos,
          depositData
        )
      })

      it("should broadcast sweep transaction with proper structure", async () => {
        expect(bitcoinClient.broadcastLog.length).to.be.equal(1)
        expect(bitcoinClient.broadcastLog[0]).to.be.eql(
          sweepWithNoMainUtxo.expectedSweep.transaction
        )
      })
    })

    context("when there is main UTXO", () => {
      beforeEach(async () => {
        const utxos: UnspentTransactionOutput[] =
          sweepWithMainUtxo.deposits.map((deposit) => {
            return deposit.utxo
          })

        const depositData = sweepWithMainUtxo.deposits.map((deposit) => {
          return deposit.data
        })

        await TBTC.sweepDeposits(
          bitcoinClient,
          fee,
          testnetWalletPrivateKey,
          utxos,
          depositData,
          sweepWithMainUtxo.mainUtxo
        )
      })

      it("should broadcast sweep transaction with proper structure", async () => {
        expect(bitcoinClient.broadcastLog.length).to.be.equal(1)
        expect(bitcoinClient.broadcastLog[0]).to.be.eql(
          sweepWithMainUtxo.expectedSweep.transaction
        )
      })
    })
  })

  describe("createSweepTransaction", () => {
    context("when there is no main UTXO", () => {
      let transaction: RawTransaction

      const utxosWithRaw = sweepWithNoMainUtxo.deposits.map((data) => {
        return data.utxo
      })

      const depositData = sweepWithNoMainUtxo.deposits.map((deposit) => {
        return deposit.data
      })

      beforeEach(async () => {
        transaction = await TBTC.createSweepTransaction(
          fee,
          testnetWalletPrivateKey,
          utxosWithRaw,
          depositData
        )
      })

      it("should return sweep transaction with proper structure", () => {
        // Compare HEXes.
        expect(transaction).to.be.eql(
          sweepWithNoMainUtxo.expectedSweep.transaction
        )

        // Convert raw transaction to JSON to make detailed comparison.
        const buffer = Buffer.from(transaction.transactionHex, "hex")
        const txJSON = bcoin.TX.fromRaw(buffer).getJSON("testnet")

        expect(txJSON.hash).to.be.equal(
          sweepWithNoMainUtxo.expectedSweep.transactionHash
        )
        expect(txJSON.version).to.be.equal(1)

        // Validate inputs.
        expect(txJSON.inputs.length).to.be.equal(2)

        const p2shInput = txJSON.inputs[0]
        expect(p2shInput.prevout.hash).to.be.equal(
          sweepWithNoMainUtxo.deposits[0].utxo.transactionHash
        )
        expect(p2shInput.prevout.index).to.be.equal(
          sweepWithNoMainUtxo.deposits[0].utxo.outputIndex
        )
        // Transaction should be signed. As it's not SegWit input, the `witness`
        // field should be empty, while the `script` field should be filled.
        expect(p2shInput.witness).to.be.equal("00")
        expect(p2shInput.script.length).to.be.greaterThan(0)
        // Input's address should be set to the address generated from deposit
        // script hash
        expect(p2shInput.address).to.be.equal(testnetDepositScripthashAddress)

        const p2wshInput = txJSON.inputs[1]
        expect(p2wshInput.prevout.hash).to.be.equal(
          sweepWithNoMainUtxo.deposits[1].utxo.transactionHash
        )
        expect(p2wshInput.prevout.index).to.be.equal(
          sweepWithNoMainUtxo.deposits[1].utxo.outputIndex
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
    })

    context("when there is main UTXO", () => {
      let transaction: RawTransaction

      const utxosWithRaw = sweepWithMainUtxo.deposits.map((deposit) => {
        return deposit.utxo
      })

      const depositData = sweepWithMainUtxo.deposits.map((deposit) => {
        return deposit.data
      })

      // P2WKH
      const mainUtxoWithRaw = sweepWithMainUtxo.mainUtxo

      beforeEach(async () => {
        transaction = await TBTC.createSweepTransaction(
          fee,
          testnetWalletPrivateKey,
          utxosWithRaw,
          depositData,
          mainUtxoWithRaw
        )
      })

      it("should return sweep transaction with proper structure", () => {
        // Compare HEXes.
        expect(transaction).to.be.eql(
          sweepWithMainUtxo.expectedSweep.transaction
        )

        // Convert raw transaction to JSON to make detailed comparison.
        const buffer = Buffer.from(transaction.transactionHex, "hex")
        const txJSON = bcoin.TX.fromRaw(buffer).getJSON("testnet")

        expect(txJSON.hash).to.be.equal(
          sweepWithMainUtxo.expectedSweep.transactionHash
        )
        expect(txJSON.version).to.be.equal(1)

        // Validate inputs.
        expect(txJSON.inputs.length).to.be.equal(3)

        const p2wkhInput = txJSON.inputs[0]
        expect(p2wkhInput.prevout.hash).to.be.equal(
          sweepWithMainUtxo.mainUtxo.transactionHash
        )
        expect(p2wkhInput.prevout.index).to.be.equal(
          sweepWithMainUtxo.mainUtxo.outputIndex
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
          sweepWithMainUtxo.deposits[0].utxo.transactionHash
        )
        expect(p2shInput.prevout.index).to.be.equal(
          sweepWithMainUtxo.deposits[0].utxo.outputIndex
        )
        // Transaction should be signed. As it's not SegWit input, the `witness`
        // field should be empty, while the `script` field should be filled.
        expect(p2shInput.witness).to.be.equal("00")
        expect(p2shInput.script.length).to.be.greaterThan(0)
        // Input's address should be set to the address generated from deposit
        // script hash
        expect(p2shInput.address).to.be.equal(testnetDepositScripthashAddress)

        const p2wshInput = txJSON.inputs[2]
        expect(p2wshInput.prevout.hash).to.be.equal(
          sweepWithMainUtxo.deposits[1].utxo.transactionHash
        )
        expect(p2wshInput.prevout.index).to.be.equal(
          sweepWithMainUtxo.deposits[1].utxo.outputIndex
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
    })

    context("when there are no UTXOs", () => {
      it("should revert", async () => {
        await expect(
          TBTC.createSweepTransaction(fee, testnetWalletPrivateKey, [], [])
        ).to.be.rejectedWith("There must be at least one deposit UTXO to sweep")
      })
    })

    context(
      "when the numbers of UTXOs and deposit data elements are not equal",
      () => {
        const utxosWithRaw = sweepWithNoMainUtxo.deposits.map((data) => {
          return data.utxo
        })

        // Add only one element to deposit data
        const depositData = [sweepWithNoMainUtxo.deposits[0].data]

        it("should revert", async () => {
          await expect(
            TBTC.createSweepTransaction(
              fee,
              testnetWalletPrivateKey,
              utxosWithRaw,
              depositData
            )
          ).to.be.rejectedWith(
            "Number of UTXOs must equal the number of deposit data elements"
          )
        })
      }
    )

    context(
      "when there is a mismatch between the UTXO's value and amount in deposit data",
      () => {
        const utxoWithRaw = sweepWithNoMainUtxo.deposits[0].utxo
        // Use a deposit data that does not match the UTXO
        const depositData = sweepWithNoMainUtxo.deposits[1].data

        it("should revert", async () => {
          await expect(
            TBTC.createSweepTransaction(
              fee,
              testnetWalletPrivateKey,
              [utxoWithRaw],
              [depositData]
            )
          ).to.be.rejectedWith(
            "Mismatch between amount in deposit data and deposit tx"
          )
        })
      }
    )

    context("when the main UTXO does not belong to the wallet", () => {
      const utxoWithRaw = sweepWithNoMainUtxo.deposits[0].utxo
      const depositData = sweepWithNoMainUtxo.deposits[0].data

      // The UTXO below does not belong to the wallet
      const mainUtxoWithRaw = {
        transactionHash:
          "2f952bdc206bf51bb745b967cb7166149becada878d3191ffe341155ebcd4883",
        outputIndex: 1,
        value: 3933200,
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
        await expect(
          TBTC.createSweepTransaction(
            fee,
            testnetWalletPrivateKey,
            [utxoWithRaw],
            [depositData],
            mainUtxoWithRaw
          )
        ).to.be.rejectedWith("UTXO does not belong to the wallet")
      })
    })

    context(
      "when the wallet private does not correspond to the signing group public key",
      () => {
        const utxoWithRaw = sweepWithNoMainUtxo.deposits[0].utxo
        const depositData = sweepWithNoMainUtxo.deposits[0].data
        const anotherPrivateKey =
          "cRJvyxtoggjAm9A94cB86hZ7Y62z2ei5VNJHLksFi2xdnz1GJ6xt"

        it("should revert", async () => {
          await expect(
            TBTC.createSweepTransaction(
              fee,
              anotherPrivateKey,
              [utxoWithRaw],
              [depositData]
            )
          ).to.be.rejectedWith(
            "Signing group public key does not correspond to wallet private key"
          )
        })
      }
    )

    context("when the type of UTXO is unsupported", () => {
      // Use coinbase transaction of some block
      const utxoWithRaw = {
        transactionHash:
          "025de155e6f2ffbbf4851493e0d28dad54020db221a3f38bf63c1f65e3d3595b",
        outputIndex: 0,
        value: 5000000000,
        transactionHex:
          "010000000100000000000000000000000000000000000000000000000000000000" +
          "00000000ffffffff0e04db07c34f0103062f503253482fffffffff0100f2052a01" +
          "000000232102db6a0f2ef2e970eb1d2a84eabb5337f9cac0d85b49f209bffc4ec6" +
          "805802e6a5ac00000000",
      }
      const depositData = sweepWithNoMainUtxo.deposits[0].data

      it("should revert", async () => {
        await expect(
          TBTC.createSweepTransaction(
            fee,
            testnetWalletPrivateKey,
            [utxoWithRaw],
            [depositData]
          )
        ).to.be.rejectedWith("Unsupported UTXO script type")
      })
    })
  })

  describe("proveSweep", () => {
    let bitcoinClient: MockBitcoinClient
    let bridge: MockBridge

    beforeEach(async () => {
      bcoin.set("testnet")

      bitcoinClient = new MockBitcoinClient()
      bridge = new MockBridge()

      const transactionHash = sweepProof.clientData.transaction.transactionHash
      const transactions = new Map<string, Transaction>()
      transactions.set(transactionHash, sweepProof.clientData.transaction)
      bitcoinClient.transactions = transactions

      const rawTransactions = new Map<string, RawTransaction>()
      rawTransactions.set(transactionHash, sweepProof.clientData.rawTransaction)
      bitcoinClient.rawTransactions = rawTransactions

      bitcoinClient.latestHeight = sweepProof.clientData.latestBlockHeight
      bitcoinClient.headersChain = sweepProof.clientData.headersChain
      bitcoinClient.transactionMerkle =
        sweepProof.clientData.transactionMerkleBranch
      const confirmations = new Map<string, number>()
      confirmations.set(
        transactionHash,
        sweepProof.clientData.accumulatedTxConfirmations
      )
      bitcoinClient.confirmations = confirmations
      await TBTC.proveSweep(
        transactionHash,
        NO_MAIN_UTXO,
        bridge,
        bitcoinClient
      )
    })

    it("should submit sweep proof with correct arguments", () => {
      const bridgeLog = bridge.sweepProofLog
      expect(bridgeLog.length).to.equal(1)
      expect(bridgeLog[0].mainUtxo).to.equal(NO_MAIN_UTXO)
      expect(bridgeLog[0].sweepTx).to.deep.equal(
        sweepProof.expectedSweepProof.sweepTx
      )
      expect(bridgeLog[0].sweepProof.txIndexInBlock).to.deep.equal(
        sweepProof.expectedSweepProof.sweepProof.txIndexInBlock
      )
      expect(bridgeLog[0].sweepProof.merkleProof).to.deep.equal(
        sweepProof.expectedSweepProof.sweepProof.merkleProof
      )
      expect(bridgeLog[0].sweepProof.bitcoinHeaders).to.deep.equal(
        sweepProof.expectedSweepProof.sweepProof.bitcoinHeaders
      )
    })
  })
})
