import { MockBitcoinClient } from "./utils/mock-bitcoin-client"
import { Transaction, SweepData } from "./bitcoin"
import {
  singleInputSweepProofTestData,
  multipleInputSweepProofTestData,
  SweepProofTestData,
} from "./data/sweepProof"
import TBTC from "./../src"
import { expect } from "chai"
// @ts-ignore
import bcoin from "bcoin"

describe("Sweep Proof", () => {
  describe("constructSweepProof", () => {
    let bitcoinClient: MockBitcoinClient

    beforeEach(async () => {
      bcoin.set("testnet")
      bitcoinClient = new MockBitcoinClient()
    })

    context("when the sweep transaction has one input", () => {
      let proof: SweepData

      beforeEach(async () => {
        proof = await runSweepProofScenario(singleInputSweepProofTestData)
      })

      it("should return the correct value of the sweep proof", async () => {
        const expectedData = singleInputSweepProofTestData.expectedSweepData
        expect(proof.txInfo.txVersion).to.equal(expectedData.txInfo.txVersion)
        expect(proof.txInfo.txInputVector).to.equal(
          expectedData.txInfo.txInputVector
        )
        expect(proof.txInfo.txOutputVector).to.equal(
          expectedData.txInfo.txOutputVector
        )
        expect(proof.txInfo.txLocktime).to.equal(expectedData.txInfo.txLocktime)
        expect(proof.txProof.merkleProof).to.equal(
          expectedData.txProof.merkleProof
        )
        expect(proof.txProof.txIndexInBlock).to.equal(
          expectedData.txProof.txIndexInBlock
        )
        expect(proof.txProof.bitcoinHeaders).to.equal(
          expectedData.txProof.bitcoinHeaders
        )
      })
    })

    context("when the sweep transaction has multiple inputs", () => {
      let proof: SweepData

      beforeEach(async () => {
        proof = await runSweepProofScenario(multipleInputSweepProofTestData)
      })

      it("should return the correct value of the sweep proof", async () => {
        const expectedData = multipleInputSweepProofTestData.expectedSweepData
        expect(proof.txInfo.txVersion).to.equal(expectedData.txInfo.txVersion)
        expect(proof.txInfo.txInputVector).to.equal(
          expectedData.txInfo.txInputVector
        )
        expect(proof.txInfo.txOutputVector).to.equal(
          expectedData.txInfo.txOutputVector
        )
        expect(proof.txInfo.txLocktime).to.equal(expectedData.txInfo.txLocktime)
        expect(proof.txProof.merkleProof).to.equal(
          expectedData.txProof.merkleProof
        )
        expect(proof.txProof.txIndexInBlock).to.equal(
          expectedData.txProof.txIndexInBlock
        )
        expect(proof.txProof.bitcoinHeaders).to.equal(
          expectedData.txProof.bitcoinHeaders
        )
      })
    })

    context(
      "when the sweep transaction does not have enough confirmations",
      () => {
        let notEnoughConfirmationsSweepProofTestData: SweepProofTestData

        beforeEach(async () => {
          notEnoughConfirmationsSweepProofTestData =
            singleInputSweepProofTestData
          notEnoughConfirmationsSweepProofTestData.clientData.transaction.confirmations = 5
        })

        it("should revert", async () => {
          await expect(
            runSweepProofScenario(notEnoughConfirmationsSweepProofTestData)
          ).to.be.rejectedWith(
            "Transaction confirmations number[5] is not enough, required [6]"
          )
        })
      }
    )

    async function runSweepProofScenario(
      data: SweepProofTestData
    ): Promise<SweepData> {
      const transactions = new Map<string, Transaction>()
      transactions.set(data.txId, data.clientData.transaction)
      bitcoinClient.transactions = transactions
      bitcoinClient.latestHeight = data.clientData.latestBlockHeight
      bitcoinClient.headersChain = data.clientData.headersChain
      bitcoinClient.transactionMerkle = data.clientData.transactionMerkleBranch

      const sweepData = await TBTC.constructSweepProof(
        data.txId,
        data.requiredConfirmations,
        bitcoinClient
      )

      return sweepData
    }
  })
})
