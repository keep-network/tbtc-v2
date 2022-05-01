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
import bridgeFixture from "../fixtures/bridge"
import { constants, walletState } from "../fixtures"
import {
  MovingFundsTestData,
  MultipleInputs,
  MultipleTargetWalletsAndDivisibleAmount,
  MultipleTargetWalletsAndIndivisibleAmount,
  MultipleTargetWalletsButAmountDistributedUnevenly,
  SingleProvablyUnspendable,
  SingleTargetWallet,
  SingleTargetWalletButP2SH,
} from "../data/moving-funds"
import { ecdsaWalletTestData } from "../data/ecdsa"
import { NO_MAIN_UTXO } from "../data/sweep"
import { to1ePrecision } from "../helpers/contract-test-helpers"

chai.use(smock.matchers)

const { createSnapshot, restoreSnapshot } = helpers.snapshot
const { lastBlockTime, increaseTime } = helpers.time

describe("Bridge - Moving funds", () => {
  let thirdParty: SignerWithAddress
  let treasury: SignerWithAddress

  let bank: Bank & BankStub
  let relay: FakeContract<IRelay>
  let walletRegistry: FakeContract<IWalletRegistry>
  let bridge: Bridge & BridgeStub
  let BridgeFactory: BridgeStub__factory

  before(async () => {
    // eslint-disable-next-line @typescript-eslint/no-extra-semi
    ;({
      thirdParty,
      treasury,
      bank,
      relay,
      walletRegistry,
      bridge,
      BridgeFactory,
    } = await waffle.loadFixture(bridgeFixture))
  })

  describe("submitMovingFundsCommitment", () => {
    const walletDraft = {
      ecdsaWalletID: ecdsaWalletTestData.walletID,
      mainUtxoHash: ethers.constants.HashZero,
      pendingRedemptionsValue: 0,
      createdAt: 0,
      movingFundsRequestedAt: 0,
      closingStartedAt: 0,
      state: walletState.Unknown,
      movingFundsTargetWalletsCommitmentHash: ethers.constants.HashZero,
    }

    context("when source wallet is in the MovingFunds state", () => {
      before(async () => {
        await createSnapshot()

        await bridge.setWallet(ecdsaWalletTestData.pubKeyHash160, {
          ...walletDraft,
          state: walletState.MovingFunds,
        })
      })

      after(async () => {
        await restoreSnapshot()
      })

      context("when source wallet has no pending redemptions", () => {
        // The wallet created using the `walletDraft` has no pending redemptions
        // by default. No need to do anything here.

        context("when the commitment was not submitted yet", () => {
          // The wallet created using the `walletDraft` has no commitment
          // submitted by default. No need to do anything here.

          context("when the caller is a member of the source wallet", () => {
            const walletMembersIDs = [1, 2, 3, 4, 5]
            const walletMemberIndex = 2

            let caller: SignerWithAddress

            before(async () => {
              await createSnapshot()

              caller = thirdParty

              walletRegistry.isWalletMember
                .whenCalledWith(
                  ecdsaWalletTestData.walletID,
                  walletMembersIDs,
                  caller.address,
                  walletMemberIndex
                )
                .returns(true)
            })

            after(async () => {
              walletRegistry.isWalletMember.reset()

              await restoreSnapshot()
            })

            context("when passed wallet main UTXO is valid", () => {
              context("when wallet balance is greater than zero", () => {
                // Just an arbitrary main UTXO with value of 26 BTC.
                const mainUtxo = {
                  txHash:
                    "0xc9e58780c6c289c25ae1fe293f85a4db4d0af4f305172f2a1868ddd917458bdf",
                  txOutputIndex: 0,
                  txOutputValue: to1ePrecision(26, 8),
                }

                before(async () => {
                  await createSnapshot()

                  // Set up a main UTXO for the source wallet.
                  await bridge.setWalletMainUtxo(
                    ecdsaWalletTestData.pubKeyHash160,
                    mainUtxo
                  )
                })

                after(async () => {
                  await restoreSnapshot()
                })

                context(
                  "when the expected target wallets count is greater than zero",
                  () => {
                    // Just some arbitrary 20-byte hashes to simulate live
                    // wallets PKHs. They are ordered in the expected way, i.e.
                    // the hashes represented as numbers form a strictly
                    // increasing sequence.
                    const liveWallets = [
                      "0x4b440cb29c80c3f256212d8fdd4f2125366f3c91",
                      "0x888f01315e0268bfa05d5e522f8d63f6824d9a96",
                      "0xb2a89e53a4227dbe530a52a1c419040735fa636c",
                      "0xbf198e8fff0f90af01024153701da99b9bc08dc5",
                      "0xffb9e05013f5cd126915bc03d340cc5c1be81862",
                    ]

                    before(async () => {
                      await createSnapshot()

                      for (let i = 0; i < liveWallets.length; i++) {
                        // eslint-disable-next-line no-await-in-loop
                        await bridge.setWallet(liveWallets[i], {
                          ...walletDraft,
                          state: walletState.Live,
                        })
                      }
                    })

                    after(async () => {
                      await restoreSnapshot()
                    })

                    context(
                      "when the submitted target wallets count is same as the expected",
                      () => {
                        // The source wallet has a main UTXO with value of 26 BTC,
                        // the max BTC transfer is 10 BTC by default (see
                        // `constants.walletMaxBtcTransfer`) and the count of
                        // live wallets is `5`. We compute the expected target
                        // wallets count as:
                        // `N = min(liveWalletsCount, ceil(walletBtcBalance / walletMaxBtcTransfer))`
                        // so we have `N = min(5, 26 / 10) = min(5, 3) = 3`
                        const expectedTargetWalletsCount = 3

                        context(
                          "when all target wallets are different than the source wallet",
                          () => {
                            context(
                              "when all target wallets follow the expected order",
                              () => {
                                context(
                                  "when all target wallets are in the Live state",
                                  () => {
                                    let tx: ContractTransaction

                                    const targetWallets = liveWallets.slice(
                                      0,
                                      expectedTargetWalletsCount
                                    )

                                    before(async () => {
                                      await createSnapshot()

                                      tx = await bridge
                                        .connect(caller)
                                        .submitMovingFundsCommitment(
                                          ecdsaWalletTestData.pubKeyHash160,
                                          mainUtxo,
                                          walletMembersIDs,
                                          walletMemberIndex,
                                          targetWallets
                                        )
                                    })

                                    after(async () => {
                                      await restoreSnapshot()
                                    })

                                    it("should store the target wallets commitment for the given wallet", async () => {
                                      expect(
                                        (
                                          await bridge.wallets(
                                            ecdsaWalletTestData.pubKeyHash160
                                          )
                                        ).movingFundsTargetWalletsCommitmentHash
                                      ).to.be.equal(
                                        ethers.utils.solidityKeccak256(
                                          ["bytes20[]"],
                                          [targetWallets]
                                        )
                                      )
                                    })

                                    it("should emit the MovingFundsCommitmentSubmitted event", async () => {
                                      await expect(tx)
                                        .to.emit(
                                          bridge,
                                          "MovingFundsCommitmentSubmitted"
                                        )
                                        .withArgs(
                                          ecdsaWalletTestData.pubKeyHash160,
                                          targetWallets,
                                          caller.address
                                        )
                                    })
                                  }
                                )

                                context(
                                  "when one of the target wallets is not in the Live state",
                                  () => {
                                    it("should revert", async () => {
                                      // Put an Unknown wallet into the mix.
                                      const targetWallets = [
                                        "0x2313e29d08e6b5e0d3cda040ed7f664ce9c840c4",
                                        liveWallets[0],
                                        liveWallets[1],
                                      ]

                                      await expect(
                                        bridge
                                          .connect(caller)
                                          .submitMovingFundsCommitment(
                                            ecdsaWalletTestData.pubKeyHash160,
                                            mainUtxo,
                                            walletMembersIDs,
                                            walletMemberIndex,
                                            targetWallets
                                          )
                                      ).to.be.revertedWith(
                                        "Submitted target wallet must be in Live state"
                                      )
                                    })
                                  }
                                )
                              }
                            )

                            context(
                              "when one of the target wallets break the expected order",
                              () => {
                                it("should revert", async () => {
                                  const targetWallets = [
                                    liveWallets[0],
                                    liveWallets[1],
                                    liveWallets[1],
                                  ]

                                  await expect(
                                    bridge
                                      .connect(caller)
                                      .submitMovingFundsCommitment(
                                        ecdsaWalletTestData.pubKeyHash160,
                                        mainUtxo,
                                        walletMembersIDs,
                                        walletMemberIndex,
                                        targetWallets
                                      )
                                  ).to.be.revertedWith(
                                    "Submitted target wallet breaks the expected order"
                                  )
                                })
                              }
                            )
                          }
                        )

                        context(
                          "when one of the target wallets is same as the source wallet",
                          () => {
                            it("should revert", async () => {
                              const targetWallets = [
                                liveWallets[0],
                                ecdsaWalletTestData.pubKeyHash160,
                                liveWallets[1],
                              ]

                              await expect(
                                bridge
                                  .connect(caller)
                                  .submitMovingFundsCommitment(
                                    ecdsaWalletTestData.pubKeyHash160,
                                    mainUtxo,
                                    walletMembersIDs,
                                    walletMemberIndex,
                                    targetWallets
                                  )
                              ).to.be.revertedWith(
                                "Submitted target wallet cannot be equal to the source wallet"
                              )
                            })
                          }
                        )
                      }
                    )

                    context(
                      "when the submitted target wallets count is other than the expected",
                      () => {
                        it("should revert", async () => {
                          await expect(
                            bridge
                              .connect(caller)
                              .submitMovingFundsCommitment(
                                ecdsaWalletTestData.pubKeyHash160,
                                mainUtxo,
                                walletMembersIDs,
                                walletMemberIndex,
                                [liveWallets[0], liveWallets[1]]
                              )
                          ).to.be.revertedWith(
                            "Submitted target wallets count is other than expected"
                          )
                        })
                      }
                    )
                  }
                )

                context(
                  "when the expected target wallets count is zero",
                  () => {
                    it("should revert", async () => {
                      await expect(
                        // The last parameter doesn't matter in this scenario.
                        bridge
                          .connect(caller)
                          .submitMovingFundsCommitment(
                            ecdsaWalletTestData.pubKeyHash160,
                            mainUtxo,
                            walletMembersIDs,
                            walletMemberIndex,
                            []
                          )
                      ).to.be.revertedWith("No target wallets available")
                    })
                  }
                )
              })

              context("when wallet balance is zero", () => {
                it("should revert", async () => {
                  await expect(
                    // The last parameter doesn't matter in this scenario.
                    bridge.connect(caller).submitMovingFundsCommitment(
                      ecdsaWalletTestData.pubKeyHash160,
                      NO_MAIN_UTXO, // That makes the balance to be 0 BTC.
                      walletMembersIDs,
                      walletMemberIndex,
                      []
                    )
                  ).to.be.revertedWith("Wallet BTC balance is zero")
                })
              })
            })

            context("when passed wallet main UTXO is invalid", () => {
              const mainUtxo = {
                txHash:
                  "0xc9e58780c6c289c25ae1fe293f85a4db4d0af4f305172f2a1868ddd917458bdf",
                txOutputIndex: 0,
                txOutputValue: to1ePrecision(26, 8), // 26 BTC
              }

              before(async () => {
                await createSnapshot()

                await bridge.setWalletMainUtxo(
                  ecdsaWalletTestData.pubKeyHash160,
                  mainUtxo
                )
              })

              after(async () => {
                await restoreSnapshot()
              })

              it("should revert", async () => {
                // Changing the `txOutputValue` to a value other than `0` will
                // make that scenario happen.
                const corruptedMainUtxo = {
                  ...mainUtxo,
                  txOutputValue: 1,
                }

                await expect(
                  // The last parameter doesn't matter in this scenario.
                  bridge
                    .connect(caller)
                    .submitMovingFundsCommitment(
                      ecdsaWalletTestData.pubKeyHash160,
                      corruptedMainUtxo,
                      walletMembersIDs,
                      walletMemberIndex,
                      []
                    )
                ).to.be.revertedWith("Invalid wallet main UTXO data")
              })
            })
          })

          context(
            "when the caller is not a member of the source wallet",
            () => {
              const walletMembersIDs = [1, 2, 3, 4, 5]
              const walletMemberIndex = 2

              before(async () => {
                await createSnapshot()

                // That's the default behavior, but we just make it explicit.
                walletRegistry.isWalletMember.returns(false)
              })

              after(async () => {
                walletRegistry.isWalletMember.reset()

                await restoreSnapshot()
              })

              it("should revert", async () => {
                await expect(
                  // The last parameter doesn't matter in this scenario.
                  bridge
                    .connect(thirdParty)
                    .submitMovingFundsCommitment(
                      ecdsaWalletTestData.pubKeyHash160,
                      NO_MAIN_UTXO,
                      walletMembersIDs,
                      walletMemberIndex,
                      []
                    )
                ).to.be.revertedWith(
                  "Caller is not a member of the source wallet"
                )
              })
            }
          )
        })

        context("when the commitment was already submitted", () => {
          before(async () => {
            await createSnapshot()

            await bridge.setWallet(ecdsaWalletTestData.pubKeyHash160, {
              ...walletDraft,
              state: walletState.MovingFunds,
              // Set a non-zero commitment to make this scenario work.
              movingFundsTargetWalletsCommitmentHash:
                "0x959e95e0bd83d34878f77ead61cb4e955bf5e3bdc9e16cdfbd51c4c20ab7e6b4",
            })
          })

          after(async () => {
            await restoreSnapshot()
          })

          it("should revert", async () => {
            await expect(
              // Parameters others than the first doesn't matter in this scenario.
              bridge.submitMovingFundsCommitment(
                ecdsaWalletTestData.pubKeyHash160,
                NO_MAIN_UTXO,
                [],
                0,
                []
              )
            ).to.be.revertedWith("Target wallets commitment already submitted")
          })
        })
      })

      context("when source wallet has pending redemptions", () => {
        before(async () => {
          await createSnapshot()

          await bridge.setWallet(ecdsaWalletTestData.pubKeyHash160, {
            ...walletDraft,
            state: walletState.MovingFunds,
            // Set non-zero pending redemptions value to make this scenario work.
            pendingRedemptionsValue: 10000,
          })
        })

        after(async () => {
          await restoreSnapshot()
        })

        it("should revert", async () => {
          await expect(
            // Parameters others than the first doesn't matter in this scenario.
            bridge.submitMovingFundsCommitment(
              ecdsaWalletTestData.pubKeyHash160,
              NO_MAIN_UTXO,
              [],
              0,
              []
            )
          ).to.be.revertedWith(
            "Source wallet must handle all pending redemptions first"
          )
        })
      })
    })

    context("when source wallet is not in the MovingFunds state", () => {
      const testData: {
        testName: string
        state: number
      }[] = [
        {
          testName: "when the source wallet is in the Unknown state",
          state: walletState.Unknown,
        },
        {
          testName: "when the source wallet is in the Live state",
          state: walletState.Live,
        },
        {
          testName: "when the source wallet is in the Closing state",
          state: walletState.Closing,
        },
        {
          testName: "when the source wallet is in the Closed state",
          state: walletState.Closed,
        },
        {
          testName: "when the source wallet is in the Terminated state",
          state: walletState.Terminated,
        },
      ]

      testData.forEach((test) => {
        context(test.testName, () => {
          before(async () => {
            await createSnapshot()

            await bridge.setWallet(ecdsaWalletTestData.pubKeyHash160, {
              ...walletDraft,
              state: test.state,
            })
          })

          after(async () => {
            await restoreSnapshot()
          })

          it("should revert", async () => {
            await expect(
              // Parameters other than the first doesn't matter in this scenario.
              bridge.submitMovingFundsCommitment(
                ecdsaWalletTestData.pubKeyHash160,
                NO_MAIN_UTXO,
                [],
                0,
                []
              )
            ).to.be.revertedWith("Source wallet must be in MovingFunds state")
          })
        })
      })
    })
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
                                                      await bridge.wallets(
                                                        test.data.wallet
                                                          .pubKeyHash
                                                      )
                                                    ).mainUtxoHash
                                                  ).to.be.equal(
                                                    ethers.constants.HashZero
                                                  )
                                                })

                                                it("should put the source wallet in the Closing state", async () => {
                                                  expect(
                                                    (
                                                      await bridge.wallets(
                                                        test.data.wallet
                                                          .pubKeyHash
                                                      )
                                                    ).state
                                                  ).to.be.equal(
                                                    walletState.Closing
                                                  )
                                                })

                                                it("should set the closing started timestamp", async () => {
                                                  expect(
                                                    (
                                                      await bridge.wallets(
                                                        test.data.wallet
                                                          .pubKeyHash
                                                      )
                                                    ).closingStartedAt
                                                  ).to.be.equal(
                                                    await lastBlockTime()
                                                  )
                                                })

                                                it("should emit the WalletClosing event", async () => {
                                                  await expect(tx)
                                                    .to.emit(
                                                      bridge,
                                                      "WalletClosing"
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
                                              })
                                            })
                                          }
                                        )

                                        context(
                                          "when actual target wallets does not correspond to the commitment",
                                          () => {
                                            // The below test data send funds to
                                            // three wallets with the following
                                            // 20-byte PKHs (in this order):
                                            // - 0x2cd680318747b720d67bf4246eb7403b476adb34
                                            // - 0x8900de8fc6e4cd1db4c7ab0759d28503b4cb0ab1
                                            // - 0xaf7a841e055fc19bf31acf4cbed5ef548a2cc453
                                            // If the commitment is not exactly
                                            // this list, the moving funds proof
                                            // will revert.
                                            const data: MovingFundsTestData =
                                              MultipleTargetWalletsAndIndivisibleAmount

                                            const testData: {
                                              testName: string
                                              modifyData: (
                                                data: MovingFundsTestData
                                              ) => MovingFundsTestData
                                            }[] = [
                                              {
                                                testName:
                                                  "when funds were sent to more wallets than submitted in the commitment",
                                                modifyData: (
                                                  dataCopy: MovingFundsTestData
                                                ) =>
                                                  // Simulate that the commitment
                                                  // contains only the two first
                                                  // wallets used in the transaction.
                                                  ({
                                                    ...dataCopy,
                                                    targetWalletsCommitment: [
                                                      dataCopy
                                                        .targetWalletsCommitment[0],
                                                      dataCopy
                                                        .targetWalletsCommitment[1],
                                                    ],
                                                  }),
                                              },
                                              {
                                                testName:
                                                  "when funds were sent to less wallets than submitted in the commitment",
                                                modifyData: (
                                                  dataCopy: MovingFundsTestData
                                                ) =>
                                                  // Simulate that the commitment
                                                  // contains an additional wallet apart
                                                  // from all wallets used in the transaction.
                                                  ({
                                                    ...dataCopy,
                                                    targetWalletsCommitment: [
                                                      dataCopy
                                                        .targetWalletsCommitment[0],
                                                      dataCopy
                                                        .targetWalletsCommitment[1],
                                                      dataCopy
                                                        .targetWalletsCommitment[2],
                                                      "0xe04f5dbeafea147699fce4e0e12027aa0bc12e78",
                                                    ],
                                                  }),
                                              },
                                              {
                                                testName:
                                                  "when funds were sent to completely different wallets than submitted in the commitment",
                                                modifyData: (
                                                  dataCopy: MovingFundsTestData
                                                ) =>
                                                  // Simulate that the commitment
                                                  // contains three different wallets
                                                  // than the wallets used in the
                                                  // transaction.
                                                  ({
                                                    ...dataCopy,
                                                    targetWalletsCommitment: [
                                                      "0x1e445df2d9136831193d90c5e2c6b7ea8a0882fb",
                                                      "0x9d134f065a6566bcc2f99fffe21856e129638526",
                                                      "0x4f524b05f817bd8f3be613ff5bc5ef87f0b68b46",
                                                    ],
                                                  }),
                                              },
                                              {
                                                testName:
                                                  "when funds were sent to the wallets submitted in the commitment but with a wrong order",
                                                modifyData: (
                                                  dataCopy: MovingFundsTestData
                                                ) =>
                                                  // Simulate that the commitment
                                                  // contains three different wallets
                                                  // than the wallets used in the
                                                  // transaction.
                                                  ({
                                                    ...dataCopy,
                                                    targetWalletsCommitment: [
                                                      dataCopy
                                                        .targetWalletsCommitment[2],
                                                      dataCopy
                                                        .targetWalletsCommitment[1],
                                                      dataCopy
                                                        .targetWalletsCommitment[0],
                                                    ],
                                                  }),
                                              },
                                            ]

                                            testData.forEach((test) => {
                                              context(test.testName, () => {
                                                let tx: Promise<ContractTransaction>

                                                before(async () => {
                                                  await createSnapshot()

                                                  // Pass a copy of the original data.
                                                  const modifiedData =
                                                    test.modifyData(
                                                      JSON.parse(
                                                        JSON.stringify(data)
                                                      )
                                                    )

                                                  tx =
                                                    runMovingFundsScenario(
                                                      modifiedData
                                                    )
                                                })

                                                after(async () => {
                                                  await restoreSnapshot()
                                                })

                                                it("should revert", async () => {
                                                  await expect(
                                                    tx
                                                  ).to.be.revertedWith(
                                                    "Target wallets don't correspond to the commitment"
                                                  )
                                                })
                                              })
                                            })
                                          }
                                        )
                                      }
                                    )

                                    context(
                                      "when target wallets commitment is not submitted",
                                      () => {
                                        const data: MovingFundsTestData =
                                          JSON.parse(
                                            JSON.stringify(SingleTargetWallet)
                                          )

                                        let tx: Promise<ContractTransaction>

                                        before(async () => {
                                          await createSnapshot()

                                          tx = runMovingFundsScenario({
                                            ...data,
                                            targetWalletsCommitment: [],
                                          })
                                        })

                                        after(async () => {
                                          await restoreSnapshot()
                                        })

                                        it("should revert", async () => {
                                          await expect(tx).to.be.revertedWith(
                                            "Target wallets commitment not submitted yet"
                                          )
                                        })
                                      }
                                    )
                                  }
                                )

                                context(
                                  "when source wallet is not in the MovingFunds state",
                                  () => {
                                    const testData: {
                                      testName: string
                                      state: number
                                    }[] = [
                                      {
                                        testName:
                                          "when wallet state is Unknown",
                                        state: walletState.Unknown,
                                      },
                                      {
                                        testName: "when wallet state is Live",
                                        state: walletState.Live,
                                      },
                                      {
                                        testName:
                                          "when wallet state is Closing",
                                        state: walletState.Closing,
                                      },
                                      {
                                        testName: "when wallet state is Closed",
                                        state: walletState.Closed,
                                      },
                                      {
                                        testName:
                                          "when wallet state is Terminated",
                                        state: walletState.Terminated,
                                      },
                                    ]

                                    testData.forEach((test) => {
                                      context(test.testName, () => {
                                        const data: MovingFundsTestData =
                                          JSON.parse(
                                            JSON.stringify(SingleTargetWallet)
                                          )

                                        let tx: Promise<ContractTransaction>

                                        before(async () => {
                                          await createSnapshot()

                                          data.wallet.state = test.state

                                          tx = runMovingFundsScenario(data)
                                        })

                                        after(async () => {
                                          await restoreSnapshot()
                                        })

                                        it("should revert", async () => {
                                          await expect(tx).to.be.revertedWith(
                                            "ECDSA wallet must be in MovingFunds state"
                                          )
                                        })
                                      })
                                    })
                                  }
                                )
                              }
                            )

                            context("when transaction fee is too high", () => {
                              const data: MovingFundsTestData =
                                SingleTargetWallet

                              let tx: Promise<ContractTransaction>

                              before(async () => {
                                await createSnapshot()

                                const beforeProofActions = async () => {
                                  // The transaction used by this scenario's
                                  // test data has a fee of 9000 satoshis. Lowering
                                  // the max fee in the Bridge by one should
                                  // cause the expected failure.
                                  await bridge.setMovingFundsTxMaxTotalFee(8999)
                                }

                                tx = runMovingFundsScenario(
                                  data,
                                  beforeProofActions
                                )
                              })

                              after(async () => {
                                await restoreSnapshot()
                              })

                              it("should revert", async () => {
                                await expect(tx).to.be.revertedWith(
                                  "Transaction fee is too high"
                                )
                              })
                            })
                          }
                        )

                        context(
                          "when transaction amount is not distributed evenly",
                          () => {
                            const data: MovingFundsTestData =
                              MultipleTargetWalletsButAmountDistributedUnevenly

                            let tx: Promise<ContractTransaction>

                            before(async () => {
                              await createSnapshot()

                              tx = runMovingFundsScenario(data)
                            })

                            after(async () => {
                              await restoreSnapshot()
                            })

                            it("should revert", async () => {
                              await expect(tx).to.be.revertedWith(
                                "Transaction amount is not distributed evenly"
                              )
                            })
                          }
                        )
                      }
                    )

                    context(
                      "when the output vector contains P2SH output",
                      () => {
                        // The only possible case is P2SH which contains the
                        // 20-byte payload, just like P2PKH and P2WPKH.
                        // No need to check P2WSH as it uses a 32-byte payload
                        // so it would fail earlier, at the payload length
                        // assertion.
                        const data: MovingFundsTestData =
                          SingleTargetWalletButP2SH

                        let tx: Promise<ContractTransaction>

                        before(async () => {
                          await createSnapshot()

                          tx = runMovingFundsScenario(data)
                        })

                        after(async () => {
                          await restoreSnapshot()
                        })

                        it("should revert", async () => {
                          await expect(tx).to.be.revertedWith(
                            "Output must be P2PKH or P2WPKH"
                          )
                        })
                      }
                    )
                  }
                )

                context(
                  "when the output vector does not only reference 20-byte hashes",
                  () => {
                    // Use a provably unspendable output whose payload length
                    // is zero so it should cause a failure upon the assertion
                    // that makes sure the output payload is 20-byte.
                    const data: MovingFundsTestData = SingleProvablyUnspendable

                    let tx: Promise<ContractTransaction>

                    before(async () => {
                      await createSnapshot()

                      tx = runMovingFundsScenario(data)
                    })

                    after(async () => {
                      await restoreSnapshot()
                    })

                    it("should revert", async () => {
                      await expect(tx).to.be.revertedWith(
                        "Target wallet public key hash must have 20 bytes"
                      )
                    })
                  }
                )
              }
            )

            context(
              "when the single input doesn't point to the wallet's main UTXO",
              () => {
                const data: MovingFundsTestData = JSON.parse(
                  JSON.stringify(SingleTargetWallet)
                )

                let tx: Promise<ContractTransaction>

                before(async () => {
                  await createSnapshot()

                  // Corrupt the wallet's main UTXO that is injected to
                  // the Bridge state by the test runner in order to make it
                  // different than the input used by the actual Bitcoin
                  // transaction thus make the tested scenario happen. The
                  // proper value of `txOutputIndex` is `1` so any other value
                  // will do the trick.
                  data.mainUtxo.txOutputIndex = 0

                  tx = runMovingFundsScenario(data)
                })

                after(async () => {
                  await restoreSnapshot()
                })

                it("should revert", async () => {
                  await expect(tx).to.be.revertedWith(
                    "Outbound transaction input must point to the wallet's main UTXO"
                  )
                })
              }
            )
          })

          context("when input count is other than one", () => {
            const data: MovingFundsTestData = MultipleInputs

            let tx: Promise<ContractTransaction>

            before(async () => {
              await createSnapshot()

              tx = runMovingFundsScenario(data)
            })

            after(async () => {
              await restoreSnapshot()
            })

            it("should revert", async () => {
              await expect(tx).to.be.revertedWith(
                "Outbound transaction must have a single input"
              )
            })
          })
        })

        context("when main UTXO data are invalid", () => {
          const data: MovingFundsTestData = SingleTargetWallet

          before(async () => {
            await createSnapshot()

            // Required for a successful SPV proof.
            relay.getPrevEpochDifficulty.returns(data.chainDifficulty)
            relay.getCurrentEpochDifficulty.returns(data.chainDifficulty)

            // Wallet main UTXO must be set on the Bridge side to make
            // that scenario happen.
            await bridge.setWalletMainUtxo(
              data.wallet.pubKeyHash,
              data.mainUtxo
            )
          })

          after(async () => {
            relay.getPrevEpochDifficulty.reset()
            relay.getCurrentEpochDifficulty.reset()

            await restoreSnapshot()
          })

          it("should revert", async () => {
            // Corrupt the main UTXO parameter passed during
            // `submitMovingFundsProof` call. The proper value of
            // `txOutputIndex` for this test data set is `1` so any other
            // value will make this test scenario happen.
            const corruptedMainUtxo = {
              ...data.mainUtxo,
              txOutputIndex: 0,
            }

            await expect(
              bridge.submitMovingFundsProof(
                data.movingFundsTx,
                data.movingFundsProof,
                corruptedMainUtxo,
                data.wallet.pubKeyHash
              )
            ).to.be.revertedWith("Invalid main UTXO data")
          })
        })
      })

      context("when there is no main UTXO for the given wallet", () => {
        const data: MovingFundsTestData = SingleTargetWallet

        before(async () => {
          await createSnapshot()

          // Required for a successful SPV proof.
          relay.getPrevEpochDifficulty.returns(data.chainDifficulty)
          relay.getCurrentEpochDifficulty.returns(data.chainDifficulty)
        })

        after(async () => {
          relay.getPrevEpochDifficulty.reset()
          relay.getCurrentEpochDifficulty.reset()

          await restoreSnapshot()
        })

        it("should revert", async () => {
          // There was no preparations before `submitMovingFundsProof` call
          // so no main UTXO is set for the given wallet.
          await expect(
            bridge.submitMovingFundsProof(
              data.movingFundsTx,
              data.movingFundsProof,
              data.mainUtxo,
              data.wallet.pubKeyHash
            )
          ).to.be.revertedWith("No main UTXO for given wallet")
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
            otherBridge = await BridgeFactory.deploy(
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

  describe("notifyMovingFundsTimeout", () => {
    const walletDraft = {
      ecdsaWalletID: ecdsaWalletTestData.walletID,
      mainUtxoHash: ethers.constants.HashZero,
      pendingRedemptionsValue: 0,
      createdAt: 0,
      movingFundsRequestedAt: 0,
      closingStartedAt: 0,
      state: walletState.Unknown,
      movingFundsTargetWalletsCommitmentHash: ethers.constants.HashZero,
    }

    context("when source wallet is in the MovingFunds state", () => {
      before(async () => {
        await createSnapshot()

        await bridge.setWallet(ecdsaWalletTestData.pubKeyHash160, {
          ...walletDraft,
          state: walletState.Live,
        })

        // Wallet must have funds to be not closed immediately by
        // the following `__ecdsaWalletHeartbeatFailedCallback` call.
        await bridge.setWalletMainUtxo(ecdsaWalletTestData.pubKeyHash160, {
          txHash: ethers.constants.HashZero,
          txOutputIndex: 0,
          txOutputValue: to1ePrecision(10, 8),
        })

        // Switches the wallet to moving funds.
        await bridge
          .connect(walletRegistry.wallet)
          .__ecdsaWalletHeartbeatFailedCallback(
            ecdsaWalletTestData.walletID,
            ecdsaWalletTestData.publicKeyX,
            ecdsaWalletTestData.publicKeyY
          )
      })

      after(async () => {
        await restoreSnapshot()
      })

      context("when the moving funds process has timed out", () => {
        let tx: ContractTransaction

        before(async () => {
          await createSnapshot()

          walletRegistry.closeWallet.reset()

          await increaseTime(
            (
              await bridge.movingFundsParameters()
            ).movingFundsTimeout
          )

          tx = await bridge.notifyMovingFundsTimeout(
            ecdsaWalletTestData.pubKeyHash160
          )
        })

        after(async () => {
          walletRegistry.closeWallet.reset()

          await restoreSnapshot()
        })

        it("should switch the wallet to Terminated state", async () => {
          expect(
            (await bridge.wallets(ecdsaWalletTestData.pubKeyHash160)).state
          ).to.be.equal(walletState.Terminated)
        })

        it("should emit WalletTerminated event", async () => {
          await expect(tx)
            .to.emit(bridge, "WalletTerminated")
            .withArgs(
              ecdsaWalletTestData.walletID,
              ecdsaWalletTestData.pubKeyHash160
            )
        })

        it("should call ECDSA Wallet Registry's closeWallet function", async () => {
          // eslint-disable-next-line @typescript-eslint/no-unused-expressions
          expect(walletRegistry.closeWallet).to.have.been.calledOnceWith(
            ecdsaWalletTestData.walletID
          )
        })

        it("should emit MovingFundsTimedOut event", async () => {
          await expect(tx)
            .to.emit(bridge, "MovingFundsTimedOut")
            .withArgs(ecdsaWalletTestData.pubKeyHash160)
        })

        it("should slash wallet operators", async () => {
          // TODO: Implementation once slashing is integrated.
        })

        it("should reward the notifier", async () => {
          // TODO: Implementation once slashing is integrated.
        })
      })

      context("when the moving funds process has not timed out", () => {
        before(async () => {
          await createSnapshot()

          await increaseTime(
            (await bridge.movingFundsParameters()).movingFundsTimeout - 1
          )
        })

        after(async () => {
          await restoreSnapshot()
        })

        it("should revert", async () => {
          await expect(
            bridge.notifyMovingFundsTimeout(ecdsaWalletTestData.pubKeyHash160)
          ).to.be.revertedWith("Moving funds has not timed out yet")
        })
      })
    })

    context("when source wallet is not in the MovingFunds state", () => {
      const testData: {
        testName: string
        state: number
      }[] = [
        {
          testName: "when the source wallet is in the Unknown state",
          state: walletState.Unknown,
        },
        {
          testName: "when the source wallet is in the Live state",
          state: walletState.Live,
        },
        {
          testName: "when the source wallet is in the Closing state",
          state: walletState.Closing,
        },
        {
          testName: "when the source wallet is in the Closed state",
          state: walletState.Closed,
        },
        {
          testName: "when the source wallet is in the Terminated state",
          state: walletState.Terminated,
        },
      ]

      testData.forEach((test) => {
        context(test.testName, () => {
          before(async () => {
            await createSnapshot()

            await bridge.setWallet(ecdsaWalletTestData.pubKeyHash160, {
              ...walletDraft,
              state: test.state,
            })
          })

          after(async () => {
            await restoreSnapshot()
          })

          it("should revert", async () => {
            await expect(
              bridge.notifyMovingFundsTimeout(ecdsaWalletTestData.pubKeyHash160)
            ).to.be.revertedWith("ECDSA wallet must be in MovingFunds state")
          })
        })
      })
    })
  })

  describe("notifyMovingFundsBelowDust", () => {
    const walletDraft = {
      ecdsaWalletID: ecdsaWalletTestData.walletID,
      mainUtxoHash: ethers.constants.HashZero,
      pendingRedemptionsValue: 0,
      createdAt: 0,
      movingFundsRequestedAt: 0,
      closingStartedAt: 0,
      state: walletState.Unknown,
      movingFundsTargetWalletsCommitmentHash: ethers.constants.HashZero,
    }

    context("when the wallet is in the MovingFunds state", () => {
      before(async () => {
        await createSnapshot()

        await bridge.setWallet(ecdsaWalletTestData.pubKeyHash160, {
          ...walletDraft,
          state: walletState.MovingFunds,
        })
      })

      after(async () => {
        await restoreSnapshot()
      })

      context("when the main UTXO parameter is valid", () => {
        context("when the balance is below the dust threshold", () => {
          const mainUtxo = {
            txHash: ethers.constants.HashZero,
            txOutputIndex: 0,
            txOutputValue: constants.movingFundsDustThreshold - 1,
          }

          let tx: ContractTransaction

          before(async () => {
            await createSnapshot()

            await bridge.setWalletMainUtxo(
              ecdsaWalletTestData.pubKeyHash160,
              mainUtxo
            )

            tx = await bridge.notifyMovingFundsBelowDust(
              ecdsaWalletTestData.pubKeyHash160,
              mainUtxo
            )
          })

          after(async () => {
            await restoreSnapshot()
          })

          it("should change wallet's state to Closing", async () => {
            const { state } = await bridge.wallets(
              ecdsaWalletTestData.pubKeyHash160
            )

            expect(state).to.be.equal(walletState.Closing)
          })

          it("should set the wallet's closing started timestamp", async () => {
            const wallet = await bridge.wallets(
              ecdsaWalletTestData.pubKeyHash160
            )
            expect(wallet.closingStartedAt).to.be.equal(await lastBlockTime())
          })

          it("should emit WalletClosing event", async () => {
            await expect(tx)
              .to.emit(bridge, "WalletClosing")
              .withArgs(
                walletDraft.ecdsaWalletID,
                ecdsaWalletTestData.pubKeyHash160
              )
          })

          it("should emit MovingFundsBelowDustReported event", async () => {
            await expect(tx)
              .to.emit(bridge, "MovingFundsBelowDustReported")
              .withArgs(ecdsaWalletTestData.pubKeyHash160)
          })
        })

        context("when the balance is not below the dust threshold", () => {
          const mainUtxo = {
            txHash: ethers.constants.HashZero,
            txOutputIndex: 0,
            txOutputValue: constants.movingFundsDustThreshold,
          }

          before(async () => {
            await createSnapshot()

            await bridge.setWalletMainUtxo(
              ecdsaWalletTestData.pubKeyHash160,
              mainUtxo
            )
          })

          after(async () => {
            await restoreSnapshot()
          })

          it("should revert", async () => {
            await expect(
              bridge.notifyMovingFundsBelowDust(
                ecdsaWalletTestData.pubKeyHash160,
                mainUtxo
              )
            ).to.be.revertedWith(
              "Wallet BTC balance must be below the moving funds dust threshold"
            )
          })
        })
      })

      context("when the main UTXO parameter is invalid", () => {
        const mainUtxo = {
          txHash: ethers.constants.HashZero,
          txOutputIndex: 0,
          txOutputValue: to1ePrecision(1, 8),
        }

        before(async () => {
          await createSnapshot()

          await bridge.setWallet(ecdsaWalletTestData.pubKeyHash160, {
            ...walletDraft,
            state: walletState.MovingFunds,
          })

          await bridge.setWalletMainUtxo(
            ecdsaWalletTestData.pubKeyHash160,
            mainUtxo
          )
        })

        after(async () => {
          await restoreSnapshot()
        })

        it("should revert", async () => {
          const corruptedMainUtxo = {
            ...mainUtxo,
            txOutputIndex: 1,
          }

          await expect(
            bridge.notifyMovingFundsBelowDust(
              ecdsaWalletTestData.pubKeyHash160,
              corruptedMainUtxo
            )
          ).to.be.revertedWith("Invalid wallet main UTXO data")
        })
      })
    })

    context("when the wallet is not in the MovingFunds state", () => {
      const testData = [
        {
          testName: "when wallet state is Unknown",
          walletState: walletState.Unknown,
        },
        {
          testName: "when wallet state is Live",
          walletState: walletState.Live,
        },
        {
          testName: "when wallet state is Closing",
          walletState: walletState.Closing,
        },
        {
          testName: "when wallet state is Closed",
          walletState: walletState.Closed,
        },
        {
          testName: "when wallet state is Terminated",
          walletState: walletState.Terminated,
        },
      ]

      testData.forEach((test) => {
        context(test.testName, () => {
          before(async () => {
            await createSnapshot()

            await bridge.setWallet(ecdsaWalletTestData.pubKeyHash160, {
              ...walletDraft,
              state: test.walletState,
            })
          })

          after(async () => {
            await restoreSnapshot()
          })

          it("should revert", async () => {
            await expect(
              bridge.notifyMovingFundsBelowDust(
                ecdsaWalletTestData.pubKeyHash160,
                NO_MAIN_UTXO
              )
            ).to.be.revertedWith("ECDSA wallet must be in MovingFunds state")
          })
        })
      })
    })
  })

  async function runMovingFundsScenario(
    data: MovingFundsTestData,
    beforeProofActions?: () => Promise<void>
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
      closingStartedAt: 0,
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

    if (beforeProofActions) {
      await beforeProofActions()
    }

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
