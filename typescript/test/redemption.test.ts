import TBTC from "./../src"
import { RawTransaction } from "../src/bitcoin"
// @ts-ignore
import bcoin from "bcoin"
import { MockBitcoinClient } from "./utils/mock-bitcoin-client"
import {
  testnetWalletPrivateKey,
  singlePKHAddressRedemption,
  singleWPKHAddressRedemption,
  RedemptionTestData,
} from "./data/redemption"
import * as chai from "chai"
import chaiAsPromised from "chai-as-promised"
chai.use(chaiAsPromised)
import { expect } from "chai"

describe("Redemption", () => {
  describe("redeemDeposits", () => {
    let bitcoinClient: MockBitcoinClient

    beforeEach(async () => {
      bcoin.set("testnet")
      bitcoinClient = new MockBitcoinClient()
    })

    context("when the there is a single redeemer", () => {
      context("when the redeemer address is public key hash", () => {
        const data: RedemptionTestData = singlePKHAddressRedemption

        beforeEach(async () => {
          const rawTransactions = new Map<string, RawTransaction>()
          rawTransactions.set(data.mainUtxo.transactionHash, {
            transactionHex: data.mainUtxo.transactionHex,
          })
          bitcoinClient.rawTransactions = rawTransactions

          await TBTC.redeemDeposits(
            bitcoinClient,
            testnetWalletPrivateKey,
            data.mainUtxo,
            data.redemptionRequests
          )
        })

        it("should broadcast redemption transaction with proper structure", () => {
          expect(bitcoinClient.broadcastLog.length).to.be.equal(1)
          expect(bitcoinClient.broadcastLog[0]).to.be.eql(
            data.expectedRedemption.transaction
          )
        })
      })

      context("when the redeemer address is script hash", () => {
        // TODO: Implement
      })

      context("when the redeemer address is witness public key hash", () => {
        const data: RedemptionTestData = singleWPKHAddressRedemption

        beforeEach(async () => {
          const rawTransactions = new Map<string, RawTransaction>()
          rawTransactions.set(data.mainUtxo.transactionHash, {
            transactionHex: data.mainUtxo.transactionHex,
          })
          bitcoinClient.rawTransactions = rawTransactions

          await TBTC.redeemDeposits(
            bitcoinClient,
            testnetWalletPrivateKey,
            data.mainUtxo,
            data.redemptionRequests
          )
        })

        it("should broadcast redemption transaction with proper structure", () => {
          expect(bitcoinClient.broadcastLog.length).to.be.equal(1)
          expect(bitcoinClient.broadcastLog[0]).to.be.eql(
            data.expectedRedemption.transaction
          )
        })
      })

      context("when the redeemer address is witness script hash", () => {
        // TODO: Implement
      })
    })

    context("when there are multiple redeemers", () => {
      // TODO: Implement
    })
  })
})
