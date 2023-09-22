import { BigNumber } from "ethers"
import { MockBitcoinClient } from "./utils/mock-bitcoin-client"
import * as chai from "chai"
import chaiAsPromised from "chai-as-promised"
chai.use(chaiAsPromised)
import { expect } from "chai"
import { submitDepositRefundTransaction } from "../src/deposit-refund"
import { TransactionHash, RawTransaction } from "./lib/bitcoin"
import {
  refunderPrivateKey,
  depositRefundOfWitnessDepositAndWitnessRefunderAddress,
  depositRefundOfNonWitnessDepositAndWitnessRefunderAddress,
  depositRefundOfWitnessDepositAndNonWitnessRefunderAddress,
} from "./data/deposit-refund"

describe("Refund", () => {
  const fee = BigNumber.from(1520)

  describe("submitDepositRefundTransaction", () => {
    let bitcoinClient: MockBitcoinClient

    beforeEach(async () => {
      bitcoinClient = new MockBitcoinClient()
    })

    context("when the refund transaction is requested to be witness", () => {
      context("when the refunded deposit was witness", () => {
        let transactionHash: TransactionHash

        beforeEach(async () => {
          const utxo =
            depositRefundOfWitnessDepositAndWitnessRefunderAddress.deposit.utxo
          const deposit =
            depositRefundOfWitnessDepositAndWitnessRefunderAddress.deposit.data
          const refunderAddress =
            depositRefundOfWitnessDepositAndWitnessRefunderAddress.refunderAddress
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
            depositRefundOfWitnessDepositAndWitnessRefunderAddress
              .expectedRefund.transaction
          )
        })

        it("should return the proper transaction hash", async () => {
          expect(transactionHash).to.be.deep.equal(
            depositRefundOfWitnessDepositAndWitnessRefunderAddress
              .expectedRefund.transactionHash
          )
        })
      })

      context("when the refunded deposit was non-witness", () => {
        let transactionHash: TransactionHash

        beforeEach(async () => {
          const utxo =
            depositRefundOfNonWitnessDepositAndWitnessRefunderAddress.deposit
              .utxo
          const deposit =
            depositRefundOfNonWitnessDepositAndWitnessRefunderAddress.deposit
              .data
          const refunderAddress =
            depositRefundOfNonWitnessDepositAndWitnessRefunderAddress.refunderAddress

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
            depositRefundOfNonWitnessDepositAndWitnessRefunderAddress
              .expectedRefund.transaction
          )
        })

        it("should return the proper transaction hash", async () => {
          expect(transactionHash).to.be.deep.equal(
            depositRefundOfNonWitnessDepositAndWitnessRefunderAddress
              .expectedRefund.transactionHash
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
            depositRefundOfWitnessDepositAndNonWitnessRefunderAddress.deposit
              .utxo
          const deposit =
            depositRefundOfWitnessDepositAndNonWitnessRefunderAddress.deposit
              .data
          const refunderAddress =
            depositRefundOfWitnessDepositAndNonWitnessRefunderAddress.refunderAddress

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
            depositRefundOfWitnessDepositAndNonWitnessRefunderAddress
              .expectedRefund.transaction
          )
        })

        it("should return the proper transaction hash", async () => {
          expect(transactionHash).to.be.deep.equal(
            depositRefundOfWitnessDepositAndNonWitnessRefunderAddress
              .expectedRefund.transactionHash
          )
        })
      }
    )
  })

  describe("assembleDepositRefundTransaction", () => {
    // TODO
  })
})
