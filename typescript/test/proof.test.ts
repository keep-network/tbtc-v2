import { MockBitcoinClient } from "./utils/mock-bitcoin-client"
import {
  BitcoinHeaderSerializer,
  BitcoinTx,
  BitcoinHeader,
  BitcoinSpvProof,
  assembleBitcoinSpvProof,
  validateBitcoinSpvProof,
} from "../src/lib/bitcoin"
import { Hex } from "../src/lib/utils"
import {
  singleInputProofTestData,
  multipleInputsProofTestData,
  transactionConfirmationsInOneEpochData,
  transactionConfirmationsInTwoEpochsData,
  testnetTransactionData,
  ProofTestData,
  TransactionProofData,
} from "./data/proof"
import { expect } from "chai"
import * as chai from "chai"
import chaiAsPromised from "chai-as-promised"
chai.use(chaiAsPromised)

describe("Proof", () => {
  describe("assembleTransactionProof", () => {
    let bitcoinClient: MockBitcoinClient

    beforeEach(async () => {
      bitcoinClient = new MockBitcoinClient()
    })

    context("when the transaction has one input", () => {
      let proof: BitcoinTx & BitcoinSpvProof

      beforeEach(async () => {
        proof = await runProofScenario(singleInputProofTestData)
      })

      it("should return the correct value of the proof", async () => {
        const expectedProof = singleInputProofTestData.expectedProof
        expect(proof.transactionHash).to.be.deep.equal(
          expectedProof.transactionHash
        )
        expect(proof.inputs).to.deep.equal(expectedProof.inputs)
        expect(proof.outputs).to.deep.equal(expectedProof.outputs)
        expect(proof.merkleProof).to.equal(expectedProof.merkleProof)
        expect(proof.txIndexInBlock).to.equal(expectedProof.txIndexInBlock)
        expect(proof.bitcoinHeaders).to.equal(expectedProof.bitcoinHeaders)
      })
    })

    context("when the transaction has multiple inputs", () => {
      let proof: BitcoinTx & BitcoinSpvProof

      beforeEach(async () => {
        proof = await runProofScenario(multipleInputsProofTestData)
      })

      it("should return the correct value of the proof", async () => {
        const expectedProof = multipleInputsProofTestData.expectedProof
        expect(proof.transactionHash).to.deep.equal(
          expectedProof.transactionHash
        )
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
    ): Promise<BitcoinTx & BitcoinSpvProof> {
      const transactions = new Map<string, BitcoinTx>()
      const transactionHash = data.bitcoinChainData.transaction.transactionHash
      transactions.set(
        transactionHash.toString(),
        data.bitcoinChainData.transaction
      )
      bitcoinClient.transactions = transactions
      bitcoinClient.latestHeight = data.bitcoinChainData.latestBlockHeight
      bitcoinClient.headersChain = data.bitcoinChainData.headersChain
      bitcoinClient.transactionMerkle =
        data.bitcoinChainData.transactionMerkleBranch
      const confirmations = new Map<string, number>()
      confirmations.set(
        transactionHash.toString(),
        data.bitcoinChainData.accumulatedTxConfirmations
      )
      bitcoinClient.confirmations = confirmations

      const proof = await assembleBitcoinSpvProof(
        transactionHash,
        data.requiredConfirmations,
        bitcoinClient
      )

      return proof
    }
  })

  describe("validateTransactionProof", () => {
    let bitcoinClient: MockBitcoinClient

    beforeEach(async () => {
      bitcoinClient = new MockBitcoinClient()
    })

    context("when the transaction proof is correct", () => {
      context("when the transaction is from Bitcoin Mainnet", () => {
        context(
          "when the transaction confirmations span only one epoch",
          () => {
            it("should not throw", async () => {
              await expect(
                runProofValidationScenario(
                  transactionConfirmationsInOneEpochData
                )
              ).not.to.be.rejected
            })
          }
        )

        context("when the transaction confirmations span two epochs", () => {
          it("should not throw", async () => {
            await expect(
              runProofValidationScenario(
                transactionConfirmationsInTwoEpochsData
              )
            ).not.to.be.rejected
          })
        })
      })

      context("when the transaction is from Bitcoin Testnet", () => {
        it("should not throw", async () => {
          await expect(runProofValidationScenario(testnetTransactionData)).not
            .to.be.rejected
        })
      })
    })

    context("when the transaction proof is incorrect", () => {
      context("when the length of headers chain is incorrect", () => {
        it("should throw", async () => {
          // Corrupt data by adding additional byte to the headers chain.
          const corruptedProofData: TransactionProofData = {
            ...transactionConfirmationsInOneEpochData,
            bitcoinChainData: {
              ...transactionConfirmationsInOneEpochData.bitcoinChainData,
              headersChain:
                transactionConfirmationsInOneEpochData.bitcoinChainData
                  .headersChain + "ff",
            },
          }
          await expect(
            runProofValidationScenario(corruptedProofData)
          ).to.be.rejectedWith("Incorrect length of Bitcoin headers")
        })
      })

      context(
        "when the headers chain contains an incorrect number of headers",
        () => {
          // Corrupt the data by adding additional 80 bytes to the headers chain.
          it("should throw", async () => {
            const corruptedProofData: TransactionProofData = {
              ...transactionConfirmationsInOneEpochData,
              bitcoinChainData: {
                ...transactionConfirmationsInOneEpochData.bitcoinChainData,
                headersChain:
                  transactionConfirmationsInOneEpochData.bitcoinChainData
                    .headersChain + "f".repeat(160),
              },
            }
            await expect(
              runProofValidationScenario(corruptedProofData)
            ).to.be.rejectedWith("Wrong number of confirmations")
          })
        }
      )

      context("when the merkle proof is of incorrect length", () => {
        it("should throw", async () => {
          // Corrupt the data by adding a byte to the Merkle proof.
          const merkle = [
            ...transactionConfirmationsInOneEpochData.bitcoinChainData
              .transactionMerkleBranch.merkle,
          ]
          merkle[merkle.length - 1] += "ff"

          const corruptedProofData: TransactionProofData = {
            ...transactionConfirmationsInOneEpochData,
            bitcoinChainData: {
              ...transactionConfirmationsInOneEpochData.bitcoinChainData,
              transactionMerkleBranch: {
                ...transactionConfirmationsInOneEpochData.bitcoinChainData
                  .transactionMerkleBranch,
                merkle: merkle,
              },
            },
          }

          await expect(
            runProofValidationScenario(corruptedProofData)
          ).to.be.rejectedWith("Incorrect length of Merkle proof")
        })
      })

      context("when the merkle proof is empty", () => {
        it("should throw", async () => {
          // Corrupt the data by making the Merkle proof empty.
          const corruptedProofData: TransactionProofData = {
            ...transactionConfirmationsInOneEpochData,
            bitcoinChainData: {
              ...transactionConfirmationsInOneEpochData.bitcoinChainData,
              transactionMerkleBranch: {
                ...transactionConfirmationsInOneEpochData.bitcoinChainData
                  .transactionMerkleBranch,
                merkle: [],
              },
            },
          }

          await expect(
            runProofValidationScenario(corruptedProofData)
          ).to.be.rejectedWith("Invalid merkle tree")
        })
      })

      context("when the merkle proof contains incorrect hash", () => {
        it("should throw", async () => {
          // Corrupt the data by changing a byte of one of the hashes in the
          // Merkle proof.
          const merkle = [
            ...transactionConfirmationsInOneEpochData.bitcoinChainData
              .transactionMerkleBranch.merkle,
          ]

          merkle[3] = "ff" + merkle[3].slice(2)

          const corruptedProofData: TransactionProofData = {
            ...transactionConfirmationsInOneEpochData,
            bitcoinChainData: {
              ...transactionConfirmationsInOneEpochData.bitcoinChainData,
              transactionMerkleBranch: {
                ...transactionConfirmationsInOneEpochData.bitcoinChainData
                  .transactionMerkleBranch,
                merkle: merkle,
              },
            },
          }

          await expect(
            runProofValidationScenario(corruptedProofData)
          ).to.be.rejectedWith(
            "Transaction Merkle proof is not valid for provided header and transaction hash"
          )
        })
      })

      context("when the block headers do not form a chain", () => {
        it("should throw", async () => {
          // Corrupt data by modifying previous block header hash of one of the
          // headers.
          const headers: BitcoinHeader[] =
            BitcoinHeaderSerializer.deserializeHeadersChain(
              transactionConfirmationsInOneEpochData.bitcoinChainData
                .headersChain
            )
          headers[headers.length - 1].previousBlockHeaderHash = Hex.from(
            "ff".repeat(32)
          )
          const corruptedHeadersChain: string = headers
            .map(BitcoinHeaderSerializer.serializeHeader)
            .join("")

          const corruptedProofData: TransactionProofData = {
            ...transactionConfirmationsInOneEpochData,
            bitcoinChainData: {
              ...transactionConfirmationsInOneEpochData.bitcoinChainData,
              headersChain: corruptedHeadersChain,
            },
          }

          await expect(
            runProofValidationScenario(corruptedProofData)
          ).to.be.rejectedWith("Invalid headers chain")
        })
      })

      context("when one of the block headers has insufficient work", () => {
        it("should throw", async () => {
          // Corrupt data by modifying the nonce of one of the headers, so that
          // the resulting hash will be above the required difficulty target.
          const headers: BitcoinHeader[] =
            BitcoinHeaderSerializer.deserializeHeadersChain(
              transactionConfirmationsInOneEpochData.bitcoinChainData
                .headersChain
            )
          headers[headers.length - 1].nonce++
          const corruptedHeadersChain: string = headers
            .map(BitcoinHeaderSerializer.serializeHeader)
            .join("")

          const corruptedProofData: TransactionProofData = {
            ...transactionConfirmationsInOneEpochData,
            bitcoinChainData: {
              ...transactionConfirmationsInOneEpochData.bitcoinChainData,
              headersChain: corruptedHeadersChain,
            },
          }

          await expect(
            runProofValidationScenario(corruptedProofData)
          ).to.be.rejectedWith("Insufficient work in the header")
        })
      })

      context(
        "when some of the block headers are not at current or previous difficulty",
        () => {
          it("should throw", async () => {
            // Corrupt data by setting current difficulty to a different value
            // than stored in block headers.
            const corruptedProofData: TransactionProofData = {
              ...transactionConfirmationsInTwoEpochsData,
              bitcoinChainData: {
                ...transactionConfirmationsInTwoEpochsData.bitcoinChainData,
                currentDifficulty:
                  transactionConfirmationsInTwoEpochsData.bitcoinChainData.currentDifficulty.add(
                    1
                  ),
              },
            }

            await expect(
              runProofValidationScenario(corruptedProofData)
            ).to.be.rejectedWith(
              "Header difficulty not at current or previous Bitcoin difficulty"
            )
          })
        }
      )
    })

    async function runProofValidationScenario(data: TransactionProofData) {
      const transactions = new Map<string, BitcoinTx>()
      const transactionHash = data.bitcoinChainData.transaction.transactionHash
      transactions.set(
        transactionHash.toString(),
        data.bitcoinChainData.transaction
      )
      bitcoinClient.transactions = transactions
      bitcoinClient.latestHeight = data.bitcoinChainData.latestBlockHeight
      bitcoinClient.headersChain = data.bitcoinChainData.headersChain
      bitcoinClient.transactionMerkle =
        data.bitcoinChainData.transactionMerkleBranch
      const confirmations = new Map<string, number>()
      confirmations.set(
        transactionHash.toString(),
        data.bitcoinChainData.accumulatedTxConfirmations
      )
      bitcoinClient.confirmations = confirmations

      await validateBitcoinSpvProof(
        data.bitcoinChainData.transaction.transactionHash,
        data.requiredConfirmations,
        data.bitcoinChainData.previousDifficulty,
        data.bitcoinChainData.currentDifficulty,
        bitcoinClient
      )
    }
  })
})
