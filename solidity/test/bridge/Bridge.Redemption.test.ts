/* eslint-disable no-underscore-dangle */
/* eslint-disable @typescript-eslint/no-unused-expressions */

import { ethers, helpers, waffle } from "hardhat"
import { SignerWithAddress } from "@nomiclabs/hardhat-ethers/signers"
import chai, { expect } from "chai"
import { BigNumber, BigNumberish, ContractTransaction } from "ethers"
import { BytesLike } from "@ethersproject/bytes"
import { smock } from "@defi-wonderland/smock"
import type { FakeContract } from "@defi-wonderland/smock"
import type {
  Bank,
  BankStub,
  Bridge,
  BridgeStub,
  BridgeStub__factory,
  IWalletRegistry,
  IRelay,
} from "../../typechain"
import { NO_MAIN_UTXO } from "../data/deposit-sweep"
import {
  MultiplePendingRequestedRedemptions,
  MultiplePendingRequestedRedemptionsWithP2WPKHChange,
  RedemptionBalanceChange,
  RedemptionTestData,
  SingleP2PKHChange,
  SingleP2SHChange,
  SingleP2WPKHChange,
  SingleP2WPKHChangeZeroValue,
  SingleNonRequestedRedemption,
  SinglePendingRequestedRedemption,
  SingleProvablyUnspendable,
  MultiplePendingRequestedRedemptionsWithP2SHChange,
  MultiplePendingRequestedRedemptionsWithMultipleP2WPKHChanges,
  MultiplePendingRequestedRedemptionsWithP2WPKHChangeZeroValue,
  MultiplePendingRequestedRedemptionsWithNonRequestedRedemption,
  MultiplePendingRequestedRedemptionsWithProvablyUnspendable,
  MultiplePendingRequestedRedemptionsWithMultipleInputs,
} from "../data/redemption"
import { walletState } from "../fixtures"
import bridgeFixture from "../fixtures/bridge"

chai.use(smock.matchers)

const { createSnapshot, restoreSnapshot } = helpers.snapshot
const { lastBlockTime, increaseTime } = helpers.time
const { impersonateAccount } = helpers.account

describe("Bridge - Redemption", () => {
  let governance: SignerWithAddress
  let thirdParty: SignerWithAddress
  let treasury: SignerWithAddress

  let bank: Bank & BankStub
  let relay: FakeContract<IRelay>
  let BridgeFactory: BridgeStub__factory
  let bridge: Bridge & BridgeStub
  let walletRegistry: FakeContract<IWalletRegistry>

  let redemptionTimeout: BigNumber
  let redemptionTimeoutSlashingAmount: BigNumber
  let redemptionTimeoutNotifierRewardMultiplier: BigNumber

  before(async () => {
    // eslint-disable-next-line @typescript-eslint/no-extra-semi
    ;({
      governance,
      thirdParty,
      treasury,
      bank,
      relay,
      walletRegistry,
      bridge,
      BridgeFactory,
    } = await waffle.loadFixture(bridgeFixture))
    ;({
      redemptionTimeout,
      redemptionTimeoutSlashingAmount,
      redemptionTimeoutNotifierRewardMultiplier,
    } = await bridge.redemptionParameters())

    // Set the deposit dust threshold to 0.0001 BTC, i.e. 100x smaller than
    // the initial value in the Bridge in order to save test Bitcoins.
    await bridge.setDepositDustThreshold(10000)
    // Set the redemption dust threshold to 0.001 BTC, i.e. 10x smaller than
    // the initial value in the Bridge in order to save test Bitcoins.
    await bridge.setRedemptionDustThreshold(100000)

    redemptionTimeout = (await bridge.redemptionParameters()).redemptionTimeout
  })

  describe("requestRedemption", () => {
    const walletPubKeyHash = "0x8db50eb52063ea9d98b3eac91489a90f738986f6"

    context("when wallet state is Live", () => {
      before(async () => {
        await createSnapshot()

        // Simulate the wallet is an Live one and is known in the system.
        await bridge.setWallet(walletPubKeyHash, {
          ecdsaWalletID: ethers.constants.HashZero,
          mainUtxoHash: ethers.constants.HashZero,
          pendingRedemptionsValue: 0,
          createdAt: await lastBlockTime(),
          movingFundsRequestedAt: 0,
          closingStartedAt: 0,
          pendingMovedFundsSweepRequestsCount: 0,
          state: walletState.Live,
          movingFundsTargetWalletsCommitmentHash: ethers.constants.HashZero,
        })
      })

      after(async () => {
        await restoreSnapshot()
      })

      context("when there is a main UTXO for the given wallet", () => {
        // Prepare a dumb main UTXO with 10M satoshi as value. This will
        // be the wallet BTC balance.
        const mainUtxo = {
          txHash:
            "0x3835ecdee2daa83c9a19b5012104ace55ecab197b5e16489c26d372e475f5d2a",
          txOutputIndex: 0,
          txOutputValue: 10000000,
        }

        before(async () => {
          await createSnapshot()

          // Simulate the prepared main UTXO belongs to the wallet.
          await bridge.setWalletMainUtxo(walletPubKeyHash, mainUtxo)
        })

        after(async () => {
          await restoreSnapshot()
        })

        context("when main UTXO data are valid", () => {
          context("when redeemer output script is standard type", () => {
            // Arbitrary standard output scripts.
            const redeemerOutputScriptP2WPKH =
              "0x160014f4eedc8f40d4b8e30771f792b065ebec0abaddef"
            const redeemerOutputScriptP2WSH =
              "0x220020ef0b4d985752aa5ef6243e4c6f6bebc2a007e7d671ef27d4b1d0db8dcc93bc1c"
            const redeemerOutputScriptP2PKH =
              "0x1976a914f4eedc8f40d4b8e30771f792b065ebec0abaddef88ac"
            const redeemerOutputScriptP2SH =
              "0x17a914f4eedc8f40d4b8e30771f792b065ebec0abaddef87"

            context(
              "when redeemer output script does not point to the wallet public key hash",
              () => {
                context("when amount is not below the dust threshold", () => {
                  // Requested amount is 1901000 satoshi.
                  const requestedAmount = BigNumber.from(1901000)
                  // Treasury fee is `requestedAmount / redemptionTreasuryFeeDivisor`
                  // where the divisor is `2000` initially. So, we
                  // have 1901000 / 2000 = 950.5 though Solidity
                  // loses the decimal part.
                  const treasuryFee = 950

                  context(
                    "when there is no pending request for the given redemption key",
                    () => {
                      context("when wallet has sufficient funds", () => {
                        context(
                          "when redeemer made a sufficient allowance in Bank",
                          () => {
                            let redeemer: SignerWithAddress

                            before(async () => {
                              await createSnapshot()

                              // Use an arbitrary ETH account as redeemer.
                              redeemer = thirdParty

                              await makeRedemptionAllowance(
                                redeemer,
                                requestedAmount
                              )
                            })

                            after(async () => {
                              await restoreSnapshot()
                            })

                            context(
                              "when redeemer output script is P2WPKH",
                              () => {
                                const redeemerOutputScript =
                                  redeemerOutputScriptP2WPKH

                                let initialBridgeBalance: BigNumber
                                let initialRedeemerBalance: BigNumber
                                let initialWalletPendingRedemptionValue: BigNumber
                                let tx: ContractTransaction

                                let redemptionTxMaxFee: BigNumber

                                before(async () => {
                                  await createSnapshot()

                                  redemptionTxMaxFee = (
                                    await bridge.redemptionParameters()
                                  ).redemptionTxMaxFee

                                  // Capture initial TBTC balance of Bridge and
                                  // redeemer.
                                  initialBridgeBalance = await bank.balanceOf(
                                    bridge.address
                                  )
                                  initialRedeemerBalance = await bank.balanceOf(
                                    redeemer.address
                                  )

                                  // Capture the initial pending redemptions value
                                  // for the given wallet.
                                  initialWalletPendingRedemptionValue = (
                                    await bridge.wallets(walletPubKeyHash)
                                  ).pendingRedemptionsValue

                                  // Perform the redemption request.
                                  tx = await bridge
                                    .connect(redeemer)
                                    .requestRedemption(
                                      walletPubKeyHash,
                                      mainUtxo,
                                      redeemerOutputScript,
                                      requestedAmount
                                    )
                                })

                                after(async () => {
                                  await restoreSnapshot()
                                })

                                it("should increase the wallet's pending redemptions value", async () => {
                                  const walletPendingRedemptionValue = (
                                    await bridge.wallets(walletPubKeyHash)
                                  ).pendingRedemptionsValue

                                  expect(
                                    walletPendingRedemptionValue.sub(
                                      initialWalletPendingRedemptionValue
                                    )
                                  ).to.be.equal(
                                    requestedAmount.sub(treasuryFee)
                                  )
                                })

                                it("should store the redemption request", async () => {
                                  const redemptionKey = buildRedemptionKey(
                                    walletPubKeyHash,
                                    redeemerOutputScript
                                  )

                                  const redemptionRequest =
                                    await bridge.pendingRedemptions(
                                      redemptionKey
                                    )

                                  expect(
                                    redemptionRequest.redeemer
                                  ).to.be.equal(redeemer.address)
                                  expect(
                                    redemptionRequest.requestedAmount
                                  ).to.be.equal(requestedAmount)
                                  expect(
                                    redemptionRequest.treasuryFee
                                  ).to.be.equal(treasuryFee)
                                  expect(
                                    redemptionRequest.txMaxFee
                                  ).to.be.equal(redemptionTxMaxFee)
                                  expect(
                                    redemptionRequest.requestedAt
                                  ).to.be.equal(await lastBlockTime())
                                })

                                it("should emit RedemptionRequested event", async () => {
                                  await expect(tx)
                                    .to.emit(bridge, "RedemptionRequested")
                                    .withArgs(
                                      walletPubKeyHash,
                                      redeemerOutputScript,
                                      redeemer.address,
                                      requestedAmount,
                                      treasuryFee,
                                      redemptionTxMaxFee
                                    )
                                })

                                it("should take the right TBTC balance from Bank", async () => {
                                  const bridgeBalance = await bank.balanceOf(
                                    bridge.address
                                  )
                                  expect(
                                    bridgeBalance.sub(initialBridgeBalance)
                                  ).to.equal(requestedAmount)

                                  const redeemerBalance = await bank.balanceOf(
                                    redeemer.address
                                  )
                                  expect(
                                    redeemerBalance.sub(initialRedeemerBalance)
                                  ).to.equal(requestedAmount.mul(-1))
                                })
                              }
                            )

                            context(
                              "when redeemer output script is P2WSH",
                              () => {
                                before(async () => {
                                  await createSnapshot()
                                })

                                after(async () => {
                                  await restoreSnapshot()
                                })

                                // Do not repeat all check made in the
                                // "when redeemer output script is P2WPKH"
                                // scenario but just assert the call succeeds
                                // for an P2WSH output script.
                                it("should succeed", async () => {
                                  await expect(
                                    bridge
                                      .connect(redeemer)
                                      .requestRedemption(
                                        walletPubKeyHash,
                                        mainUtxo,
                                        redeemerOutputScriptP2WSH,
                                        requestedAmount
                                      )
                                  ).to.not.be.reverted
                                })
                              }
                            )

                            context(
                              "when redeemer output script is P2PKH",
                              () => {
                                before(async () => {
                                  await createSnapshot()
                                })

                                after(async () => {
                                  await restoreSnapshot()
                                })

                                // Do not repeat all check made in the
                                // "when redeemer output script is P2WPKH"
                                // scenario but just assert the call succeeds
                                // for an P2PKH output script.
                                it("should succeed", async () => {
                                  await expect(
                                    bridge
                                      .connect(redeemer)
                                      .requestRedemption(
                                        walletPubKeyHash,
                                        mainUtxo,
                                        redeemerOutputScriptP2PKH,
                                        requestedAmount
                                      )
                                  ).to.not.be.reverted
                                })
                              }
                            )

                            context(
                              "when redeemer output script is P2SH",
                              () => {
                                before(async () => {
                                  await createSnapshot()
                                })

                                after(async () => {
                                  await restoreSnapshot()
                                })

                                // Do not repeat all check made in the
                                // "when redeemer output script is P2WPKH"
                                // scenario but just assert the call succeeds
                                // for an P2SH output script.
                                it("should succeed", async () => {
                                  await expect(
                                    bridge
                                      .connect(redeemer)
                                      .requestRedemption(
                                        walletPubKeyHash,
                                        mainUtxo,
                                        redeemerOutputScriptP2SH,
                                        requestedAmount
                                      )
                                  ).to.not.be.reverted
                                })
                              }
                            )
                          }
                        )

                        context(
                          "when redeemer has not made a sufficient allowance in Bank",
                          () => {
                            it("should revert", async () => {
                              await expect(
                                bridge
                                  .connect(thirdParty)
                                  .requestRedemption(
                                    walletPubKeyHash,
                                    mainUtxo,
                                    redeemerOutputScriptP2WPKH,
                                    requestedAmount
                                  )
                              ).to.be.revertedWith(
                                "Transfer amount exceeds allowance"
                              )
                            })
                          }
                        )
                      })

                      context("when wallet has insufficient funds", () => {
                        before(async () => {
                          await createSnapshot()

                          // Simulate a situation when the wallet has so many
                          // pending redemptions that a new request will
                          // exceed its Bitcoin balance. This is done by making
                          // a redemption request that will request the entire
                          // wallet's balance right before the tested request.
                          await makeRedemptionAllowance(
                            thirdParty,
                            mainUtxo.txOutputValue
                          )
                          await bridge
                            .connect(thirdParty)
                            .requestRedemption(
                              walletPubKeyHash,
                              mainUtxo,
                              redeemerOutputScriptP2WPKH,
                              mainUtxo.txOutputValue
                            )
                        })

                        after(async () => {
                          await restoreSnapshot()
                        })

                        it("should revert", async () => {
                          await expect(
                            bridge
                              .connect(thirdParty)
                              .requestRedemption(
                                walletPubKeyHash,
                                mainUtxo,
                                redeemerOutputScriptP2WSH,
                                requestedAmount
                              )
                          ).to.be.revertedWith("Insufficient wallet funds")
                        })
                      })
                    }
                  )

                  context(
                    "when there is a pending request for the given redemption key",
                    () => {
                      before(async () => {
                        await createSnapshot()

                        // Make a request targeting the given wallet and
                        // redeemer output script. Tested request will use
                        // the same parameters.
                        await makeRedemptionAllowance(
                          thirdParty,
                          mainUtxo.txOutputValue
                        )
                        await bridge
                          .connect(thirdParty)
                          .requestRedemption(
                            walletPubKeyHash,
                            mainUtxo,
                            redeemerOutputScriptP2WPKH,
                            mainUtxo.txOutputValue
                          )
                      })

                      after(async () => {
                        await restoreSnapshot()
                      })

                      it("should revert", async () => {
                        await expect(
                          bridge
                            .connect(thirdParty)
                            .requestRedemption(
                              walletPubKeyHash,
                              mainUtxo,
                              redeemerOutputScriptP2WPKH,
                              requestedAmount
                            )
                        ).to.be.revertedWith(
                          "There is a pending redemption request from this wallet to the same address"
                        )
                      })
                    }
                  )
                })

                context("when amount is below the dust threshold", () => {
                  it("should revert", async () => {
                    // Initial dust threshold set in the tests `fixture`
                    // for tests is 100000. A value lower by 1 sat should
                    // trigger the tested condition.
                    await expect(
                      bridge
                        .connect(thirdParty)
                        .requestRedemption(
                          walletPubKeyHash,
                          mainUtxo,
                          redeemerOutputScriptP2WPKH,
                          99999
                        )
                    ).to.be.revertedWith("Redemption amount too small")
                  })
                })
              }
            )

            context(
              "when redeemer output script points to the wallet public key hash",
              () => {
                it("should revert", async () => {
                  // Wallet public key hash hidden under P2WPKH.
                  await expect(
                    bridge
                      .connect(thirdParty)
                      .requestRedemption(
                        walletPubKeyHash,
                        mainUtxo,
                        `0x160014${walletPubKeyHash.substring(2)}`,
                        100000
                      )
                  ).to.be.revertedWith(
                    "Redeemer output script must not point to the wallet PKH"
                  )

                  // Wallet public key hash hidden under P2PKH.
                  await expect(
                    bridge
                      .connect(thirdParty)
                      .requestRedemption(
                        walletPubKeyHash,
                        mainUtxo,
                        `0x1976a914${walletPubKeyHash.substring(2)}88ac`,
                        100000
                      )
                  ).to.be.revertedWith(
                    "Redeemer output script must not point to the wallet PKH"
                  )

                  // Wallet public key hash hidden under P2SH.
                  await expect(
                    bridge
                      .connect(thirdParty)
                      .requestRedemption(
                        walletPubKeyHash,
                        mainUtxo,
                        `0x17a914${walletPubKeyHash.substring(2)}87`,
                        100000
                      )
                  ).to.be.revertedWith(
                    "Redeemer output script must not point to the wallet PKH"
                  )

                  // There is no need to check for P2WSH since that type
                  // uses 32-byte hashes. Because wallet public key hash is
                  // always 20-byte, there is no possibility those hashes
                  // can be confused during change output recognition.
                })
              }
            )
          })

          context("when redeemer output script is not standard type", () => {
            it("should revert", async () => {
              // The set of non-standard/malformed scripts is infinite.
              // A malformed P2PKH redeemer script is used as example.
              await expect(
                bridge
                  .connect(thirdParty)
                  .requestRedemption(
                    walletPubKeyHash,
                    mainUtxo,
                    "0x1988a914f4eedc8f40d4b8e30771f792b065ebec0abaddef88ac",
                    100000
                  )
              ).to.be.revertedWith(
                "Redeemer output script must be a standard type"
              )
            })
          })
        })

        context("when main UTXO data are invalid", () => {
          it("should revert", async () => {
            // The proper main UTXO hash `0` as `txOutputIndex`.
            await expect(
              bridge.connect(thirdParty).requestRedemption(
                walletPubKeyHash,
                {
                  txHash:
                    "0x3835ecdee2daa83c9a19b5012104ace55ecab197b5e16489c26d372e475f5d2a",
                  txOutputIndex: 1,
                  txOutputValue: 10000000,
                },
                "0x160014f4eedc8f40d4b8e30771f792b065ebec0abaddef",
                100000
              )
            ).to.be.revertedWith("Invalid main UTXO data")
          })
        })
      })

      context("when there is no main UTXO for the given wallet", () => {
        it("should revert", async () => {
          // Since there is no main UTXO for this wallet recorded in the
          // Bridge, the `mainUtxo` parameter can be anything.
          await expect(
            bridge
              .connect(thirdParty)
              .requestRedemption(
                walletPubKeyHash,
                NO_MAIN_UTXO,
                "0x160014f4eedc8f40d4b8e30771f792b065ebec0abaddef",
                100000
              )
          ).to.be.revertedWith("No main UTXO for the given wallet")
        })
      })
    })

    context("when wallet state is other than Live", () => {
      const testData: { testName: string; state: number }[] = [
        {
          testName: "when wallet state is Unknown",
          state: walletState.Unknown,
        },
        {
          testName: "when wallet state is MovingFunds",
          state: walletState.MovingFunds,
        },
        {
          testName: "when wallet state is Closing",
          state: walletState.Closing,
        },
        {
          testName: "when wallet state is Closed",
          state: walletState.Closed,
        },
        {
          testName: "when wallet state is Terminated",
          state: walletState.Terminated,
        },
      ]

      testData.forEach((test) => {
        context(test.testName, () => {
          before(async () => {
            await createSnapshot()

            await bridge.setWallet(walletPubKeyHash, {
              ecdsaWalletID: ethers.constants.HashZero,
              mainUtxoHash: ethers.constants.HashZero,
              pendingRedemptionsValue: 0,
              createdAt: await lastBlockTime(),
              movingFundsRequestedAt: 0,
              closingStartedAt: 0,
              pendingMovedFundsSweepRequestsCount: 0,
              state: test.state,
              movingFundsTargetWalletsCommitmentHash: ethers.constants.HashZero,
            })
          })

          after(async () => {
            await restoreSnapshot()
          })

          it("should revert", async () => {
            await expect(
              bridge
                .connect(thirdParty)
                .requestRedemption(
                  walletPubKeyHash,
                  NO_MAIN_UTXO,
                  "0x160014f4eedc8f40d4b8e30771f792b065ebec0abaddef",
                  100000
                )
            ).to.be.revertedWith("Wallet must be in Live state")
          })
        })
      })
    })
  })

  describe("submitRedemptionProof", () => {
    context("when transaction proof is valid", () => {
      context("when there is a main UTXO for the given wallet", () => {
        context("when main UTXO data are valid", () => {
          context("when there is only one input", () => {
            context(
              "when the single input points to the wallet's main UTXO",
              () => {
                context("when wallet state is Live", () => {
                  context("when there is only one output", () => {
                    context(
                      "when the single output is a pending requested redemption",
                      () => {
                        const data: RedemptionTestData =
                          SinglePendingRequestedRedemption

                        let tx: ContractTransaction
                        let bridgeBalance: RedemptionBalanceChange
                        let walletPendingRedemptionsValue: RedemptionBalanceChange
                        let treasuryBalance: RedemptionBalanceChange
                        let redeemersBalances: RedemptionBalanceChange[]

                        before(async () => {
                          await createSnapshot()

                          // Simulate the situation when treasury fee is 0% to
                          // allow using the whole wallet's main UTXO value
                          // to fulfill the redemption request.
                          await bridge.setRedemptionTreasuryFeeDivisor(0)

                          // eslint-disable-next-line @typescript-eslint/no-extra-semi
                          ;({
                            tx,
                            bridgeBalance,
                            walletPendingRedemptionsValue,
                            treasuryBalance,
                            redeemersBalances,
                          } = await runRedemptionScenario(data))
                        })

                        after(async () => {
                          await restoreSnapshot()
                        })

                        it("should close processed redemption request", async () => {
                          const redemptionRequest =
                            await bridge.pendingRedemptions(
                              buildRedemptionKey(
                                data.wallet.pubKeyHash,
                                data.redemptionRequests[0].redeemerOutputScript
                              )
                            )

                          expect(redemptionRequest.requestedAt).to.be.equal(
                            0,
                            "Redemption request has not been closed"
                          )
                        })

                        it("should delete the wallet's main UTXO", async () => {
                          // The Bitcoin redemption transaction has no change
                          // output so the wallet's main UTXO should be
                          // deleted on the Bridge side.
                          expect(
                            (await bridge.wallets(data.wallet.pubKeyHash))
                              .mainUtxoHash
                          ).to.be.equal(ethers.constants.HashZero)
                        })

                        it("should mark the previous main UTXO as spent", async () => {
                          const mainUtxoKey = ethers.utils.solidityKeccak256(
                            ["bytes32", "uint32"],
                            [data.mainUtxo.txHash, data.mainUtxo.txOutputIndex]
                          )

                          expect(await bridge.spentMainUTXOs(mainUtxoKey)).to.be
                            .true
                        })

                        it("should decrease the wallet's pending redemptions value", async () => {
                          // Wallet pending redemptions value should be
                          // decreased by the total redeemable amount but since
                          // the treasury fee is 0% in this test case, the
                          // total redeemable amount is equal to the total
                          // requested amount. See docs of the used test
                          // data for details.
                          expect(
                            walletPendingRedemptionsValue.afterProof.sub(
                              walletPendingRedemptionsValue.beforeProof
                            )
                          ).to.equal(-1177424)
                        })

                        it("should decrease Bridge's balance in Bank", async () => {
                          // Balance should be decreased by the total
                          // redeemable amount but since the treasury fee
                          // is 0% in this test case, the total redeemable
                          // amount is equal to the total requested amount.
                          // See docs of the used test data for details.
                          await expect(tx)
                            .to.emit(bank, "BalanceDecreased")
                            .withArgs(bridge.address, 1177424)
                          // In this case, the total Bridge balance change
                          // should be also equal to the same amount.
                          expect(
                            bridgeBalance.afterProof.sub(
                              bridgeBalance.beforeProof
                            )
                          ).to.equal(-1177424)
                        })

                        it("should not transfer anything to the treasury", async () => {
                          // Treasury balance should not be increased because
                          // the treasury fee is 0% in this test case.
                          expect(
                            treasuryBalance.afterProof.sub(
                              treasuryBalance.beforeProof
                            )
                          ).to.equal(0)
                        })

                        it("should not change redeemer balance in any way", async () => {
                          // Redemption proof submission should NEVER cause
                          // any change of the redeemer balance.
                          const redeemerBalance = redeemersBalances[0]

                          expect(
                            redeemerBalance.afterProof.sub(
                              redeemerBalance.beforeProof
                            )
                          ).to.be.equal(0, "Balance of redeemer has changed")
                        })
                      }
                    )

                    context(
                      "when the single output is a non-reported timed out requested redemption",
                      () => {
                        const data: RedemptionTestData =
                          SinglePendingRequestedRedemption

                        let tx: ContractTransaction
                        let bridgeBalance: RedemptionBalanceChange
                        let walletPendingRedemptionsValue: RedemptionBalanceChange
                        let treasuryBalance: RedemptionBalanceChange
                        let redeemersBalances: RedemptionBalanceChange[]

                        before(async () => {
                          await createSnapshot()

                          // Simulate the situation when treasury fee is 0% to
                          // allow using the whole wallet's main UTXO value
                          // to fulfill the redemption request.
                          await bridge.setRedemptionTreasuryFeeDivisor(0)

                          // Before submitting the redemption proof, wait
                          // an amount of time that will make the request
                          // timed out though don't report the timeout.
                          const beforeProofActions = async () => {
                            await increaseTime(redemptionTimeout)
                          }

                          // eslint-disable-next-line @typescript-eslint/no-extra-semi
                          ;({
                            tx,
                            bridgeBalance,
                            walletPendingRedemptionsValue,
                            treasuryBalance,
                            redeemersBalances,
                          } = await runRedemptionScenario(
                            data,
                            beforeProofActions
                          ))
                        })

                        after(async () => {
                          await restoreSnapshot()
                        })

                        it("should close processed redemption request", async () => {
                          const redemptionRequest =
                            await bridge.pendingRedemptions(
                              buildRedemptionKey(
                                data.wallet.pubKeyHash,
                                data.redemptionRequests[0].redeemerOutputScript
                              )
                            )

                          expect(redemptionRequest.requestedAt).to.be.equal(
                            0,
                            "Redemption request has not been closed"
                          )
                        })

                        it("should delete the wallet's main UTXO", async () => {
                          // The Bitcoin redemption transaction has no change
                          // output so the wallet's main UTXO should be
                          // deleted on the Bridge side.
                          expect(
                            (await bridge.wallets(data.wallet.pubKeyHash))
                              .mainUtxoHash
                          ).to.be.equal(ethers.constants.HashZero)
                        })

                        it("should mark the previous main UTXO as spent", async () => {
                          const mainUtxoKey = ethers.utils.solidityKeccak256(
                            ["bytes32", "uint32"],
                            [data.mainUtxo.txHash, data.mainUtxo.txOutputIndex]
                          )

                          expect(await bridge.spentMainUTXOs(mainUtxoKey)).to.be
                            .true
                        })

                        it("should decrease the wallet's pending redemptions value", async () => {
                          // Wallet pending redemptions value should be
                          // decreased by the total redeemable amount but since
                          // the treasury fee is 0% in this test case, the
                          // total redeemable amount is equal to the total
                          // requested amount. See docs of the used test
                          // data for details.
                          expect(
                            walletPendingRedemptionsValue.afterProof.sub(
                              walletPendingRedemptionsValue.beforeProof
                            )
                          ).to.equal(-1177424)
                        })

                        it("should decrease Bridge's balance in Bank", async () => {
                          // Balance should be decreased by the total
                          // redeemable amount but since the treasury fee
                          // is 0% in this test case, the total redeemable
                          // amount is equal to the total requested amount.
                          // See docs of the used test data for details.
                          await expect(tx)
                            .to.emit(bank, "BalanceDecreased")
                            .withArgs(bridge.address, 1177424)
                          // In this case, the total Bridge balance change
                          // should be also equal to the same amount.
                          expect(
                            bridgeBalance.afterProof.sub(
                              bridgeBalance.beforeProof
                            )
                          ).to.equal(-1177424)
                        })

                        it("should not transfer anything to the treasury", async () => {
                          // Treasury balance should not be increased because
                          // the treasury fee is 0% in this test case.
                          expect(
                            treasuryBalance.afterProof.sub(
                              treasuryBalance.beforeProof
                            )
                          ).to.equal(0)
                        })

                        it("should not change redeemer balance in any way", async () => {
                          // Redemption proof submission should NEVER cause
                          // any change of the redeemer balance.
                          const redeemerBalance = redeemersBalances[0]

                          expect(
                            redeemerBalance.afterProof.sub(
                              redeemerBalance.beforeProof
                            )
                          ).to.be.equal(0, "Balance of redeemer has changed")
                        })
                      }
                    )

                    context(
                      "when the single output is a reported timed out requested redemption",
                      () => {
                        const data: RedemptionTestData =
                          SinglePendingRequestedRedemption

                        let tx: ContractTransaction
                        let bridgeBalance: RedemptionBalanceChange
                        let walletPendingRedemptionsValue: RedemptionBalanceChange
                        let treasuryBalance: RedemptionBalanceChange
                        let redeemersBalances: RedemptionBalanceChange[]

                        before(async () => {
                          await createSnapshot()

                          // Simulate the situation when treasury fee is 0% to
                          // allow using the whole wallet's main UTXO value
                          // to fulfill the redemption request.
                          await bridge.setRedemptionTreasuryFeeDivisor(0)

                          // Before submitting the redemption proof, wait
                          // an amount of time that will make the request
                          // timed out and then report the timeout.
                          const beforeProofActions = async () => {
                            await increaseTime(redemptionTimeout)
                            await bridge.notifyRedemptionTimeout(
                              data.wallet.pubKeyHash,
                              [],
                              data.redemptionRequests[0].redeemerOutputScript
                            )
                          }

                          // eslint-disable-next-line @typescript-eslint/no-extra-semi
                          ;({
                            tx,
                            bridgeBalance,
                            walletPendingRedemptionsValue,
                            treasuryBalance,
                            redeemersBalances,
                          } = await runRedemptionScenario(
                            data,
                            beforeProofActions
                          ))
                        })

                        after(async () => {
                          walletRegistry.seize.reset()

                          await restoreSnapshot()
                        })

                        it("should hold the timed out request in the contract state", async () => {
                          const redemptionRequest =
                            await bridge.timedOutRedemptions(
                              buildRedemptionKey(
                                data.wallet.pubKeyHash,
                                data.redemptionRequests[0].redeemerOutputScript
                              )
                            )

                          expect(
                            redemptionRequest.requestedAt
                          ).to.be.greaterThan(
                            0,
                            "Timed out request was removed from the contract state"
                          )
                        })

                        it("should delete the wallet's main UTXO", async () => {
                          // The Bitcoin redemption transaction has no change
                          // output so the wallet's main UTXO should be
                          // deleted on the Bridge side. It doesn't matter
                          // the only redemption handled by the transaction
                          // is reported as timed out.
                          expect(
                            (await bridge.wallets(data.wallet.pubKeyHash))
                              .mainUtxoHash
                          ).to.be.equal(ethers.constants.HashZero)
                        })

                        it("should mark the previous main UTXO as spent", async () => {
                          const mainUtxoKey = ethers.utils.solidityKeccak256(
                            ["bytes32", "uint32"],
                            [data.mainUtxo.txHash, data.mainUtxo.txOutputIndex]
                          )

                          expect(await bridge.spentMainUTXOs(mainUtxoKey)).to.be
                            .true
                        })

                        it("should not change the wallet's pending redemptions value", async () => {
                          // All the bookkeeping regarding the timed out
                          // request was done upon timeout report. The
                          // wallet pending redemptions value should not
                          // be changed in any way.
                          expect(
                            walletPendingRedemptionsValue.afterProof.sub(
                              walletPendingRedemptionsValue.beforeProof
                            )
                          ).to.equal(0)
                        })

                        it("should not change Bridge's balance in Bank", async () => {
                          // All the bookkeeping regarding the timed out
                          // request was done upon timeout report. The Bridge
                          // balance in the bank should neither be decreased...
                          await expect(tx)
                            .to.emit(bank, "BalanceDecreased")
                            .withArgs(bridge.address, 0)
                          // ...nor changed in any other way.
                          expect(
                            bridgeBalance.afterProof.sub(
                              bridgeBalance.beforeProof
                            )
                          ).to.equal(0)
                        })

                        it("should not transfer anything to the treasury", async () => {
                          // Treasury balance should not be increased in any way
                          // since the only request handled by the redemption
                          // transaction is reported as timed out and is just
                          // skipped during processing.
                          expect(
                            treasuryBalance.afterProof.sub(
                              treasuryBalance.beforeProof
                            )
                          ).to.equal(0)
                        })

                        it("should not change redeemer balance in any way", async () => {
                          // Redemption proof submission should NEVER cause
                          // any change of the redeemer balance.
                          const redeemerBalance = redeemersBalances[0]

                          expect(
                            redeemerBalance.afterProof.sub(
                              redeemerBalance.beforeProof
                            )
                          ).to.be.equal(0, "Balance of redeemer has changed")
                        })
                      }
                    )

                    context(
                      "when the single output is a pending requested redemption but redeemed amount is wrong",
                      () => {
                        const data: RedemptionTestData = JSON.parse(
                          JSON.stringify(SinglePendingRequestedRedemption)
                        )

                        let outcome: Promise<RedemptionScenarioOutcome>

                        before(async () => {
                          await createSnapshot()

                          // Alter the single redemption request in the test
                          // data and set such an amount that will cause
                          // the Bitcoin redemption transaction to be deemed
                          // as invalid due to a wrong amount. The transaction
                          // output has the value of 1176924 so to make this
                          // test scenario happen, the request amount must be
                          // way different (lesser or greater) than the output
                          // value. Worth noting that this test scenario tests
                          // the amount condition in a general and simplified
                          // way without stressing all specific edge cases.
                          // Doing a detailed check would require more dedicated
                          // test data sets which would make it far more
                          // complicated without giving much value in return.
                          data.redemptionRequests[0].amount = 300000

                          outcome = runRedemptionScenario(data)
                        })

                        after(async () => {
                          await restoreSnapshot()
                        })

                        it("should revert", async () => {
                          await expect(outcome).to.be.revertedWith(
                            "Output value is not within the acceptable range of the pending request"
                          )
                        })
                      }
                    )

                    context(
                      "when the single output is a reported timed out requested redemption but amount is wrong",
                      () => {
                        const data: RedemptionTestData = JSON.parse(
                          JSON.stringify(SinglePendingRequestedRedemption)
                        )

                        let outcome: Promise<RedemptionScenarioOutcome>

                        before(async () => {
                          await createSnapshot()

                          // Alter the single redemption request in the test
                          // data and set such an amount that will cause
                          // the Bitcoin redemption transaction to be deemed
                          // as invalid due to a wrong amount. The transaction
                          // output has the value of 1176924 so to make this
                          // test scenario happen, the request amount must be
                          // way different (lesser or greater) than the output
                          // value. Worth noting that this test scenario tests
                          // the amount condition in a general and simplified
                          // way without stressing all specific edge cases.
                          // Doing a detailed check would require more dedicated
                          // test data sets which would make it far more
                          // complicated without giving much value in return.
                          data.redemptionRequests[0].amount = 300000

                          // Before submitting the redemption proof, wait
                          // an amount of time that will make the request
                          // timed out and then report the timeout.
                          const beforeProofActions = async () => {
                            await increaseTime(redemptionTimeout)
                            await bridge.notifyRedemptionTimeout(
                              data.wallet.pubKeyHash,
                              [],
                              data.redemptionRequests[0].redeemerOutputScript
                            )
                          }

                          outcome = runRedemptionScenario(
                            data,
                            beforeProofActions
                          )
                        })

                        after(async () => {
                          walletRegistry.seize.reset()

                          await restoreSnapshot()
                        })

                        it("should revert", async () => {
                          await expect(outcome).to.be.revertedWith(
                            "Output value is not within the acceptable range of the timed out request"
                          )
                        })
                      }
                    )

                    context(
                      "when the single output is a legal P2PKH change with a non-zero value",
                      () => {
                        const data: RedemptionTestData = SingleP2PKHChange

                        let outcome: Promise<RedemptionScenarioOutcome>

                        before(async () => {
                          await createSnapshot()

                          outcome = runRedemptionScenario(data)
                        })

                        after(async () => {
                          await restoreSnapshot()
                        })

                        // Should be deemed as valid change though rejected
                        // because this change is a single output and at least
                        // one requested redemption is expected.
                        it("should revert", async () => {
                          await expect(outcome).to.be.revertedWith(
                            "Redemption transaction must process at least one redemption"
                          )
                        })
                      }
                    )

                    context(
                      "when the single output is a legal P2WPKH change with a non-zero value",
                      () => {
                        const data: RedemptionTestData = SingleP2WPKHChange

                        let outcome: Promise<RedemptionScenarioOutcome>

                        before(async () => {
                          await createSnapshot()

                          outcome = runRedemptionScenario(data)
                        })

                        after(async () => {
                          await restoreSnapshot()
                        })

                        // Should be deemed as valid change though rejected
                        // because this change is a single output and at least
                        // one requested redemption is expected.
                        it("should revert", async () => {
                          await expect(outcome).to.be.revertedWith(
                            "Redemption transaction must process at least one redemption"
                          )
                        })
                      }
                    )

                    context(
                      "when the single output is an illegal P2SH change with a non-zero value",
                      () => {
                        const data: RedemptionTestData = SingleP2SHChange

                        let outcome: Promise<RedemptionScenarioOutcome>

                        before(async () => {
                          await createSnapshot()

                          outcome = runRedemptionScenario(data)
                        })

                        after(async () => {
                          await restoreSnapshot()
                        })

                        // We have this case because P2SH script has a 20-byte
                        // payload which may match the 20-byte wallet public
                        // key hash though it should be always rejected as
                        // non-requested output. There is no need to check for
                        // P2WSH since the payload is always 32-byte there.
                        // The main reason we need to bother about 20-byte
                        // hashes is because the wallet public key hash has
                        // always 20-bytes and we must make sure no redemption
                        // request uses it as a redeemer script to not confuse
                        // an output that will try to handle that request with
                        // a proper change output also referencing the wallet
                        // public key hash.
                        it("should revert", async () => {
                          await expect(outcome).to.be.revertedWith(
                            "Output is a non-requested redemption"
                          )
                        })
                      }
                    )

                    context(
                      "when the single output is a change with a zero as value",
                      () => {
                        const data: RedemptionTestData =
                          SingleP2WPKHChangeZeroValue

                        let outcome: Promise<RedemptionScenarioOutcome>

                        before(async () => {
                          await createSnapshot()

                          outcome = runRedemptionScenario(data)
                        })

                        after(async () => {
                          await restoreSnapshot()
                        })

                        it("should revert", async () => {
                          await expect(outcome).to.be.revertedWith(
                            "Output is a non-requested redemption"
                          )
                        })
                      }
                    )

                    context(
                      "when the single output is a non-requested redemption to an arbitrary script",
                      () => {
                        const data: RedemptionTestData =
                          SingleNonRequestedRedemption

                        let outcome: Promise<RedemptionScenarioOutcome>

                        before(async () => {
                          await createSnapshot()

                          outcome = runRedemptionScenario(data)
                        })

                        after(async () => {
                          await restoreSnapshot()
                        })

                        it("should revert", async () => {
                          await expect(outcome).to.be.revertedWith(
                            "Output is a non-requested redemption"
                          )
                        })
                      }
                    )

                    context(
                      "when the single output is provably unspendable OP_RETURN",
                      () => {
                        const data: RedemptionTestData =
                          SingleProvablyUnspendable

                        let outcome: Promise<RedemptionScenarioOutcome>

                        before(async () => {
                          await createSnapshot()

                          outcome = runRedemptionScenario(data)
                        })

                        after(async () => {
                          await restoreSnapshot()
                        })

                        it("should revert", async () => {
                          await expect(outcome).to.be.revertedWith(
                            "Output is a non-requested redemption"
                          )
                        })
                      }
                    )
                  })

                  context("when there are multiple outputs", () => {
                    context(
                      "when output vector consists only of pending requested redemptions",
                      () => {
                        const data: RedemptionTestData =
                          MultiplePendingRequestedRedemptions

                        let tx: ContractTransaction
                        let bridgeBalance: RedemptionBalanceChange
                        let walletPendingRedemptionsValue: RedemptionBalanceChange
                        let treasuryBalance: RedemptionBalanceChange
                        let redeemersBalances: RedemptionBalanceChange[]

                        before(async () => {
                          await createSnapshot()

                          // Simulate the situation when treasury fee is 0% to
                          // allow using the whole wallet's main UTXO value
                          // to fulfill the redemption requests.
                          await bridge.setRedemptionTreasuryFeeDivisor(0)

                          // eslint-disable-next-line @typescript-eslint/no-extra-semi
                          ;({
                            tx,
                            bridgeBalance,
                            walletPendingRedemptionsValue,
                            treasuryBalance,
                            redeemersBalances,
                          } = await runRedemptionScenario(data))
                        })

                        after(async () => {
                          await restoreSnapshot()
                        })

                        it("should close processed redemption requests", async () => {
                          for (
                            let i = 0;
                            i < data.redemptionRequests.length;
                            i++
                          ) {
                            const redemptionRequest =
                              // eslint-disable-next-line no-await-in-loop
                              await bridge.pendingRedemptions(
                                buildRedemptionKey(
                                  data.wallet.pubKeyHash,
                                  data.redemptionRequests[i]
                                    .redeemerOutputScript
                                )
                              )

                            expect(redemptionRequest.requestedAt).to.be.equal(
                              0,
                              `Redemption request with index ${i} has not been closed`
                            )
                          }
                        })

                        it("should delete the wallet's main UTXO", async () => {
                          // The Bitcoin redemption transaction has no change
                          // output so the wallet's main UTXO should be
                          // deleted on the Bridge side.
                          expect(
                            (await bridge.wallets(data.wallet.pubKeyHash))
                              .mainUtxoHash
                          ).to.be.equal(ethers.constants.HashZero)
                        })

                        it("should mark the previous main UTXO as spent", async () => {
                          const mainUtxoKey = ethers.utils.solidityKeccak256(
                            ["bytes32", "uint32"],
                            [data.mainUtxo.txHash, data.mainUtxo.txOutputIndex]
                          )

                          expect(await bridge.spentMainUTXOs(mainUtxoKey)).to.be
                            .true
                        })

                        it("should decrease the wallet's pending redemptions value", async () => {
                          // Wallet pending redemptions value should be
                          // decreased by the total redeemable amount but since
                          // the treasury fee is 0% in this test case, the
                          // total redeemable amount is equal to the total
                          // requested amount. See docs of the used test
                          // data for details.
                          expect(
                            walletPendingRedemptionsValue.afterProof.sub(
                              walletPendingRedemptionsValue.beforeProof
                            )
                          ).to.equal(-959845)
                        })

                        it("should decrease Bridge's balance in Bank", async () => {
                          // Balance should be decreased by the total
                          // redeemable amount but since the treasury fee
                          // is 0% in this test case, the total redeemable
                          // amount is equal to the total requested amount.
                          // See docs of the used test data for details.
                          await expect(tx)
                            .to.emit(bank, "BalanceDecreased")
                            .withArgs(bridge.address, 959845)
                          // In this case, the total Bridge balance change
                          // should be also equal to the same amount.
                          expect(
                            bridgeBalance.afterProof.sub(
                              bridgeBalance.beforeProof
                            )
                          ).to.equal(-959845)
                        })

                        it("should not transfer anything to the treasury", async () => {
                          // Treasury balance should not be increased because
                          // the treasury fee is 0% in this test case.
                          expect(
                            treasuryBalance.afterProof.sub(
                              treasuryBalance.beforeProof
                            )
                          ).to.equal(0)
                        })

                        it("should not change redeemers balances in any way", async () => {
                          // Redemption proof submission should NEVER cause
                          // any change of the redeemers balances.
                          for (
                            let i = 0;
                            i < data.redemptionRequests.length;
                            i++
                          ) {
                            const redeemerBalance = redeemersBalances[i]

                            expect(
                              redeemerBalance.afterProof.sub(
                                redeemerBalance.beforeProof
                              )
                            ).to.be.equal(
                              0,
                              `Balance of redeemer with index ${i} has changed`
                            )
                          }
                        })
                      }
                    )

                    context(
                      "when output vector consists of pending requested redemptions and a non-zero change",
                      () => {
                        const data: RedemptionTestData =
                          MultiplePendingRequestedRedemptionsWithP2WPKHChange

                        let tx: ContractTransaction
                        let bridgeBalance: RedemptionBalanceChange
                        let walletPendingRedemptionsValue: RedemptionBalanceChange
                        let treasuryBalance: RedemptionBalanceChange
                        let redeemersBalances: RedemptionBalanceChange[]

                        before(async () => {
                          await createSnapshot()

                          // eslint-disable-next-line @typescript-eslint/no-extra-semi
                          ;({
                            tx,
                            bridgeBalance,
                            walletPendingRedemptionsValue,
                            treasuryBalance,
                            redeemersBalances,
                          } = await runRedemptionScenario(data))
                        })

                        after(async () => {
                          await restoreSnapshot()
                        })

                        it("should close processed redemption requests", async () => {
                          for (
                            let i = 0;
                            i < data.redemptionRequests.length;
                            i++
                          ) {
                            const redemptionRequest =
                              // eslint-disable-next-line no-await-in-loop
                              await bridge.pendingRedemptions(
                                buildRedemptionKey(
                                  data.wallet.pubKeyHash,
                                  data.redemptionRequests[i]
                                    .redeemerOutputScript
                                )
                              )

                            expect(redemptionRequest.requestedAt).to.be.equal(
                              0,
                              `Redemption request with index ${i} has not been closed`
                            )
                          }
                        })

                        it("should update the wallet's main UTXO", async () => {
                          // Change index and value can be taken by exploring
                          // the redemption transaction structure and getting
                          // the output pointing back to wallet PKH.
                          const expectedMainUtxoHash = buildMainUtxoHash(
                            data.redemptionTx.hash,
                            5,
                            137130866
                          )

                          expect(
                            (await bridge.wallets(data.wallet.pubKeyHash))
                              .mainUtxoHash
                          ).to.be.equal(expectedMainUtxoHash)
                        })

                        it("should mark the previous main UTXO as spent", async () => {
                          const mainUtxoKey = ethers.utils.solidityKeccak256(
                            ["bytes32", "uint32"],
                            [data.mainUtxo.txHash, data.mainUtxo.txOutputIndex]
                          )

                          expect(await bridge.spentMainUTXOs(mainUtxoKey)).to.be
                            .true
                        })

                        it("should decrease the wallet's pending redemptions value", async () => {
                          // Wallet pending redemptions value should be
                          // decreased by the total redeemable amount. See docs
                          // of the used test data for details.
                          expect(
                            walletPendingRedemptionsValue.afterProof.sub(
                              walletPendingRedemptionsValue.beforeProof
                            )
                          ).to.equal(-6432350)
                        })

                        it("should decrease Bridge's balance in Bank", async () => {
                          // Balance should be decreased by the total
                          // redeemable amount. See docs of the used test
                          // data for details.
                          await expect(tx)
                            .to.emit(bank, "BalanceDecreased")
                            .withArgs(bridge.address, 6432350)
                          // However, the total balance change of the
                          // Bridge should also consider the treasury
                          // fee collected upon requests and transferred
                          // to the treasury at the end of the proof.
                          // This is why the total Bridge's balance change
                          // is equal to the total requested amount for
                          // all requests. See docs of the used test data
                          // for details.
                          expect(
                            bridgeBalance.afterProof.sub(
                              bridgeBalance.beforeProof
                            )
                          ).to.equal(-6435567)
                        })

                        it("should transfer collected treasury fee", async () => {
                          // Treasury balance should be increased by the total
                          // treasury fee for all requests. See docs of the
                          // used test data for details.
                          expect(
                            treasuryBalance.afterProof.sub(
                              treasuryBalance.beforeProof
                            )
                          ).to.equal(3217)
                        })

                        it("should not change redeemers balances in any way", async () => {
                          // Redemption proof submission should NEVER cause
                          // any change of the redeemers balances.
                          for (
                            let i = 0;
                            i < data.redemptionRequests.length;
                            i++
                          ) {
                            const redeemerBalance = redeemersBalances[i]

                            expect(
                              redeemerBalance.afterProof.sub(
                                redeemerBalance.beforeProof
                              )
                            ).to.be.equal(
                              0,
                              `Balance of redeemer with index ${i} has changed`
                            )
                          }
                        })
                      }
                    )

                    context(
                      "when output vector consists only of reported timed out requested redemptions",
                      () => {
                        const data: RedemptionTestData =
                          MultiplePendingRequestedRedemptions

                        let tx: ContractTransaction
                        let bridgeBalance: RedemptionBalanceChange
                        let walletPendingRedemptionsValue: RedemptionBalanceChange
                        let treasuryBalance: RedemptionBalanceChange
                        let redeemersBalances: RedemptionBalanceChange[]

                        before(async () => {
                          await createSnapshot()

                          // Simulate the situation when treasury fee is 0% to
                          // allow using the whole wallet's main UTXO value
                          // to fulfill the redemption requests.
                          await bridge.setRedemptionTreasuryFeeDivisor(0)

                          // Before submitting the redemption proof, wait
                          // an amount of time that will make the requests
                          // timed out and then report the timeouts.
                          const beforeProofActions = async () => {
                            await increaseTime(redemptionTimeout)

                            for (
                              let i = 0;
                              i < data.redemptionRequests.length;
                              i++
                            ) {
                              // eslint-disable-next-line no-await-in-loop
                              await bridge.notifyRedemptionTimeout(
                                data.wallet.pubKeyHash,
                                [],
                                data.redemptionRequests[i].redeemerOutputScript
                              )
                            }
                          }

                          // eslint-disable-next-line @typescript-eslint/no-extra-semi
                          ;({
                            tx,
                            bridgeBalance,
                            walletPendingRedemptionsValue,
                            treasuryBalance,
                            redeemersBalances,
                          } = await runRedemptionScenario(
                            data,
                            beforeProofActions
                          ))
                        })

                        after(async () => {
                          walletRegistry.seize.reset()

                          await restoreSnapshot()
                        })

                        it("should hold the timed out requests in the contract state", async () => {
                          for (
                            let i = 0;
                            i < data.redemptionRequests.length;
                            i++
                          ) {
                            const redemptionRequest =
                              // eslint-disable-next-line no-await-in-loop
                              await bridge.timedOutRedemptions(
                                buildRedemptionKey(
                                  data.wallet.pubKeyHash,
                                  data.redemptionRequests[i]
                                    .redeemerOutputScript
                                )
                              )

                            expect(
                              redemptionRequest.requestedAt
                            ).to.be.greaterThan(
                              0,
                              `Timed out request with index ${i} was removed from the contract state`
                            )
                          }
                        })

                        it("should delete the wallet's main UTXO", async () => {
                          // The Bitcoin redemption transaction has no change
                          // output so the wallet's main UTXO should be
                          // deleted on the Bridge side. It doesn't matter
                          // that all redemptions handled by the transaction
                          // are reported as timed out.
                          expect(
                            (await bridge.wallets(data.wallet.pubKeyHash))
                              .mainUtxoHash
                          ).to.be.equal(ethers.constants.HashZero)
                        })

                        it("should mark the previous main UTXO as spent", async () => {
                          const mainUtxoKey = ethers.utils.solidityKeccak256(
                            ["bytes32", "uint32"],
                            [data.mainUtxo.txHash, data.mainUtxo.txOutputIndex]
                          )

                          expect(await bridge.spentMainUTXOs(mainUtxoKey)).to.be
                            .true
                        })

                        it("should not change the wallet's pending redemptions value", async () => {
                          // All the bookkeeping regarding the timed out
                          // requests was done upon timeout reports. The
                          // wallet pending redemptions value should not
                          // be changed in any way.
                          expect(
                            walletPendingRedemptionsValue.afterProof.sub(
                              walletPendingRedemptionsValue.beforeProof
                            )
                          ).to.equal(0)
                        })

                        it("should not change Bridge's balance in Bank", async () => {
                          // All the bookkeeping regarding the timed out
                          // requests was done upon timeout reports. The Bridge
                          // balance in the bank should neither be decreased...
                          await expect(tx)
                            .to.emit(bank, "BalanceDecreased")
                            .withArgs(bridge.address, 0)
                          // ...nor changed in any other way.
                          expect(
                            bridgeBalance.afterProof.sub(
                              bridgeBalance.beforeProof
                            )
                          ).to.equal(0)
                        })

                        it("should not transfer anything to the treasury", async () => {
                          // Treasury balance should not be increased in any way
                          // since all requests handled by the redemption
                          // transaction are reported as timed out and are just
                          // skipped during processing.
                          expect(
                            treasuryBalance.afterProof.sub(
                              treasuryBalance.beforeProof
                            )
                          ).to.equal(0)
                        })

                        it("should not change redeemers balances in any way", async () => {
                          // Redemption proof submission should NEVER cause
                          // any change of the redeemers balances.
                          for (
                            let i = 0;
                            i < data.redemptionRequests.length;
                            i++
                          ) {
                            const redeemerBalance = redeemersBalances[i]

                            expect(
                              redeemerBalance.afterProof.sub(
                                redeemerBalance.beforeProof
                              )
                            ).to.be.equal(
                              0,
                              `Balance of redeemer with index ${i} has changed`
                            )
                          }
                        })
                      }
                    )

                    context(
                      "when output vector consists of reported timed out requested redemptions and a non-zero change",
                      () => {
                        const data: RedemptionTestData =
                          MultiplePendingRequestedRedemptionsWithP2WPKHChange

                        let tx: ContractTransaction
                        let bridgeBalance: RedemptionBalanceChange
                        let walletPendingRedemptionsValue: RedemptionBalanceChange
                        let treasuryBalance: RedemptionBalanceChange
                        let redeemersBalances: RedemptionBalanceChange[]

                        before(async () => {
                          await createSnapshot()

                          // Before submitting the redemption proof, wait
                          // an amount of time that will make the requests
                          // timed out and then report the timeouts.
                          const beforeProofActions = async () => {
                            await increaseTime(redemptionTimeout)

                            for (
                              let i = 0;
                              i < data.redemptionRequests.length;
                              i++
                            ) {
                              // eslint-disable-next-line no-await-in-loop
                              await bridge.notifyRedemptionTimeout(
                                data.wallet.pubKeyHash,
                                [],
                                data.redemptionRequests[i].redeemerOutputScript
                              )
                            }
                          }

                          // eslint-disable-next-line @typescript-eslint/no-extra-semi
                          ;({
                            tx,
                            bridgeBalance,
                            walletPendingRedemptionsValue,
                            treasuryBalance,
                            redeemersBalances,
                          } = await runRedemptionScenario(
                            data,
                            beforeProofActions
                          ))
                        })

                        after(async () => {
                          walletRegistry.seize.reset()

                          await restoreSnapshot()
                        })

                        it("should hold the timed out requests in the contract state", async () => {
                          for (
                            let i = 0;
                            i < data.redemptionRequests.length;
                            i++
                          ) {
                            const redemptionRequest =
                              // eslint-disable-next-line no-await-in-loop
                              await bridge.timedOutRedemptions(
                                buildRedemptionKey(
                                  data.wallet.pubKeyHash,
                                  data.redemptionRequests[i]
                                    .redeemerOutputScript
                                )
                              )

                            expect(
                              redemptionRequest.requestedAt
                            ).to.be.greaterThan(
                              0,
                              `Timed out request with index ${i} was removed from the contract state`
                            )
                          }
                        })

                        it("should update the wallet's main UTXO", async () => {
                          // Change index and value can be taken by exploring
                          // the redemption transaction structure and getting
                          // the output pointing back to wallet PKH.
                          const expectedMainUtxoHash = buildMainUtxoHash(
                            data.redemptionTx.hash,
                            5,
                            137130866
                          )

                          expect(
                            (await bridge.wallets(data.wallet.pubKeyHash))
                              .mainUtxoHash
                          ).to.be.equal(expectedMainUtxoHash)
                        })

                        it("should mark the previous main UTXO as spent", async () => {
                          const mainUtxoKey = ethers.utils.solidityKeccak256(
                            ["bytes32", "uint32"],
                            [data.mainUtxo.txHash, data.mainUtxo.txOutputIndex]
                          )

                          expect(await bridge.spentMainUTXOs(mainUtxoKey)).to.be
                            .true
                        })

                        it("should not change the wallet's pending redemptions value", async () => {
                          // All the bookkeeping regarding the timed out
                          // requests was done upon timeout reports. The
                          // wallet pending redemptions value should not
                          // be changed in any way.
                          expect(
                            walletPendingRedemptionsValue.afterProof.sub(
                              walletPendingRedemptionsValue.beforeProof
                            )
                          ).to.equal(0)
                        })

                        it("should not change Bridge's balance in Bank", async () => {
                          // All the bookkeeping regarding the timed out
                          // requests was done upon timeout reports. The Bridge
                          // balance in the bank should neither be decreased...
                          await expect(tx)
                            .to.emit(bank, "BalanceDecreased")
                            .withArgs(bridge.address, 0)
                          // ...nor changed in any other way.
                          expect(
                            bridgeBalance.afterProof.sub(
                              bridgeBalance.beforeProof
                            )
                          ).to.equal(0)
                        })

                        it("should not transfer anything to the treasury", async () => {
                          // Treasury balance should not be increased in any way
                          // since all requests handled by the redemption
                          // transaction are reported as timed out and are just
                          // skipped during processing.
                          expect(
                            treasuryBalance.afterProof.sub(
                              treasuryBalance.beforeProof
                            )
                          ).to.equal(0)
                        })

                        it("should not change redeemers balances in any way", async () => {
                          // Redemption proof submission should NEVER cause
                          // any change of the redeemers balances.
                          for (
                            let i = 0;
                            i < data.redemptionRequests.length;
                            i++
                          ) {
                            const redeemerBalance = redeemersBalances[i]

                            expect(
                              redeemerBalance.afterProof.sub(
                                redeemerBalance.beforeProof
                              )
                            ).to.be.equal(
                              0,
                              `Balance of redeemer with index ${i} has changed`
                            )
                          }
                        })
                      }
                    )

                    context(
                      "when output vector consists of pending requested redemptions and reported timed out requested redemptions",
                      () => {
                        const data: RedemptionTestData =
                          MultiplePendingRequestedRedemptions

                        let tx: ContractTransaction
                        let bridgeBalance: RedemptionBalanceChange
                        let walletPendingRedemptionsValue: RedemptionBalanceChange
                        let treasuryBalance: RedemptionBalanceChange
                        let redeemersBalances: RedemptionBalanceChange[]

                        before(async () => {
                          await createSnapshot()

                          // Simulate the situation when treasury fee is 0% to
                          // allow using the whole wallet's main UTXO value
                          // to fulfill the redemption requests.
                          await bridge.setRedemptionTreasuryFeeDivisor(0)

                          // Before submitting the redemption proof, wait
                          // an amount of time that will make the requests
                          // timed out but report timeout only the two first
                          // requests.
                          const beforeProofActions = async () => {
                            await increaseTime(redemptionTimeout)

                            await bridge.notifyRedemptionTimeout(
                              data.wallet.pubKeyHash,
                              [],
                              data.redemptionRequests[0].redeemerOutputScript
                            )
                            await bridge.notifyRedemptionTimeout(
                              data.wallet.pubKeyHash,
                              [],
                              data.redemptionRequests[1].redeemerOutputScript
                            )
                          }

                          // eslint-disable-next-line @typescript-eslint/no-extra-semi
                          ;({
                            tx,
                            bridgeBalance,
                            walletPendingRedemptionsValue,
                            treasuryBalance,
                            redeemersBalances,
                          } = await runRedemptionScenario(
                            data,
                            beforeProofActions
                          ))
                        })

                        after(async () => {
                          walletRegistry.seize.reset()

                          await restoreSnapshot()
                        })

                        it("should hold the timed out requests in the contract state", async () => {
                          // Check the two first requests reported as timed out
                          // are actually held in the contract state after
                          // proof submission.
                          for (let i = 0; i < 2; i++) {
                            const redemptionRequest =
                              // eslint-disable-next-line no-await-in-loop
                              await bridge.timedOutRedemptions(
                                buildRedemptionKey(
                                  data.wallet.pubKeyHash,
                                  data.redemptionRequests[i]
                                    .redeemerOutputScript
                                )
                              )

                            expect(
                              redemptionRequest.requestedAt
                            ).to.be.greaterThan(
                              0,
                              `Timed out request with index ${i} was removed from the contract state`
                            )
                          }
                        })

                        it("should close processed redemption requests", async () => {
                          // Check the remaining requests not reported as
                          // timed out were actually closed after proof
                          // submission.
                          for (
                            let i = 2;
                            i < data.redemptionRequests.length;
                            i++
                          ) {
                            const redemptionRequest =
                              // eslint-disable-next-line no-await-in-loop
                              await bridge.pendingRedemptions(
                                buildRedemptionKey(
                                  data.wallet.pubKeyHash,
                                  data.redemptionRequests[i]
                                    .redeemerOutputScript
                                )
                              )

                            expect(redemptionRequest.requestedAt).to.be.equal(
                              0,
                              `Redemption request with index ${i} has not been closed`
                            )
                          }
                        })

                        it("should delete the wallet's main UTXO", async () => {
                          // The Bitcoin redemption transaction has no change
                          // output so the wallet's main UTXO should be
                          // deleted on the Bridge side.
                          expect(
                            (await bridge.wallets(data.wallet.pubKeyHash))
                              .mainUtxoHash
                          ).to.be.equal(ethers.constants.HashZero)
                        })

                        it("should mark the previous main UTXO as spent", async () => {
                          const mainUtxoKey = ethers.utils.solidityKeccak256(
                            ["bytes32", "uint32"],
                            [data.mainUtxo.txHash, data.mainUtxo.txOutputIndex]
                          )

                          expect(await bridge.spentMainUTXOs(mainUtxoKey)).to.be
                            .true
                        })

                        it("should decrease the wallet's pending redemptions value", async () => {
                          // Wallet pending redemptions value should be
                          // decreased by the total redeemable amount but since
                          // the treasury fee is 0% in this test case, the
                          // total redeemable amount is equal to the total
                          // requested amount. However, only pending
                          // requests are taken into account and all reported
                          // timeouts should be ignored because the appropriate
                          // bookkeeping was already made upon timeout reports.
                          // See docs of the used test data for details.
                          expect(
                            walletPendingRedemptionsValue.afterProof.sub(
                              walletPendingRedemptionsValue.beforeProof
                            )
                          ).to.equal(-575907)
                        })

                        it("should decrease Bridge's balance in Bank", async () => {
                          // Balance should be decreased by the total
                          // redeemable amount but since the treasury fee
                          // is 0% in this test case, the total redeemable
                          // amount is equal to the total requested amount.
                          // However, only pending requests are taken into
                          // account and all reported timeouts should be
                          // ignored because the appropriate bookkeeping was
                          // already made upon timeout reports. See docs of the
                          // used test data for details.
                          await expect(tx)
                            .to.emit(bank, "BalanceDecreased")
                            .withArgs(bridge.address, 575907)
                          // In this case, the total Bridge balance change
                          // should be also equal to the same amount.
                          expect(
                            bridgeBalance.afterProof.sub(
                              bridgeBalance.beforeProof
                            )
                          ).to.equal(-575907)
                        })

                        it("should not transfer anything to the treasury", async () => {
                          // Treasury balance should not be increased because
                          // the treasury fee is 0% in this test case.
                          expect(
                            treasuryBalance.afterProof.sub(
                              treasuryBalance.beforeProof
                            )
                          ).to.equal(0)
                        })

                        it("should not change redeemers balances in any way", async () => {
                          // Redemption proof submission should NEVER cause
                          // any change of the redeemers balances.
                          for (
                            let i = 0;
                            i < data.redemptionRequests.length;
                            i++
                          ) {
                            const redeemerBalance = redeemersBalances[i]

                            expect(
                              redeemerBalance.afterProof.sub(
                                redeemerBalance.beforeProof
                              )
                            ).to.be.equal(
                              0,
                              `Balance of redeemer with index ${i} has changed`
                            )
                          }
                        })
                      }
                    )

                    context(
                      "when output vector consists of pending requested redemptions, reported timed out requested redemptions and a non-zero change",
                      () => {
                        const data: RedemptionTestData =
                          MultiplePendingRequestedRedemptionsWithP2WPKHChange

                        let tx: ContractTransaction
                        let bridgeBalance: RedemptionBalanceChange
                        let walletPendingRedemptionsValue: RedemptionBalanceChange
                        let treasuryBalance: RedemptionBalanceChange
                        let redeemersBalances: RedemptionBalanceChange[]

                        before(async () => {
                          await createSnapshot()

                          // Before submitting the redemption proof, wait
                          // an amount of time that will make the requests
                          // timed out but report timeout only the two first
                          // requests.
                          const beforeProofActions = async () => {
                            await increaseTime(redemptionTimeout)

                            await bridge.notifyRedemptionTimeout(
                              data.wallet.pubKeyHash,
                              [],
                              data.redemptionRequests[0].redeemerOutputScript
                            )
                            await bridge.notifyRedemptionTimeout(
                              data.wallet.pubKeyHash,
                              [],
                              data.redemptionRequests[1].redeemerOutputScript
                            )
                          }

                          // eslint-disable-next-line @typescript-eslint/no-extra-semi
                          ;({
                            tx,
                            bridgeBalance,
                            walletPendingRedemptionsValue,
                            treasuryBalance,
                            redeemersBalances,
                          } = await runRedemptionScenario(
                            data,
                            beforeProofActions
                          ))
                        })

                        after(async () => {
                          walletRegistry.seize.reset()

                          await restoreSnapshot()
                        })

                        it("should hold the timed out requests in the contract state", async () => {
                          // Check the two first requests reported as timed out
                          // are actually held in the contract state after
                          // proof submission.
                          for (let i = 0; i < 2; i++) {
                            const redemptionRequest =
                              // eslint-disable-next-line no-await-in-loop
                              await bridge.timedOutRedemptions(
                                buildRedemptionKey(
                                  data.wallet.pubKeyHash,
                                  data.redemptionRequests[i]
                                    .redeemerOutputScript
                                )
                              )

                            expect(
                              redemptionRequest.requestedAt
                            ).to.be.greaterThan(
                              0,
                              `Timed out request with index ${i} was removed from the contract state`
                            )
                          }
                        })

                        it("should close processed redemption requests", async () => {
                          // Check the remaining requests not reported as
                          // timed out were actually closed after proof
                          // submission.
                          for (
                            let i = 2;
                            i < data.redemptionRequests.length;
                            i++
                          ) {
                            const redemptionRequest =
                              // eslint-disable-next-line no-await-in-loop
                              await bridge.pendingRedemptions(
                                buildRedemptionKey(
                                  data.wallet.pubKeyHash,
                                  data.redemptionRequests[i]
                                    .redeemerOutputScript
                                )
                              )

                            expect(redemptionRequest.requestedAt).to.be.equal(
                              0,
                              `Redemption request with index ${i} has not been closed`
                            )
                          }
                        })

                        it("should update the wallet's main UTXO", async () => {
                          // Change index and value can be taken by exploring
                          // the redemption transaction structure and getting
                          // the output pointing back to wallet PKH.
                          const expectedMainUtxoHash = buildMainUtxoHash(
                            data.redemptionTx.hash,
                            5,
                            137130866
                          )

                          expect(
                            (await bridge.wallets(data.wallet.pubKeyHash))
                              .mainUtxoHash
                          ).to.be.equal(expectedMainUtxoHash)
                        })

                        it("should mark the previous main UTXO as spent", async () => {
                          const mainUtxoKey = ethers.utils.solidityKeccak256(
                            ["bytes32", "uint32"],
                            [data.mainUtxo.txHash, data.mainUtxo.txOutputIndex]
                          )

                          expect(await bridge.spentMainUTXOs(mainUtxoKey)).to.be
                            .true
                        })

                        it("should decrease the wallet's pending redemptions value", async () => {
                          // Wallet pending redemptions value should be
                          // decreased by the total redeemable amount. However,
                          // only pending requests are taken into account and
                          // all reported timeouts should be ignored because
                          // the appropriate bookkeeping was already made upon
                          // timeout reports. See docs of the used test data
                          // for details.
                          expect(
                            walletPendingRedemptionsValue.afterProof.sub(
                              walletPendingRedemptionsValue.beforeProof
                            )
                          ).to.equal(-4433350)
                        })

                        it("should decrease Bridge's balance in Bank", async () => {
                          // Balance should be decreased by the total
                          // redeemable amount. However, only pending requests
                          // are taken into account and all reported timeouts
                          // should be ignored because the appropriate
                          // bookkeeping was already made upon timeout reports.
                          // See docs of the used test data for details.
                          await expect(tx)
                            .to.emit(bank, "BalanceDecreased")
                            .withArgs(bridge.address, 4433350)
                          // However, the total balance change of the
                          // Bridge should also consider the treasury
                          // fee collected upon requests and transferred
                          // to the treasury at the end of the proof.
                          // This is why the total Bridge's balance change
                          // is equal to the total requested amount for
                          // all requests (without taking the reported timed
                          // out ones into account). See docs of the used test
                          // data for details.
                          expect(
                            bridgeBalance.afterProof.sub(
                              bridgeBalance.beforeProof
                            )
                          ).to.equal(-4435567)
                        })

                        it("should transfer collected treasury fee", async () => {
                          // Treasury balance should be increased by the total
                          // treasury fee for all requests. However, only
                          // pending requests are taken into account and all
                          // reported timeouts should be ignored because the
                          // appropriate bookkeeping was already made upon
                          // timeout reports. See docs of the used test data
                          // for details.
                          expect(
                            treasuryBalance.afterProof.sub(
                              treasuryBalance.beforeProof
                            )
                          ).to.equal(2217)
                        })

                        it("should not change redeemers balances in any way", async () => {
                          // Redemption proof submission should NEVER cause
                          // any change of the redeemers balances.
                          for (
                            let i = 0;
                            i < data.redemptionRequests.length;
                            i++
                          ) {
                            const redeemerBalance = redeemersBalances[i]

                            expect(
                              redeemerBalance.afterProof.sub(
                                redeemerBalance.beforeProof
                              )
                            ).to.be.equal(
                              0,
                              `Balance of redeemer with index ${i} has changed`
                            )
                          }
                        })
                      }
                    )

                    context(
                      "when output vector contains a pending requested redemption with wrong amount redeemed",
                      () => {
                        const data: RedemptionTestData = JSON.parse(
                          JSON.stringify(MultiplePendingRequestedRedemptions)
                        )

                        let outcome: Promise<RedemptionScenarioOutcome>

                        before(async () => {
                          await createSnapshot()

                          // Alter the last redemption requests in the test
                          // data and set such an amount that will cause
                          // the Bitcoin redemption transaction to be deemed
                          // as invalid due to a wrong amount. The corresponding
                          // transaction output has the value of 191169 so to
                          // make this test scenario happen, the request amount
                          // must be way different (lesser or greater) than the
                          // output value. Worth noting that this test scenario
                          // tests the amount condition in a general and simplified
                          // way without stressing all specific edge cases.
                          // Doing a detailed check would require more dedicated
                          // test data sets which would make it far more
                          // complicated without giving much value in return.
                          data.redemptionRequests[4].amount = 100000

                          outcome = runRedemptionScenario(data)
                        })

                        after(async () => {
                          await restoreSnapshot()
                        })

                        it("should revert", async () => {
                          await expect(outcome).to.be.revertedWith(
                            "Output value is not within the acceptable range of the pending request"
                          )
                        })
                      }
                    )

                    context(
                      "when output vector contains a reported timed out requested redemption with wrong amount redeemed",
                      () => {
                        const data: RedemptionTestData = JSON.parse(
                          JSON.stringify(MultiplePendingRequestedRedemptions)
                        )

                        let outcome: Promise<RedemptionScenarioOutcome>

                        before(async () => {
                          await createSnapshot()

                          // Alter the last redemption requests in the test
                          // data and set such an amount that will cause
                          // the Bitcoin redemption transaction to be deemed
                          // as invalid due to a wrong amount. The corresponding
                          // transaction output has the value of 191169 so to
                          // make this test scenario happen, the request amount
                          // must be way different (lesser or greater) than the
                          // output value. Worth noting that this test scenario
                          // tests the amount condition in a general and simplified
                          // way without stressing all specific edge cases.
                          // Doing a detailed check would require more dedicated
                          // test data sets which would make it far more
                          // complicated without giving much value in return.
                          data.redemptionRequests[4].amount = 100000

                          // Before submitting the redemption proof, wait
                          // an amount of time that will make the last request
                          // timed out and then report the timeout.
                          const beforeProofActions = async () => {
                            await increaseTime(redemptionTimeout)
                            await bridge.notifyRedemptionTimeout(
                              data.wallet.pubKeyHash,
                              [],
                              data.redemptionRequests[4].redeemerOutputScript
                            )
                          }

                          outcome = runRedemptionScenario(
                            data,
                            beforeProofActions
                          )
                        })

                        after(async () => {
                          walletRegistry.seize.reset()

                          await restoreSnapshot()
                        })

                        it("should revert", async () => {
                          await expect(outcome).to.be.revertedWith(
                            "Output value is not within the acceptable range of the timed out request"
                          )
                        })
                      }
                    )

                    context(
                      "when output vector contains a non-zero P2SH change output",
                      () => {
                        const data: RedemptionTestData = JSON.parse(
                          JSON.stringify(
                            MultiplePendingRequestedRedemptionsWithP2SHChange
                          )
                        )

                        let outcome: Promise<RedemptionScenarioOutcome>

                        before(async () => {
                          await createSnapshot()

                          outcome = runRedemptionScenario(data)
                        })

                        after(async () => {
                          await restoreSnapshot()
                        })

                        // We have this case because P2SH script has a 20-byte
                        // payload which may match the 20-byte wallet public
                        // key hash though it should be always rejected as
                        // non-requested output. There is no need to check for
                        // P2WSH since the payload is always 32-byte there.
                        it("should revert", async () => {
                          await expect(outcome).to.be.revertedWith(
                            "Output is a non-requested redemption"
                          )
                        })
                      }
                    )

                    context(
                      "when output vector contains multiple non-zero change outputs",
                      () => {
                        const data: RedemptionTestData = JSON.parse(
                          JSON.stringify(
                            MultiplePendingRequestedRedemptionsWithMultipleP2WPKHChanges
                          )
                        )

                        let outcome: Promise<RedemptionScenarioOutcome>

                        before(async () => {
                          await createSnapshot()

                          outcome = runRedemptionScenario(data)
                        })

                        after(async () => {
                          await restoreSnapshot()
                        })

                        it("should revert", async () => {
                          await expect(outcome).to.be.revertedWith(
                            "Output is a non-requested redemption"
                          )
                        })
                      }
                    )

                    context(
                      "when output vector contains one change but with zero as value",
                      () => {
                        const data: RedemptionTestData = JSON.parse(
                          JSON.stringify(
                            MultiplePendingRequestedRedemptionsWithP2WPKHChangeZeroValue
                          )
                        )

                        let outcome: Promise<RedemptionScenarioOutcome>

                        before(async () => {
                          await createSnapshot()

                          outcome = runRedemptionScenario(data)
                        })

                        after(async () => {
                          await restoreSnapshot()
                        })

                        it("should revert", async () => {
                          await expect(outcome).to.be.revertedWith(
                            "Output is a non-requested redemption"
                          )
                        })
                      }
                    )

                    context(
                      "when output vector contains a non-requested redemption to an arbitrary script hash",
                      () => {
                        const data: RedemptionTestData = JSON.parse(
                          JSON.stringify(
                            MultiplePendingRequestedRedemptionsWithNonRequestedRedemption
                          )
                        )

                        let outcome: Promise<RedemptionScenarioOutcome>

                        before(async () => {
                          await createSnapshot()

                          outcome = runRedemptionScenario(data)
                        })

                        after(async () => {
                          await restoreSnapshot()
                        })

                        it("should revert", async () => {
                          await expect(outcome).to.be.revertedWith(
                            "Output is a non-requested redemption"
                          )
                        })
                      }
                    )

                    context(
                      "when output vector contains a provably unspendable OP_RETURN output",
                      () => {
                        const data: RedemptionTestData = JSON.parse(
                          JSON.stringify(
                            MultiplePendingRequestedRedemptionsWithProvablyUnspendable
                          )
                        )

                        let outcome: Promise<RedemptionScenarioOutcome>

                        before(async () => {
                          await createSnapshot()

                          outcome = runRedemptionScenario(data)
                        })

                        after(async () => {
                          await restoreSnapshot()
                        })

                        it("should revert", async () => {
                          await expect(outcome).to.be.revertedWith(
                            "Output is a non-requested redemption"
                          )
                        })
                      }
                    )
                  })
                })

                context("when wallet state is MovingFunds", () => {
                  const data: RedemptionTestData =
                    MultiplePendingRequestedRedemptionsWithP2WPKHChange

                  let outcome: Promise<RedemptionScenarioOutcome>

                  before(async () => {
                    await createSnapshot()

                    // Set wallet state to MovingFunds. That must be done
                    // just before proof submission since requests should
                    // be made against a Live wallet.
                    const beforeProofActions = async () => {
                      const wallet = await bridge.wallets(
                        data.wallet.pubKeyHash
                      )
                      await bridge.setWallet(data.wallet.pubKeyHash, {
                        ...wallet,
                        state: walletState.MovingFunds,
                      })
                    }

                    outcome = runRedemptionScenario(data, beforeProofActions)
                  })

                  after(async () => {
                    await restoreSnapshot()
                  })

                  // Just assert it passes without revert without repeating
                  // checks from Live state scenario.
                  it("should succeed", async () => {
                    await expect(outcome).to.not.be.reverted
                  })
                })

                context(
                  "when wallet state is neither Live nor MovingFunds",
                  () => {
                    const testData = [
                      {
                        testName: "when wallet state is Unknown",
                        walletState: walletState.Unknown,
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
                        const data: RedemptionTestData =
                          MultiplePendingRequestedRedemptionsWithP2WPKHChange

                        let outcome: Promise<RedemptionScenarioOutcome>

                        before(async () => {
                          await createSnapshot()

                          // Set wallet state to Unknown. That must be done
                          // just before proof submission since requests should
                          // be made against a Live wallet.
                          const beforeProofActions = async () => {
                            const wallet = await bridge.wallets(
                              data.wallet.pubKeyHash
                            )
                            await bridge.setWallet(data.wallet.pubKeyHash, {
                              ...wallet,
                              state: test.walletState,
                            })
                          }

                          outcome = runRedemptionScenario(
                            data,
                            beforeProofActions
                          )
                        })

                        after(async () => {
                          await restoreSnapshot()
                        })

                        it("should revert", async () => {
                          await expect(outcome).to.be.revertedWith(
                            "'Wallet must be in Live or MovingFunds state"
                          )
                        })
                      })
                    })
                  }
                )
              }
            )

            context(
              "when the single input doesn't point to the wallet's main UTXO",
              () => {
                const data: RedemptionTestData = JSON.parse(
                  JSON.stringify(
                    MultiplePendingRequestedRedemptionsWithP2WPKHChange
                  )
                )

                let outcome: Promise<RedemptionScenarioOutcome>

                before(async () => {
                  await createSnapshot()

                  // Corrupt the wallet's main UTXO that is injected to
                  // the Bridge state by the test runner in order to make it
                  // different than the input used by the actual Bitcoin
                  // transaction thus make the tested scenario happen. The
                  // proper value of `txOutputIndex` is `5` so any other value
                  // will do the trick.
                  data.mainUtxo.txOutputIndex = 10

                  outcome = runRedemptionScenario(data)
                })

                after(async () => {
                  await restoreSnapshot()
                })

                it("should revert", async () => {
                  await expect(outcome).to.be.revertedWith(
                    "Outbound transaction input must point to the wallet's main UTXO"
                  )
                })
              }
            )
          })

          context("when input count is other than one", () => {
            const data: RedemptionTestData =
              MultiplePendingRequestedRedemptionsWithMultipleInputs

            let outcome: Promise<RedemptionScenarioOutcome>

            before(async () => {
              await createSnapshot()

              outcome = runRedemptionScenario(data)
            })

            after(async () => {
              await restoreSnapshot()
            })

            it("should revert", async () => {
              await expect(outcome).to.be.revertedWith(
                "Outbound transaction must have a single input"
              )
            })
          })
        })

        context("when main UTXO data are invalid", () => {
          const data: RedemptionTestData =
            MultiplePendingRequestedRedemptionsWithP2WPKHChange

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
            await restoreSnapshot()
          })

          it("should revert", async () => {
            // Corrupt the main UTXO parameter passed during
            // `submitRedemptionProof` call. The proper value of
            // `txOutputIndex` for this test data set is `5` so any other
            // value will make this test scenario happen.
            const corruptedMainUtxo = {
              ...data.mainUtxo,
              txOutputIndex: 10,
            }

            await expect(
              bridge.submitRedemptionProof(
                data.redemptionTx,
                data.redemptionProof,
                corruptedMainUtxo,
                data.wallet.pubKeyHash
              )
            ).to.be.revertedWith("Invalid main UTXO data")
          })
        })
      })

      context("when there is no main UTXO for the given wallet", () => {
        const data: RedemptionTestData =
          MultiplePendingRequestedRedemptionsWithP2WPKHChange

        before(async () => {
          await createSnapshot()

          // Required for a successful SPV proof.
          relay.getPrevEpochDifficulty.returns(data.chainDifficulty)
          relay.getCurrentEpochDifficulty.returns(data.chainDifficulty)
        })

        after(async () => {
          await restoreSnapshot()
        })

        it("should revert", async () => {
          // There was no preparations before `submitRedemptionProof` call
          // so no main UTXO is set for the given wallet.
          await expect(
            bridge.submitRedemptionProof(
              data.redemptionTx,
              data.redemptionProof,
              data.mainUtxo,
              data.wallet.pubKeyHash
            )
          ).to.be.revertedWith("No main UTXO for given wallet")
        })
      })
    })

    context("when transaction proof is not valid", () => {
      context("when input vector is not valid", () => {
        const data: RedemptionTestData = JSON.parse(
          JSON.stringify(SinglePendingRequestedRedemption)
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
          data.redemptionTx.inputVector =
            "0x00b69a2869840aa6fdfd143136ff4514ca46ea2d876855040892ad74ab" +
            "8c5274220100000000ffffffff"

          await expect(runRedemptionScenario(data)).to.be.revertedWith(
            "Invalid input vector provided"
          )
        })
      })

      context("when output vector is not valid", () => {
        const data: RedemptionTestData = JSON.parse(
          JSON.stringify(SinglePendingRequestedRedemption)
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
          data.redemptionTx.outputVector =
            "0x005cf511000000000017a91486884e6be1525dab5ae0b451bd2c72cee6" +
            "7dcf4187"

          await expect(runRedemptionScenario(data)).to.be.revertedWith(
            "Invalid output vector provided"
          )
        })
      })

      context("when merkle proof is not valid", () => {
        const data: RedemptionTestData = JSON.parse(
          JSON.stringify(SinglePendingRequestedRedemption)
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
          data.redemptionProof.txIndexInBlock = 30

          await expect(runRedemptionScenario(data)).to.be.revertedWith(
            "Tx merkle proof is not valid for provided header and tx hash"
          )
        })
      })

      context("when proof difficulty is not current nor previous", () => {
        const data: RedemptionTestData = JSON.parse(
          JSON.stringify(SinglePendingRequestedRedemption)
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

          await expect(runRedemptionScenario(data)).to.be.revertedWith(
            "Not at current or previous difficulty"
          )
        })
      })

      context("when headers chain length is not valid", () => {
        const data: RedemptionTestData = JSON.parse(
          JSON.stringify(SinglePendingRequestedRedemption)
        )

        before(async () => {
          await createSnapshot()
        })

        after(async () => {
          await restoreSnapshot()
        })

        it("should revert", async () => {
          // Corrupt the bitcoin headers length in the redemption proof. The
          // proper value is length divisible by 80 so any length violating
          // this rule will cause failure. In this case, we just remove the
          // last byte from proper headers chain.
          const properHeaders = data.redemptionProof.bitcoinHeaders.toString()
          data.redemptionProof.bitcoinHeaders = properHeaders.substring(
            0,
            properHeaders.length - 2
          )

          await expect(runRedemptionScenario(data)).to.be.revertedWith(
            "Invalid length of the headers chain"
          )
        })
      })

      context("when headers chain is not valid", () => {
        const data: RedemptionTestData = JSON.parse(
          JSON.stringify(SinglePendingRequestedRedemption)
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
          const properHeaders = data.redemptionProof.bitcoinHeaders.toString()
          data.redemptionProof.bitcoinHeaders = `${properHeaders.substring(
            0,
            170
          )}ff${properHeaders.substring(172)}`

          await expect(runRedemptionScenario(data)).to.be.revertedWith(
            "Invalid headers chain"
          )
        })
      })

      context("when the work in the header is insufficient", () => {
        const data: RedemptionTestData = JSON.parse(
          JSON.stringify(SinglePendingRequestedRedemption)
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
          const properHeaders = data.redemptionProof.bitcoinHeaders.toString()
          data.redemptionProof.bitcoinHeaders = `${properHeaders.substring(
            0,
            properHeaders.length - 2
          )}ff`

          await expect(runRedemptionScenario(data)).to.be.revertedWith(
            "Insufficient work in a header"
          )
        })
      })

      context(
        "when accumulated difficulty in headers chain is insufficient",
        () => {
          let otherBridge: Bridge & BridgeStub
          const data: RedemptionTestData = JSON.parse(
            JSON.stringify(SinglePendingRequestedRedemption)
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
            await restoreSnapshot()
          })

          it("should revert", async () => {
            await expect(
              otherBridge.submitRedemptionProof(
                data.redemptionTx,
                data.redemptionProof,
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

  describe("notifyRedemptionTimeout", () => {
    context("when redemption request exists", () => {
      context("when the redemption request has timed out", () => {
        context("when the wallet is in Live state", () => {
          context("when the wallet is the active wallet", () => {
            const data: RedemptionTestData = SinglePendingRequestedRedemption
            let tx: ContractTransaction
            let initialPendingRedemptionsValue: BigNumber
            let initialRedeemerBalance: BigNumber
            let redemptionRequest: {
              redeemer: string
              requestedAmount: BigNumber
              treasuryFee: BigNumber
              txMaxFee: BigNumber
              requestedAt: number
            }

            const walletMembersIDs = [1, 2, 3, 4, 5]

            before(async () => {
              await createSnapshot()

              await bridge.setWallet(data.wallet.pubKeyHash, {
                ecdsaWalletID: data.wallet.ecdsaWalletID,
                mainUtxoHash: ethers.constants.HashZero,
                pendingRedemptionsValue: data.wallet.pendingRedemptionsValue,
                createdAt: await lastBlockTime(),
                movingFundsRequestedAt: 0,
                closingStartedAt: 0,
                pendingMovedFundsSweepRequestsCount: 0,
                state: walletState.Live,
                movingFundsTargetWalletsCommitmentHash:
                  ethers.constants.HashZero,
              })
              await bridge.setWalletMainUtxo(
                data.wallet.pubKeyHash,
                data.mainUtxo
              )
              await bridge.setActiveWallet(data.wallet.pubKeyHash)

              const redeemerSigner = await impersonateAccount(
                data.redemptionRequests[0].redeemer,
                {
                  from: governance,
                  value: null, // use default value
                }
              )

              await makeRedemptionAllowance(
                redeemerSigner,
                data.redemptionRequests[0].amount
              )

              await bridge
                .connect(redeemerSigner)
                .requestRedemption(
                  data.wallet.pubKeyHash,
                  data.mainUtxo,
                  data.redemptionRequests[0].redeemerOutputScript,
                  data.redemptionRequests[0].amount
                )

              await increaseTime(redemptionTimeout)

              initialPendingRedemptionsValue = (
                await bridge.wallets(data.wallet.pubKeyHash)
              ).pendingRedemptionsValue

              initialRedeemerBalance = await bank.balanceOf(
                data.redemptionRequests[0].redeemer
              )

              const redemptionKey = buildRedemptionKey(
                data.wallet.pubKeyHash,
                data.redemptionRequests[0].redeemerOutputScript
              )

              redemptionRequest = await bridge.pendingRedemptions(redemptionKey)

              tx = await bridge
                .connect(thirdParty)
                .notifyRedemptionTimeout(
                  data.wallet.pubKeyHash,
                  walletMembersIDs,
                  data.redemptionRequests[0].redeemerOutputScript
                )
            })

            after(async () => {
              walletRegistry.seize.reset()

              await restoreSnapshot()
            })

            it("should update the wallet's pending redemptions value", async () => {
              const expectedPendingRedemptionsValue =
                initialPendingRedemptionsValue
                  .sub(data.redemptionRequests[0].amount)
                  .add(redemptionRequest.treasuryFee)

              const currentPendingRedemptionsValue = (
                await bridge.wallets(data.wallet.pubKeyHash)
              ).pendingRedemptionsValue

              expect(currentPendingRedemptionsValue).to.be.equal(
                expectedPendingRedemptionsValue
              )
            })

            it("should return the requested amount of tokens to the redeemer", async () => {
              const expectedRedeemerBalance = initialRedeemerBalance.add(
                data.redemptionRequests[0].amount
              )
              const currentRedeemerBalance = await bank.balanceOf(
                data.redemptionRequests[0].redeemer
              )
              expect(currentRedeemerBalance).to.be.equal(
                expectedRedeemerBalance
              )
            })

            it("should remove the request from the pending redemptions", async () => {
              const redemptionKey = buildRedemptionKey(
                data.wallet.pubKeyHash,
                data.redemptionRequests[0].redeemerOutputScript
              )
              const request = await bridge.pendingRedemptions(redemptionKey)

              expect(request.requestedAt).to.be.equal(0)
            })

            it("should add the request to the timed-out redemptions", async () => {
              const timedOutRequest = await bridge.timedOutRedemptions(
                buildRedemptionKey(
                  data.wallet.pubKeyHash,
                  data.redemptionRequests[0].redeemerOutputScript
                )
              )

              expect(timedOutRequest.redeemer).to.be.equal(
                data.redemptionRequests[0].redeemer
              )
              expect(timedOutRequest.requestedAmount).to.be.equal(
                redemptionRequest.requestedAmount
              )
              expect(timedOutRequest.treasuryFee).to.be.equal(
                redemptionRequest.treasuryFee
              )
              expect(timedOutRequest.txMaxFee).to.be.equal(
                redemptionRequest.txMaxFee
              )
              expect(timedOutRequest.requestedAt).to.be.equal(
                redemptionRequest.requestedAt
              )
            })

            it("should change the wallet's state to MovingFunds", async () => {
              const wallet = await bridge.wallets(data.wallet.pubKeyHash)
              expect(wallet.state).to.be.equal(walletState.MovingFunds)
            })

            it("should set the wallet's move funds requested timestamp", async () => {
              const wallet = await bridge.wallets(data.wallet.pubKeyHash)
              expect(wallet.movingFundsRequestedAt).to.be.equal(
                await lastBlockTime()
              )
            })

            it("should emit WalletMovingFunds event", async () => {
              await expect(tx)
                .to.emit(bridge, "WalletMovingFunds")
                .withArgs(data.wallet.ecdsaWalletID, data.wallet.pubKeyHash)
            })

            it("should delete the active wallet public key hash", async () => {
              expect(await bridge.activeWalletPubKeyHash()).to.be.equal(
                "0x0000000000000000000000000000000000000000"
              )
            })

            it("should call the ECDSA wallet registry's seize function", async () => {
              expect(walletRegistry.seize).to.have.been.calledOnceWith(
                redemptionTimeoutSlashingAmount,
                redemptionTimeoutNotifierRewardMultiplier,
                await thirdParty.getAddress(),
                data.wallet.ecdsaWalletID,
                walletMembersIDs
              )
            })

            it("should emit RedemptionTimedOut event", async () => {
              await expect(tx)
                .to.emit(bridge, "RedemptionTimedOut")
                .withArgs(
                  data.wallet.pubKeyHash,
                  data.redemptionRequests[0].redeemerOutputScript
                )
            })

            it("should decrease the live wallets counter", async () => {
              expect(await bridge.liveWalletsCount()).to.be.equal(0)
            })
          })

          context("when the wallet is not the active wallet", () => {
            const data: RedemptionTestData = SinglePendingRequestedRedemption
            // Public key hash of a different wallet
            const anotherWalletPublicKeyHash =
              "0x123456789abcdef01234567891abcdef01234567"

            before(async () => {
              await createSnapshot()

              await bridge.setWallet(data.wallet.pubKeyHash, {
                ecdsaWalletID: data.wallet.ecdsaWalletID,
                mainUtxoHash: ethers.constants.HashZero,
                pendingRedemptionsValue: data.wallet.pendingRedemptionsValue,
                createdAt: await lastBlockTime(),
                movingFundsRequestedAt: 0,
                closingStartedAt: 0,
                pendingMovedFundsSweepRequestsCount: 0,
                state: walletState.Live,
                movingFundsTargetWalletsCommitmentHash:
                  ethers.constants.HashZero,
              })
              await bridge.setWalletMainUtxo(
                data.wallet.pubKeyHash,
                data.mainUtxo
              )
              await bridge.setActiveWallet(anotherWalletPublicKeyHash)

              const redeemerSigner = await impersonateAccount(
                data.redemptionRequests[0].redeemer,
                {
                  from: governance,
                  value: null, // use default value
                }
              )

              await makeRedemptionAllowance(
                redeemerSigner,
                data.redemptionRequests[0].amount
              )

              await bridge
                .connect(redeemerSigner)
                .requestRedemption(
                  data.wallet.pubKeyHash,
                  data.mainUtxo,
                  data.redemptionRequests[0].redeemerOutputScript,
                  data.redemptionRequests[0].amount
                )

              await increaseTime(redemptionTimeout)

              await bridge
                .connect(thirdParty)
                .notifyRedemptionTimeout(
                  data.wallet.pubKeyHash,
                  [],
                  data.redemptionRequests[0].redeemerOutputScript
                )
            })

            after(async () => {
              walletRegistry.seize.reset()

              await restoreSnapshot()
            })

            // Only verify the active wallet public key hash has not changed.
            // The other checks are covered in scenarios where the wallet was
            // the active wallet and they should not be repeated here.
            it("should not delete the active wallet public key hash", async () => {
              // Check that the active wallet has not changed
              expect(await bridge.activeWalletPubKeyHash()).to.be.equal(
                anotherWalletPublicKeyHash
              )
            })
          })
        })

        context("when the wallet is in MovingFunds state", () => {
          const data: RedemptionTestData = SinglePendingRequestedRedemption
          let tx: ContractTransaction
          let initialPendingRedemptionsValue: BigNumber
          let initialRedeemerBalance: BigNumber
          let redemptionRequest: {
            redeemer: string
            requestedAmount: BigNumber
            treasuryFee: BigNumber
            txMaxFee: BigNumber
            requestedAt: number
          }

          const walletMembersIDs = [1, 2, 3, 4, 5]

          before(async () => {
            await createSnapshot()

            await bridge.setWallet(data.wallet.pubKeyHash, {
              ecdsaWalletID: data.wallet.ecdsaWalletID,
              mainUtxoHash: ethers.constants.HashZero,
              pendingRedemptionsValue: data.wallet.pendingRedemptionsValue,
              createdAt: await lastBlockTime(),
              movingFundsRequestedAt: 0,
              closingStartedAt: 0,
              pendingMovedFundsSweepRequestsCount: 0,
              // Initially set the state to Live, so that the redemption
              // request can be made
              state: walletState.Live,
              movingFundsTargetWalletsCommitmentHash: ethers.constants.HashZero,
            })
            await bridge.setWalletMainUtxo(
              data.wallet.pubKeyHash,
              data.mainUtxo
            )

            const redeemerSigner = await impersonateAccount(
              data.redemptionRequests[0].redeemer,
              {
                from: governance,
                value: null, // use default value
              }
            )

            await makeRedemptionAllowance(
              redeemerSigner,
              data.redemptionRequests[0].amount
            )

            await bridge
              .connect(redeemerSigner)
              .requestRedemption(
                data.wallet.pubKeyHash,
                data.mainUtxo,
                data.redemptionRequests[0].redeemerOutputScript,
                data.redemptionRequests[0].amount
              )

            // Simulate the wallet's state has changed to MovingFunds
            const wallet = await bridge.wallets(data.wallet.pubKeyHash)
            await bridge.setWallet(data.wallet.pubKeyHash, {
              ecdsaWalletID: wallet.ecdsaWalletID,
              mainUtxoHash: wallet.mainUtxoHash,
              pendingRedemptionsValue: wallet.pendingRedemptionsValue,
              createdAt: wallet.createdAt,
              movingFundsRequestedAt: wallet.movingFundsRequestedAt,
              closingStartedAt: wallet.closingStartedAt,
              pendingMovedFundsSweepRequestsCount:
                wallet.pendingMovedFundsSweepRequestsCount,
              state: walletState.MovingFunds,
              movingFundsTargetWalletsCommitmentHash: ethers.constants.HashZero,
            })

            await increaseTime(redemptionTimeout)

            initialPendingRedemptionsValue = (
              await bridge.wallets(data.wallet.pubKeyHash)
            ).pendingRedemptionsValue

            initialRedeemerBalance = await bank.balanceOf(
              data.redemptionRequests[0].redeemer
            )

            const redemptionKey = buildRedemptionKey(
              data.wallet.pubKeyHash,
              data.redemptionRequests[0].redeemerOutputScript
            )

            redemptionRequest = await bridge.pendingRedemptions(redemptionKey)

            tx = await bridge
              .connect(thirdParty)
              .notifyRedemptionTimeout(
                data.wallet.pubKeyHash,
                walletMembersIDs,
                data.redemptionRequests[0].redeemerOutputScript
              )
          })

          after(async () => {
            walletRegistry.seize.reset()

            await restoreSnapshot()
          })

          it("should update the wallet's pending redemptions value", async () => {
            const expectedPendingRedemptionsValue =
              initialPendingRedemptionsValue
                .sub(data.redemptionRequests[0].amount)
                .add(redemptionRequest.treasuryFee)

            const currentPendingRedemptionsValue = (
              await bridge.wallets(data.wallet.pubKeyHash)
            ).pendingRedemptionsValue

            expect(currentPendingRedemptionsValue).to.be.equal(
              expectedPendingRedemptionsValue
            )
          })

          it("should return the requested amount of tokens to the redeemer", async () => {
            const expectedRedeemerBalance = initialRedeemerBalance.add(
              data.redemptionRequests[0].amount
            )
            const currentRedeemerBalance = await bank.balanceOf(
              data.redemptionRequests[0].redeemer
            )
            expect(currentRedeemerBalance).to.be.equal(expectedRedeemerBalance)
          })

          it("should remove the request from the pending redemptions", async () => {
            const redemptionKey = buildRedemptionKey(
              data.wallet.pubKeyHash,
              data.redemptionRequests[0].redeemerOutputScript
            )
            const request = await bridge.pendingRedemptions(redemptionKey)

            expect(request.requestedAt).to.be.equal(0)
          })

          it("should add the request to the timed-out redemptions", async () => {
            const timedOutRequest = await bridge.timedOutRedemptions(
              buildRedemptionKey(
                data.wallet.pubKeyHash,
                data.redemptionRequests[0].redeemerOutputScript
              )
            )

            expect(timedOutRequest.redeemer).to.be.equal(
              data.redemptionRequests[0].redeemer
            )
            expect(timedOutRequest.requestedAmount).to.be.equal(
              redemptionRequest.requestedAmount
            )
            expect(timedOutRequest.treasuryFee).to.be.equal(
              redemptionRequest.treasuryFee
            )
            expect(timedOutRequest.txMaxFee).to.be.equal(
              redemptionRequest.txMaxFee
            )
            expect(timedOutRequest.requestedAt).to.be.equal(
              redemptionRequest.requestedAt
            )
          })

          it("should not change wallet state", async () => {
            expect(
              (await bridge.wallets(data.wallet.pubKeyHash)).state
            ).to.be.equal(walletState.MovingFunds)
          })

          it("should call the ECDSA wallet registry's seize function", async () => {
            expect(walletRegistry.seize).to.have.been.calledOnceWith(
              redemptionTimeoutSlashingAmount,
              redemptionTimeoutNotifierRewardMultiplier,
              await thirdParty.getAddress(),
              data.wallet.ecdsaWalletID,
              walletMembersIDs
            )
          })

          it("should emit RedemptionTimedOut event", async () => {
            await expect(tx)
              .to.emit(bridge, "RedemptionTimedOut")
              .withArgs(
                data.wallet.pubKeyHash,
                data.redemptionRequests[0].redeemerOutputScript
              )
          })
        })

        context("when the wallet is in Terminated state", () => {
          const data: RedemptionTestData = SinglePendingRequestedRedemption
          let tx: ContractTransaction
          let initialPendingRedemptionsValue: BigNumber
          let initialRedeemerBalance: BigNumber
          let redemptionRequest: {
            redeemer: string
            requestedAmount: BigNumber
            treasuryFee: BigNumber
            txMaxFee: BigNumber
            requestedAt: number
          }

          before(async () => {
            await createSnapshot()

            await bridge.setWallet(data.wallet.pubKeyHash, {
              ecdsaWalletID: data.wallet.ecdsaWalletID,
              mainUtxoHash: ethers.constants.HashZero,
              pendingRedemptionsValue: data.wallet.pendingRedemptionsValue,
              createdAt: await lastBlockTime(),
              movingFundsRequestedAt: 0,
              closingStartedAt: 0,
              pendingMovedFundsSweepRequestsCount: 0,
              // Initially set the state to Live, so that the redemption
              // request can be made
              state: walletState.Live,
              movingFundsTargetWalletsCommitmentHash: ethers.constants.HashZero,
            })
            await bridge.setWalletMainUtxo(
              data.wallet.pubKeyHash,
              data.mainUtxo
            )

            const redeemerSigner = await impersonateAccount(
              data.redemptionRequests[0].redeemer,
              {
                from: governance,
                value: null, // use default value
              }
            )

            await makeRedemptionAllowance(
              redeemerSigner,
              data.redemptionRequests[0].amount
            )

            await bridge
              .connect(redeemerSigner)
              .requestRedemption(
                data.wallet.pubKeyHash,
                data.mainUtxo,
                data.redemptionRequests[0].redeemerOutputScript,
                data.redemptionRequests[0].amount
              )

            // Simulate the wallet's state has changed to Terminated
            const wallet = await bridge.wallets(data.wallet.pubKeyHash)
            await bridge.setWallet(data.wallet.pubKeyHash, {
              ecdsaWalletID: wallet.ecdsaWalletID,
              mainUtxoHash: wallet.mainUtxoHash,
              pendingRedemptionsValue: wallet.pendingRedemptionsValue,
              createdAt: wallet.createdAt,
              movingFundsRequestedAt: wallet.movingFundsRequestedAt,
              closingStartedAt: wallet.closingStartedAt,
              pendingMovedFundsSweepRequestsCount:
                wallet.pendingMovedFundsSweepRequestsCount,
              state: walletState.Terminated,
              movingFundsTargetWalletsCommitmentHash: ethers.constants.HashZero,
            })

            await increaseTime(redemptionTimeout)

            initialPendingRedemptionsValue = (
              await bridge.wallets(data.wallet.pubKeyHash)
            ).pendingRedemptionsValue

            initialRedeemerBalance = await bank.balanceOf(
              data.redemptionRequests[0].redeemer
            )

            const redemptionKey = buildRedemptionKey(
              data.wallet.pubKeyHash,
              data.redemptionRequests[0].redeemerOutputScript
            )

            redemptionRequest = await bridge.pendingRedemptions(redemptionKey)

            tx = await bridge
              .connect(thirdParty)
              .notifyRedemptionTimeout(
                data.wallet.pubKeyHash,
                [],
                data.redemptionRequests[0].redeemerOutputScript
              )
          })

          after(async () => {
            await restoreSnapshot()
          })

          it("should update the wallet's pending redemptions value", async () => {
            const expectedPendingRedemptionsValue =
              initialPendingRedemptionsValue
                .sub(data.redemptionRequests[0].amount)
                .add(redemptionRequest.treasuryFee)

            const currentPendingRedemptionsValue = (
              await bridge.wallets(data.wallet.pubKeyHash)
            ).pendingRedemptionsValue

            expect(currentPendingRedemptionsValue).to.be.equal(
              expectedPendingRedemptionsValue
            )
          })

          it("should remove the request from the pending redemptions", async () => {
            const redemptionKey = buildRedemptionKey(
              data.wallet.pubKeyHash,
              data.redemptionRequests[0].redeemerOutputScript
            )
            const request = await bridge.pendingRedemptions(redemptionKey)

            expect(request.requestedAt).to.be.equal(0)
          })

          it("should add the request to the timed-out redemptions", async () => {
            const timedOutRequest = await bridge.timedOutRedemptions(
              buildRedemptionKey(
                data.wallet.pubKeyHash,
                data.redemptionRequests[0].redeemerOutputScript
              )
            )

            expect(timedOutRequest.redeemer).to.be.equal(
              data.redemptionRequests[0].redeemer
            )
            expect(timedOutRequest.requestedAmount).to.be.equal(
              redemptionRequest.requestedAmount
            )
            expect(timedOutRequest.treasuryFee).to.be.equal(
              redemptionRequest.treasuryFee
            )
            expect(timedOutRequest.txMaxFee).to.be.equal(
              redemptionRequest.txMaxFee
            )
            expect(timedOutRequest.requestedAt).to.be.equal(
              redemptionRequest.requestedAt
            )
          })

          it("should not change wallet state", async () => {
            expect(
              (await bridge.wallets(data.wallet.pubKeyHash)).state
            ).to.be.equal(walletState.Terminated)
          })

          it("should emit RedemptionTimedOut event", async () => {
            await expect(tx)
              .to.emit(bridge, "RedemptionTimedOut")
              .withArgs(
                data.wallet.pubKeyHash,
                data.redemptionRequests[0].redeemerOutputScript
              )
          })

          it("should return the requested amount of tokens to the redeemer", async () => {
            const expectedRedeemerBalance = initialRedeemerBalance.add(
              data.redemptionRequests[0].amount
            )
            const currentRedeemerBalance = await bank.balanceOf(
              data.redemptionRequests[0].redeemer
            )
            expect(currentRedeemerBalance).to.be.equal(expectedRedeemerBalance)
          })

          it("should not call the ECDSA wallet registry's seize function", async () => {
            expect(walletRegistry.seize).not.to.have.been.called
          })
        })

        context(
          "when the wallet is neither in Live, MovingFunds nor Terminated state",
          () => {
            const testData = [
              {
                testName: "when wallet state is Unknown",
                walletState: walletState.Unknown,
              },
              {
                testName: "when wallet state is Closing",
                walletState: walletState.Closing,
              },
              {
                testName: "when wallet state is Closed",
                walletState: walletState.Closed,
              },
            ]

            testData.forEach((test) => {
              context(test.testName, () => {
                const data: RedemptionTestData =
                  SinglePendingRequestedRedemption

                before(async () => {
                  await createSnapshot()

                  await bridge.setWallet(data.wallet.pubKeyHash, {
                    ecdsaWalletID: data.wallet.ecdsaWalletID,
                    mainUtxoHash: ethers.constants.HashZero,
                    pendingRedemptionsValue:
                      data.wallet.pendingRedemptionsValue,
                    createdAt: await lastBlockTime(),
                    movingFundsRequestedAt: 0,
                    closingStartedAt: 0,
                    pendingMovedFundsSweepRequestsCount: 0,
                    state: data.wallet.state,
                    movingFundsTargetWalletsCommitmentHash:
                      ethers.constants.HashZero,
                  })
                  await bridge.setWalletMainUtxo(
                    data.wallet.pubKeyHash,
                    data.mainUtxo
                  )

                  const redeemerSigner = await impersonateAccount(
                    data.redemptionRequests[0].redeemer,
                    {
                      from: governance,
                      value: null, // use default value
                    }
                  )

                  await makeRedemptionAllowance(
                    redeemerSigner,
                    data.redemptionRequests[0].amount
                  )

                  await bridge
                    .connect(redeemerSigner)
                    .requestRedemption(
                      data.wallet.pubKeyHash,
                      data.mainUtxo,
                      data.redemptionRequests[0].redeemerOutputScript,
                      data.redemptionRequests[0].amount
                    )

                  // Simulate the wallet's state has changed
                  const wallet = await bridge.wallets(data.wallet.pubKeyHash)
                  await bridge.setWallet(data.wallet.pubKeyHash, {
                    ecdsaWalletID: wallet.ecdsaWalletID,
                    mainUtxoHash: wallet.mainUtxoHash,
                    pendingRedemptionsValue: wallet.pendingRedemptionsValue,
                    createdAt: wallet.createdAt,
                    movingFundsRequestedAt: wallet.movingFundsRequestedAt,
                    closingStartedAt: wallet.closingStartedAt,
                    pendingMovedFundsSweepRequestsCount:
                      wallet.pendingMovedFundsSweepRequestsCount,
                    state: test.walletState,
                    movingFundsTargetWalletsCommitmentHash:
                      ethers.constants.HashZero,
                  })

                  await increaseTime(redemptionTimeout)
                })

                after(async () => {
                  await restoreSnapshot()
                })

                it("should revert", async () => {
                  await expect(
                    bridge
                      .connect(thirdParty)
                      .notifyRedemptionTimeout(
                        data.wallet.pubKeyHash,
                        [],
                        data.redemptionRequests[0].redeemerOutputScript
                      )
                  ).to.be.revertedWith(
                    "The wallet must be in Live, MovingFunds or Terminated state"
                  )
                })
              })
            })
          }
        )
      })

      context("when the redemption request has not timed out", () => {
        const data: RedemptionTestData = SinglePendingRequestedRedemption

        before(async () => {
          await createSnapshot()

          await bridge.setWallet(data.wallet.pubKeyHash, {
            ecdsaWalletID: data.wallet.ecdsaWalletID,
            mainUtxoHash: ethers.constants.HashZero,
            pendingRedemptionsValue: data.wallet.pendingRedemptionsValue,
            createdAt: await lastBlockTime(),
            movingFundsRequestedAt: 0,
            closingStartedAt: 0,
            pendingMovedFundsSweepRequestsCount: 0,
            state: data.wallet.state,
            movingFundsTargetWalletsCommitmentHash: ethers.constants.HashZero,
          })
          await bridge.setWalletMainUtxo(data.wallet.pubKeyHash, data.mainUtxo)

          const redeemerSigner = await impersonateAccount(
            data.redemptionRequests[0].redeemer,
            {
              from: governance,
              value: null, // use default value
            }
          )

          await makeRedemptionAllowance(
            redeemerSigner,
            data.redemptionRequests[0].amount
          )

          await bridge
            .connect(redeemerSigner)
            .requestRedemption(
              data.wallet.pubKeyHash,
              data.mainUtxo,
              data.redemptionRequests[0].redeemerOutputScript,
              data.redemptionRequests[0].amount
            )

          await increaseTime(redemptionTimeout.sub(1))
        })

        after(async () => {
          await restoreSnapshot()
        })

        it("should revert", async () => {
          await expect(
            bridge
              .connect(thirdParty)
              .notifyRedemptionTimeout(
                data.wallet.pubKeyHash,
                [],
                data.redemptionRequests[0].redeemerOutputScript
              )
          ).to.be.revertedWith("Redemption request has not timed out")
        })
      })
    })

    context("when redemption request does not exist", () => {
      const data: RedemptionTestData = SinglePendingRequestedRedemption
      const redemptionRequest = data.redemptionRequests[0]

      before(async () => {
        await createSnapshot()
      })

      after(async () => {
        await restoreSnapshot()
      })

      it("should revert", async () => {
        await expect(
          bridge
            .connect(thirdParty)
            .notifyRedemptionTimeout(
              data.wallet.pubKeyHash,
              [],
              redemptionRequest.redeemerOutputScript
            )
        ).to.be.revertedWith("Redemption request does not exist")
      })
    })
  })

  interface RedemptionScenarioOutcome {
    tx: ContractTransaction
    bridgeBalance: RedemptionBalanceChange
    walletPendingRedemptionsValue: RedemptionBalanceChange
    treasuryBalance: RedemptionBalanceChange
    redeemersBalances: RedemptionBalanceChange[]
  }

  async function runRedemptionScenario(
    data: RedemptionTestData,
    beforeProofActions?: () => Promise<void>
  ): Promise<RedemptionScenarioOutcome> {
    relay.getCurrentEpochDifficulty.returns(data.chainDifficulty)
    relay.getPrevEpochDifficulty.returns(data.chainDifficulty)

    // Simulate the wallet is a registered one.
    await bridge.setWallet(data.wallet.pubKeyHash, {
      ecdsaWalletID: data.wallet.ecdsaWalletID,
      mainUtxoHash: ethers.constants.HashZero,
      pendingRedemptionsValue: data.wallet.pendingRedemptionsValue,
      createdAt: await lastBlockTime(),
      movingFundsRequestedAt: 0,
      closingStartedAt: 0,
      pendingMovedFundsSweepRequestsCount: 0,
      state: data.wallet.state,
      movingFundsTargetWalletsCommitmentHash: ethers.constants.HashZero,
    })

    // Simulate the prepared main UTXO belongs to the wallet.
    await bridge.setWalletMainUtxo(data.wallet.pubKeyHash, data.mainUtxo)

    for (let i = 0; i < data.redemptionRequests.length; i++) {
      const { redeemer, redeemerOutputScript, amount } =
        data.redemptionRequests[i]

      /* eslint-disable no-await-in-loop */
      const redeemerSigner = await impersonateAccount(redeemer, {
        from: governance,
        value: null, // use default value
      })

      await makeRedemptionAllowance(redeemerSigner, amount)

      await bridge
        .connect(redeemerSigner)
        .requestRedemption(
          data.wallet.pubKeyHash,
          data.mainUtxo,
          redeemerOutputScript,
          amount
        )
      /* eslint-enable no-await-in-loop */
    }

    if (beforeProofActions) {
      await beforeProofActions()
    }

    const bridgeBalanceBeforeProof = await bank.balanceOf(bridge.address)
    const walletPendingRedemptionsValueBeforeProof = (
      await bridge.wallets(data.wallet.pubKeyHash)
    ).pendingRedemptionsValue
    const treasuryBalanceBeforeProof = await bank.balanceOf(treasury.address)

    const redeemersBalancesBeforeProof = []
    for (let i = 0; i < data.redemptionRequests.length; i++) {
      const { redeemer } = data.redemptionRequests[i]
      // eslint-disable-next-line no-await-in-loop
      redeemersBalancesBeforeProof.push(await bank.balanceOf(redeemer))
    }

    const tx = await bridge.submitRedemptionProof(
      data.redemptionTx,
      data.redemptionProof,
      data.mainUtxo,
      data.wallet.pubKeyHash
    )

    const bridgeBalanceAfterProof = await bank.balanceOf(bridge.address)
    const walletPendingRedemptionsValueAfterProof = (
      await bridge.wallets(data.wallet.pubKeyHash)
    ).pendingRedemptionsValue
    const treasuryBalanceAfterProof = await bank.balanceOf(treasury.address)

    const redeemersBalances = []
    for (let i = 0; i < data.redemptionRequests.length; i++) {
      const { redeemer } = data.redemptionRequests[i]
      redeemersBalances.push({
        beforeProof: redeemersBalancesBeforeProof[i],
        // eslint-disable-next-line no-await-in-loop
        afterProof: await bank.balanceOf(redeemer),
      })
    }

    return {
      tx,
      bridgeBalance: {
        beforeProof: bridgeBalanceBeforeProof,
        afterProof: bridgeBalanceAfterProof,
      },
      walletPendingRedemptionsValue: {
        beforeProof: walletPendingRedemptionsValueBeforeProof,
        afterProof: walletPendingRedemptionsValueAfterProof,
      },
      treasuryBalance: {
        beforeProof: treasuryBalanceBeforeProof,
        afterProof: treasuryBalanceAfterProof,
      },
      redeemersBalances,
    }
  }

  async function makeRedemptionAllowance(
    redeemer: SignerWithAddress,
    amount: BigNumberish
  ) {
    // Simulate the redeemer has a TBTC balance allowing to make the request.
    await bank.setBalance(redeemer.address, amount)
    // Redeemer must allow the Bridge to spent the requested amount.
    await bank
      .connect(redeemer)
      .increaseBalanceAllowance(bridge.address, amount)
  }

  function buildRedemptionKey(
    walletPubKeyHash: BytesLike,
    redeemerOutputScript: BytesLike
  ): string {
    return ethers.utils.solidityKeccak256(
      ["bytes20", "bytes"],
      [walletPubKeyHash, redeemerOutputScript]
    )
  }

  function buildMainUtxoHash(
    txHash: BytesLike,
    txOutputIndex: BigNumberish,
    txOutputValue: BigNumberish
  ): string {
    return ethers.utils.solidityKeccak256(
      ["bytes32", "uint32", "uint64"],
      [txHash, txOutputIndex, txOutputValue]
    )
  }
})
