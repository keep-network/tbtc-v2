import { MockBitcoinClient } from "./utils/mock-bitcoin-client"
import { Transaction } from "./bitcoin"
import {
  singleInputProofTestData,
  multipleInputsProofTestData,
  ProofTestData,
} from "./data/proof"
import { createTransactionProof } from "../src/proof"
import { Proof } from "./bitcoin"
import { expect } from "chai"
// @ts-ignore
import bcoin from "bcoin"

describe("Proof", () => {
  describe("createTransactionProof", () => {
    let bitcoinClient: MockBitcoinClient

    beforeEach(async () => {
      bcoin.set("testnet")
      bitcoinClient = new MockBitcoinClient()
    })

    context("when the transaction has one input", () => {
      let proof: Transaction & Proof

      beforeEach(async () => {
        proof = await runProofScenario(singleInputProofTestData)
      })

      it("should return the correct value of the proof", async () => {
        const expectedProof = singleInputProofTestData.expectedProof
        expect(proof.transactionHash).to.equal(expectedProof.transactionHash)
        expect(proof.inputs).to.deep.equal(expectedProof.inputs)
        expect(proof.outputs).to.deep.equal(expectedProof.outputs)
        expect(proof.merkleProof).to.equal(expectedProof.merkleProof)
        expect(proof.txIndexInBlock).to.equal(expectedProof.txIndexInBlock)
        expect(proof.bitcoinHeaders).to.equal(expectedProof.bitcoinHeaders)
      })
    })

    context("when the transaction has multiple inputs", () => {
      let proof: Transaction & Proof

      beforeEach(async () => {
        proof = await runProofScenario(multipleInputsProofTestData)
      })

      it("should return the correct value of the proof", async () => {
        const expectedProof = multipleInputsProofTestData.expectedProof
        expect(proof.transactionHash).to.equal(expectedProof.transactionHash)
        expect(proof.inputs).to.deep.equal(expectedProof.inputs)
        expect(proof.outputs).to.deep.equal(expectedProof.outputs)
        expect(proof.merkleProof).to.equal(expectedProof.merkleProof)
        expect(proof.txIndexInBlock).to.equal(expectedProof.txIndexInBlock)
        expect(proof.bitcoinHeaders).to.equal(expectedProof.bitcoinHeaders)
      })
    })

    context("when the transaction does not have enough confirmations", () => {
      let notEnoughConfirmationsSweepProofTestData: ProofTestData

      beforeEach(async () => {
        notEnoughConfirmationsSweepProofTestData = singleInputProofTestData
        notEnoughConfirmationsSweepProofTestData.bitcoinChainData.accumulatedTxConfirmations = 5
      })

      it("should revert", async () => {
        await expect(
          runProofScenario(notEnoughConfirmationsSweepProofTestData)
        ).to.be.rejectedWith(
          "Transaction confirmations number[5] is not enough, required [6]"
        )
      })
    })

    async function runProofScenario(
      data: ProofTestData
    ): Promise<Transaction & Proof> {
      const transactions = new Map<string, Transaction>()
      const transactionHash = data.bitcoinChainData.transaction.transactionHash
      transactions.set(transactionHash, data.bitcoinChainData.transaction)
      bitcoinClient.transactions = transactions
      bitcoinClient.latestHeight = data.bitcoinChainData.latestBlockHeight
      bitcoinClient.headersChain = data.bitcoinChainData.headersChain
      bitcoinClient.transactionMerkle =
        data.bitcoinChainData.transactionMerkleBranch
      const confirmations = new Map<string, number>()
      confirmations.set(
        transactionHash,
        data.bitcoinChainData.accumulatedTxConfirmations
      )
      bitcoinClient.confirmations = confirmations

      const proof = await createTransactionProof(
        transactionHash,
        data.requiredConfirmations,
        bitcoinClient
      )

      return proof
    }
  })
})
