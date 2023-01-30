import { BigNumber } from "ethers"
import { MockBitcoinClient } from "./utils/mock-bitcoin-client"
import bcoin from "bcoin"
import * as chai from "chai"
import chaiAsPromised from "chai-as-promised"
chai.use(chaiAsPromised)
import { expect } from "chai"
import { submitDepositRefundTransaction } from "../src/deposit-refund"
import { TransactionHash, RawTransaction } from "./bitcoin"
import {
  refunderPrivateKey,
  depositRefundOfWitnessDepositAndWitnessOutput,
  depositRefundOfNonWitnessDepositAndWitnessOutput,
  depositRefundOfWitnessDepositAndNonWitnessOutput,
} from "./data/deposit-refund"

describe("Sweep", () => {
  const fee = BigNumber.from(1520)

  describe("submitDepositRefundTransaction", () => {
    let bitcoinClient: MockBitcoinClient

    beforeEach(async () => {
      bcoin.set("testnet")

      bitcoinClient = new MockBitcoinClient()
    })

    context("when the refund transaction is requested to be witness", () => {
      context("when the refunded deposit was witness", () => {
        let transactionHash: TransactionHash

        beforeEach(async () => {
          const utxo =
            depositRefundOfWitnessDepositAndWitnessOutput.deposit.utxo
          const deposit =
            depositRefundOfWitnessDepositAndWitnessOutput.deposit.data
          const refunderAddress =
            depositRefundOfWitnessDepositAndWitnessOutput.refunderAddress
          const refunderPrivateKey =
            "cTWhf1nXc7aW8BN2qLtWcPtcgcWYKfzRXkCJNsuQ86HR8uJBYfMc"

          const rawTransactions = new Map<string, RawTransaction>()
          rawTransactions.set(utxo.transactionHash.toString(), {
            transactionHex: utxo.transactionHex,
          })
          bitcoinClient.rawTransactions = rawTransactions
          ;({ transactionHash } = await submitDepositRefundTransaction(
            bitcoinClient,
            fee,
            utxo,
            deposit,
            refunderAddress,
            refunderPrivateKey
          ))
        })

        it("should broadcast refund transaction with proper structure", async () => {
          expect(bitcoinClient.broadcastLog.length).to.be.equal(1)
          expect(bitcoinClient.broadcastLog[0]).to.be.eql(
            depositRefundOfWitnessDepositAndWitnessOutput.expectedRefund
              .transaction
          )
        })

        it("should return the proper transaction hash", async () => {
          expect(transactionHash).to.be.deep.equal(
            depositRefundOfWitnessDepositAndWitnessOutput.expectedRefund
              .transactionHash
          )
        })
      })

      context("when the refunded deposit was non-witness", () => {
        let transactionHash: TransactionHash

        beforeEach(async () => {
          const utxo =
            depositRefundOfNonWitnessDepositAndWitnessOutput.deposit.utxo
          const deposit =
            depositRefundOfNonWitnessDepositAndWitnessOutput.deposit.data
          const refunderAddress =
            depositRefundOfNonWitnessDepositAndWitnessOutput.refunderAddress

          const rawTransactions = new Map<string, RawTransaction>()
          rawTransactions.set(utxo.transactionHash.toString(), {
            transactionHex: utxo.transactionHex,
          })
          bitcoinClient.rawTransactions = rawTransactions
          ;({ transactionHash } = await submitDepositRefundTransaction(
            bitcoinClient,
            fee,
            utxo,
            deposit,
            refunderAddress,
            refunderPrivateKey
          ))
        })

        it("should broadcast refund transaction with proper structure", async () => {
          expect(bitcoinClient.broadcastLog.length).to.be.equal(1)
          expect(bitcoinClient.broadcastLog[0]).to.be.eql(
            depositRefundOfNonWitnessDepositAndWitnessOutput.expectedRefund
              .transaction
          )
        })

        it("should return the proper transaction hash", async () => {
          expect(transactionHash).to.be.deep.equal(
            depositRefundOfNonWitnessDepositAndWitnessOutput.expectedRefund
              .transactionHash
          )
        })
      })
    })

    context(
      "when the refund transaction is requested to be non-witness",
      () => {
        let transactionHash: TransactionHash

        beforeEach(async () => {
          const utxo =
            depositRefundOfWitnessDepositAndNonWitnessOutput.deposit.utxo
          const deposit =
            depositRefundOfWitnessDepositAndNonWitnessOutput.deposit.data
          const refunderAddress =
            depositRefundOfWitnessDepositAndNonWitnessOutput.refunderAddress

          const rawTransactions = new Map<string, RawTransaction>()
          rawTransactions.set(utxo.transactionHash.toString(), {
            transactionHex: utxo.transactionHex,
          })
          bitcoinClient.rawTransactions = rawTransactions
          ;({ transactionHash } = await submitDepositRefundTransaction(
            bitcoinClient,
            fee,
            utxo,
            deposit,
            refunderAddress,
            refunderPrivateKey
          ))
        })

        it("should broadcast refund transaction with proper structure", async () => {
          expect(bitcoinClient.broadcastLog.length).to.be.equal(1)
          expect(bitcoinClient.broadcastLog[0]).to.be.eql(
            depositRefundOfWitnessDepositAndNonWitnessOutput.expectedRefund
              .transaction
          )
        })

        it("should return the proper transaction hash", async () => {
          expect(transactionHash).to.be.deep.equal(
            depositRefundOfWitnessDepositAndNonWitnessOutput.expectedRefund
              .transactionHash
          )
        })
      }
    )
  })

  describe("assembleDepositRefundTransaction", () => {
    // TODO
  })

  describe("prepareUnsignedDepositRefundTransaction", () => {
    // TODO
  })

  describe("prepareSignedDepositRefundTransaction", () => {
    // TODO
  })
})
