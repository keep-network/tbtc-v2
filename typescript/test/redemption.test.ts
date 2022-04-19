import TBTC from "./../src"
import { RawTransaction } from "../src/bitcoin"
// @ts-ignore
import bcoin from "bcoin"
import { MockBitcoinClient } from "./utils/mock-bitcoin-client"
import {
  testnetWalletPrivateKey,
  singleP2PKHAddressRedemption,
  singleP2WPKHAddressRedemption,
  singleP2SHAddressRedemption,
  singleP2WSHAddressRedemption,
  multipleAddressesRedemption,
  noChangeRedemption,
  RedemptionTestData,
  p2PKHChangeRedemption,
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

    context("when there are redemption requests provided", () => {
      context("when there is a change UTXO is created", () => {
        context("when the change output is P2WPKH", () => {
          context("when there is a single redeemer", () => {
            context("when the redeemer address type is P2PKH", () => {
              const data: RedemptionTestData = singleP2PKHAddressRedemption

              beforeEach(async () => {
                await runRedemptionScenario(
                  testnetWalletPrivateKey,
                  bitcoinClient,
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
                  testnetWalletPrivateKey,
                  bitcoinClient,
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
                  testnetWalletPrivateKey,
                  bitcoinClient,
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
                  testnetWalletPrivateKey,
                  bitcoinClient,
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
                testnetWalletPrivateKey,
                bitcoinClient,
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
          // Only a single test case for P2PKH change redemptions was added as
          // the type of the change output is the only difference.
          const data: RedemptionTestData = p2PKHChangeRedemption

          beforeEach(async () => {
            await runRedemptionScenario(
              testnetWalletPrivateKey,
              bitcoinClient,
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
            testnetWalletPrivateKey,
            bitcoinClient,
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
            testnetWalletPrivateKey,
            data.mainUtxo,
            [],
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
  data: RedemptionTestData
) {
  const rawTransactions = new Map<string, RawTransaction>()
  rawTransactions.set(data.mainUtxo.transactionHash, {
    transactionHex: data.mainUtxo.transactionHex,
  })
  bitcoinClient.rawTransactions = rawTransactions

  await TBTC.redeemDeposits(
    bitcoinClient,
    walletPrivKey,
    data.mainUtxo,
    data.redemptionRequests,
    data.witness
  )
}
