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
  noChangeRedemption,
  p2PKHChangeRedemption,
  RedemptionTestData,
} from "./data/redemption"
import { MockBridge } from "./utils/mock-bridge"
import * as chai from "chai"
import chaiAsPromised from "chai-as-promised"
chai.use(chaiAsPromised)
import { expect } from "chai"
import { BigNumberish } from "ethers"
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
    describe("when the change output is P2WPKH", () => {
      beforeEach(async () => {})

      it("should return transaction with proper structure", async () => {
        // TODO: Implement
      })
    })

    describe("when the change output is P2PKH", () => {
      // TODO: Implement
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
