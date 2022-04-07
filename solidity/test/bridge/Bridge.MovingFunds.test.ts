/* eslint-disable no-underscore-dangle */
import { ethers, helpers, waffle } from "hardhat"
import chai, { expect } from "chai"
import { smock } from "@defi-wonderland/smock"
import type { FakeContract } from "@defi-wonderland/smock"
import { SignerWithAddress } from "@nomiclabs/hardhat-ethers/signers"
import { ContractTransaction } from "ethers"
import type {
  Bank,
  BankStub,
  Bridge,
  BridgeStub,
  BridgeStub__factory,
  IRelay,
  IWalletRegistry,
} from "../../typechain"
import bridgeFixture from "./bridge-fixture"
import { walletState } from "../fixtures"
import {
  MovingFundsTestData,
  MultipleTargetWalletsAndDivisibleAmount,
  MultipleTargetWalletsAndIndivisibleAmount,
  SingleTargetWallet,
} from "../data/moving-funds"

chai.use(smock.matchers)

const { createSnapshot, restoreSnapshot } = helpers.snapshot
const { lastBlockTime } = helpers.time

const fixture = async () => bridgeFixture()

describe("Bridge - Moving funds", () => {
  let treasury: SignerWithAddress

  let bank: Bank & BankStub
  let relay: FakeContract<IRelay>
  let walletRegistry: FakeContract<IWalletRegistry>
  let Bridge: BridgeStub__factory
  let bridge: Bridge & BridgeStub

  before(async () => {
    // eslint-disable-next-line @typescript-eslint/no-extra-semi
    ;({ treasury, bank, relay, walletRegistry, Bridge, bridge } =
      await waffle.loadFixture(fixture))
  })

  describe("submitMovingFundsProof", () => {
    context("when transaction proof is valid", () => {
      context("when there is a main UTXO for the given wallet", () => {
        context("when main UTXO data are valid", () => {
          context("when there is only one input", () => {
            context(
              "when the single input points to the wallet's main UTXO",
              () => {
                context(
                  "when the output vector references only 20-byte hashes",
                  () => {
                    context(
                      "when the output vector has only P2PKH and P2WPKH outputs",
                      () => {
                        context(
                          "when transaction amount is distributed evenly",
                          () => {
                            context(
                              "when transaction fee is not too high",
                              () => {
                                context(
                                  "when source wallet is in the MovingFunds state",
                                  () => {
                                    context(
                                      "when target wallets commitment is submitted",
                                      () => {
                                        context(
                                          "when actual target wallets correspond to the commitment",
                                          () => {
                                            const testData: {
                                              testName: string
                                              data: MovingFundsTestData
                                            }[] = [
                                              {
                                                testName:
                                                  "when there is a single target wallet",
                                                data: SingleTargetWallet,
                                              },
                                              {
                                                testName:
                                                  "when there are multiple target wallets and the amount is indivisible",
                                                data: MultipleTargetWalletsAndIndivisibleAmount,
                                              },
                                              {
                                                testName:
                                                  "when there are multiple target wallets and the amount is divisible",
                                                data: MultipleTargetWalletsAndDivisibleAmount,
                                              },
                                            ]

                                            testData.forEach((test) => {
                                              context(test.testName, () => {
                                                let tx: ContractTransaction

                                                before(async () => {
                                                  await createSnapshot()

                                                  tx =
                                                    await runMovingFundsScenario(
                                                      test.data
                                                    )
                                                })

                                                after(async () => {
                                                  walletRegistry.closeWallet.reset()

                                                  await restoreSnapshot()
                                                })

                                                it("should mark the main UTXO as correctly spent", async () => {
                                                  const key =
                                                    ethers.utils.solidityKeccak256(
                                                      ["bytes32", "uint32"],
                                                      [
                                                        test.data.mainUtxo
                                                          .txHash,
                                                        test.data.mainUtxo
                                                          .txOutputIndex,
                                                      ]
                                                    )

                                                  // eslint-disable-next-line @typescript-eslint/no-unused-expressions
                                                  expect(
                                                    await bridge.spentMainUTXOs(
                                                      key
                                                    )
                                                  ).to.be.true
                                                })

                                                it("should unset the main UTXO for the source wallet", async () => {
                                                  expect(
                                                    (
                                                      await bridge.getWallet(
                                                        test.data.wallet
                                                          .pubKeyHash
                                                      )
                                                    ).mainUtxoHash
                                                  ).to.be.equal(
                                                    ethers.constants.HashZero
                                                  )
                                                })

                                                it("should put the source wallet in the Closed state", async () => {
                                                  expect(
                                                    (
                                                      await bridge.getWallet(
                                                        test.data.wallet
                                                          .pubKeyHash
                                                      )
                                                    ).state
                                                  ).to.be.equal(
                                                    walletState.Closed
                                                  )
                                                })

                                                it("should emit the WalletClosed event", async () => {
                                                  await expect(tx)
                                                    .to.emit(
                                                      bridge,
                                                      "WalletClosed"
                                                    )
                                                    .withArgs(
                                                      test.data.wallet
                                                        .ecdsaWalletID,
                                                      test.data.wallet
                                                        .pubKeyHash
                                                    )
                                                })

                                                it("should emit the MovingFundsCompleted event", async () => {
                                                  await expect(tx)
                                                    .to.emit(
                                                      bridge,
                                                      "MovingFundsCompleted"
                                                    )
                                                    .withArgs(
                                                      test.data.wallet
                                                        .pubKeyHash,
                                                      test.data.movingFundsTx
                                                        .hash
                                                    )
                                                })

                                                it("should call ECDSA Wallet Registry's closeWallet function", async () => {
                                                  // eslint-disable-next-line @typescript-eslint/no-unused-expressions
                                                  expect(
                                                    walletRegistry.closeWallet
                                                  ).to.have.been.calledOnceWith(
                                                    test.data.wallet
                                                      .ecdsaWalletID
                                                  )
                                                })
                                              })
                                            })
                                          }
                                        )

                                        context(
                                          "when actual target wallets does not correspond to the commitment",
                                          () => {
                                            it("should revert", async () => {
                                              // TODO: Implementation.
                                            })
                                          }
                                        )
                                      }
                                    )

                                    context(
                                      "when target wallets commitment is not submitted",
                                      () => {
                                        it("should revert", async () => {
                                          // TODO: Implementation.
                                        })
                                      }
                                    )
                                  }
                                )

                                context(
                                  "when source wallet is not in the MovingFunds state",
                                  () => {
                                    it("should revert", async () => {
                                      // TODO: Implementation.
                                    })
                                  }
                                )
                              }
                            )

                            context("when transaction fee is too high", () => {
                              it("should revert", async () => {
                                // TODO: Implementation.
                              })
                            })
                          }
                        )

                        context(
                          "when transaction amount is not distributed evenly",
                          () => {
                            it("should revert", async () => {
                              // TODO: Implementation.
                            })
                          }
                        )
                      }
                    )

                    context(
                      "when the output vector has not only P2PKH and P2WPKH outputs",
                      () => {
                        it("should revert", async () => {
                          // TODO: Implementation.
                        })
                      }
                    )
                  }
                )

                context(
                  "when the output vector doesn't only reference 20-byte hashes",
                  () => {
                    it("should revert", async () => {
                      // TODO: Implementation.
                    })
                  }
                )
              }
            )

            context(
              "when the single input doesn't point to the wallet's main UTXO",
              () => {
                it("should revert", async () => {
                  // TODO: Implementation.
                })
              }
            )
          })

          context("when input count is other than one", () => {
            it("should revert", async () => {
              // TODO: Implementation.
            })
          })
        })

        context("when main UTXO data are invalid", () => {
          it("should revert", async () => {
            // TODO: Implementation.
          })
        })
      })

      context("when there is no main UTXO for the given wallet", () => {
        it("should revert", async () => {
          // TODO: Implementation.
        })
      })
    })

    context("when transaction proof is not valid", () => {
      context("when input vector is not valid", () => {
        const data: MovingFundsTestData = JSON.parse(
          JSON.stringify(SingleTargetWallet)
        )

        before(async () => {
          await createSnapshot()
        })

        after(async () => {
          await restoreSnapshot()
        })

        it("should revert", async () => {
          // Corrupt the input vector by setting a compactSize uint claiming
          // there is no inputs at all.
          data.movingFundsTx.inputVector =
            "0x00b69a2869840aa6fdfd143136ff4514ca46ea2d876855040892ad74ab" +
            "8c5274220100000000ffffffff"

          await expect(runMovingFundsScenario(data)).to.be.revertedWith(
            "Invalid input vector provided"
          )
        })
      })

      context("when output vector is not valid", () => {
        const data: MovingFundsTestData = JSON.parse(
          JSON.stringify(SingleTargetWallet)
        )

        before(async () => {
          await createSnapshot()
        })

        after(async () => {
          await restoreSnapshot()
        })

        it("should revert", async () => {
          // Corrupt the output vector by setting a compactSize uint claiming
          // there is no outputs at all.
          data.movingFundsTx.outputVector =
            "0x005cf511000000000017a91486884e6be1525dab5ae0b451bd2c72cee6" +
            "7dcf4187"

          await expect(runMovingFundsScenario(data)).to.be.revertedWith(
            "Invalid output vector provided"
          )
        })
      })

      context("when merkle proof is not valid", () => {
        const data: MovingFundsTestData = JSON.parse(
          JSON.stringify(SingleTargetWallet)
        )

        before(async () => {
          await createSnapshot()
        })

        after(async () => {
          await restoreSnapshot()
        })

        it("should revert", async () => {
          // Corrupt the merkle proof by changing tx index in block to an
          // invalid one. The proper one is 33 so any other will do the trick.
          data.movingFundsProof.txIndexInBlock = 30

          await expect(runMovingFundsScenario(data)).to.be.revertedWith(
            "Tx merkle proof is not valid for provided header and tx hash"
          )
        })
      })

      context("when proof difficulty is not current nor previous", () => {
        const data: MovingFundsTestData = JSON.parse(
          JSON.stringify(SingleTargetWallet)
        )

        before(async () => {
          await createSnapshot()
        })

        after(async () => {
          await restoreSnapshot()
        })

        it("should revert", async () => {
          // To pass the proof validation, the difficulty returned by the relay
          // must be 1 for test data used in this scenario. Setting
          // a different value will cause difficulty comparison failure.
          data.chainDifficulty = 2

          await expect(runMovingFundsScenario(data)).to.be.revertedWith(
            "Not at current or previous difficulty"
          )
        })
      })

      context("when headers chain length is not valid", () => {
        const data: MovingFundsTestData = JSON.parse(
          JSON.stringify(SingleTargetWallet)
        )

        before(async () => {
          await createSnapshot()
        })

        after(async () => {
          await restoreSnapshot()
        })

        it("should revert", async () => {
          // Corrupt the bitcoin headers length in the moving funds proof. The
          // proper value is length divisible by 80 so any length violating
          // this rule will cause failure. In this case, we just remove the
          // last byte from proper headers chain.
          const properHeaders = data.movingFundsProof.bitcoinHeaders.toString()
          data.movingFundsProof.bitcoinHeaders = properHeaders.substring(
            0,
            properHeaders.length - 2
          )

          await expect(runMovingFundsScenario(data)).to.be.revertedWith(
            "Invalid length of the headers chain"
          )
        })
      })

      context("when headers chain is not valid", () => {
        const data: MovingFundsTestData = JSON.parse(
          JSON.stringify(SingleTargetWallet)
        )

        before(async () => {
          await createSnapshot()
        })

        after(async () => {
          await restoreSnapshot()
        })

        it("should revert", async () => {
          // Bitcoin headers must form a chain to pass the proof validation.
          // That means the `previous block hash` encoded in the given block
          // header must match the actual previous header's hash. To test
          // that scenario, we corrupt the `previous block hash` of the
          // second header. Each header is 80 bytes length. First 4 bytes
          // of each header is `version` and 32 subsequent bytes is
          // `previous block hash`. Changing byte 85 of the whole chain will
          // do the work.
          const properHeaders = data.movingFundsProof.bitcoinHeaders.toString()
          data.movingFundsProof.bitcoinHeaders = `${properHeaders.substring(
            0,
            170
          )}ff${properHeaders.substring(172)}`

          await expect(runMovingFundsScenario(data)).to.be.revertedWith(
            "Invalid headers chain"
          )
        })
      })

      context("when the work in the header is insufficient", () => {
        const data: MovingFundsTestData = JSON.parse(
          JSON.stringify(SingleTargetWallet)
        )

        before(async () => {
          await createSnapshot()
        })

        after(async () => {
          await restoreSnapshot()
        })

        it("should revert", async () => {
          // Each header encodes a `difficulty target` field in bytes 72-76.
          // The given header's hash (interpreted as uint) must be bigger than
          // the `difficulty target`. To test this scenario, we change the
          // last byte of the last header in such a way their hash becomes
          // lower than their `difficulty target`.
          const properHeaders = data.movingFundsProof.bitcoinHeaders.toString()
          data.movingFundsProof.bitcoinHeaders = `${properHeaders.substring(
            0,
            properHeaders.length - 2
          )}ff`

          await expect(runMovingFundsScenario(data)).to.be.revertedWith(
            "Insufficient work in a header"
          )
        })
      })

      context(
        "when accumulated difficulty in headers chain is insufficient",
        () => {
          let otherBridge: Bridge
          const data: MovingFundsTestData = JSON.parse(
            JSON.stringify(SingleTargetWallet)
          )

          before(async () => {
            await createSnapshot()

            // Necessary to pass the first part of proof validation.
            relay.getCurrentEpochDifficulty.returns(data.chainDifficulty)
            relay.getPrevEpochDifficulty.returns(data.chainDifficulty)

            // Deploy another bridge which has higher `txProofDifficultyFactor`
            // than the original bridge. That means it will need 12 confirmations
            // to deem transaction proof validity. This scenario uses test
            // data which has only 6 confirmations. That should force the
            // failure we expect within this scenario.
            otherBridge = await Bridge.deploy(
              bank.address,
              relay.address,
              treasury.address,
              walletRegistry.address,
              12
            )
            await otherBridge.deployed()
          })

          after(async () => {
            relay.getCurrentEpochDifficulty.reset()
            relay.getPrevEpochDifficulty.reset()

            await restoreSnapshot()
          })

          it("should revert", async () => {
            await expect(
              otherBridge.submitMovingFundsProof(
                data.movingFundsTx,
                data.movingFundsProof,
                data.mainUtxo,
                data.wallet.pubKeyHash
              )
            ).to.be.revertedWith(
              "Insufficient accumulated difficulty in header chain"
            )
          })
        }
      )
    })
  })

  async function runMovingFundsScenario(
    data: MovingFundsTestData
  ): Promise<ContractTransaction> {
    relay.getCurrentEpochDifficulty.returns(data.chainDifficulty)
    relay.getPrevEpochDifficulty.returns(data.chainDifficulty)

    // Simulate the wallet is a registered one.
    await bridge.setWallet(data.wallet.pubKeyHash, {
      ecdsaWalletID: data.wallet.ecdsaWalletID,
      mainUtxoHash: ethers.constants.HashZero,
      pendingRedemptionsValue: 0,
      createdAt: await lastBlockTime(),
      movingFundsRequestedAt: await lastBlockTime(),
      state: data.wallet.state,
      movingFundsTargetWalletsCommitmentHash:
        data.targetWalletsCommitment.length > 0
          ? ethers.utils.solidityKeccak256(
              ["bytes20[]"],
              [data.targetWalletsCommitment]
            )
          : ethers.constants.HashZero,
    })
    // Simulate the prepared main UTXO belongs to the wallet.
    await bridge.setWalletMainUtxo(data.wallet.pubKeyHash, data.mainUtxo)

    const tx = await bridge.submitMovingFundsProof(
      data.movingFundsTx,
      data.movingFundsProof,
      data.mainUtxo,
      data.wallet.pubKeyHash
    )

    relay.getCurrentEpochDifficulty.reset()
    relay.getPrevEpochDifficulty.reset()

    return tx
  }
})
