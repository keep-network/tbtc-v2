import { ethers, helpers, waffle } from "hardhat"
import { SignerWithAddress } from "@nomiclabs/hardhat-ethers/signers"
import { expect } from "chai"
import { ContractTransaction, BigNumber, BigNumberish } from "ethers"
import type { FakeContract } from "@defi-wonderland/smock"

import { BridgeStub } from "../../typechain/BridgeStub"

import type {
  Bank,
  BankStub,
  MaintainerProxy,
  ReimbursementPool,
  Bridge,
  MaintainerProxy__factory,
  ReimbursementPool__factory,
  IRelay,
} from "../../typechain"

import {
  RedemptionTestData,
  SinglePendingRequestedRedemption,
  MultiplePendingRequestedRedemptions,
  MultiplePendingRequestedRedemptionsWithP2WPKHChange,
} from "../data/redemption"

import {
  MultipleDepositsNoMainUtxo,
  MultipleDepositsWithMainUtxo,
  NO_MAIN_UTXO,
  SingleP2SHDeposit,
  SingleP2WSHDeposit,
  SweepTestData,
} from "../data/sweep"

import bridgeFixture from "../bridge/bridge-fixture"
import { constants, walletState } from "../fixtures"

const { createSnapshot, restoreSnapshot } = helpers.snapshot
const { provider } = waffle
const { impersonateAccount } = helpers.account

const fixtureBridge = async () => bridgeFixture()
const { lastBlockTime, increaseTime } = helpers.time

const fixture = async () => {
  const staticGas = 40800 // gas amount consumed by the refund() + tx cost
  const maxGasPrice = 500000000000 // 500 gwei

  const bridgeFixtures = await waffle.loadFixture(fixtureBridge)

  const ReimbursementPool =
    await ethers.getContractFactory<ReimbursementPool__factory>(
      "ReimbursementPool"
    )
  const reimbursementPool = await ReimbursementPool.deploy(
    staticGas,
    maxGasPrice
  )
  await reimbursementPool.deployed()
  await reimbursementPool
    .connect(bridgeFixtures.deployer)
    .transferOwnership(bridgeFixtures.governance.address)

  await bridgeFixtures.deployer.sendTransaction({
    to: reimbursementPool.address,
    value: ethers.utils.parseEther("100.0"), // Send 100.0 ETH
  })

  const MaintainerProxy =
    await ethers.getContractFactory<MaintainerProxy__factory>("MaintainerProxy")
  const maintainerProxy = await MaintainerProxy.deploy(
    bridgeFixtures.bridge.address,
    reimbursementPool.address
  )
  await maintainerProxy.deployed()
  await maintainerProxy
    .connect(bridgeFixtures.deployer)
    .transferOwnership(bridgeFixtures.governance.address)

  return { ...bridgeFixtures, maintainerProxy, reimbursementPool }
}

describe("Maintainer", () => {
  const activeWalletMainUtxo = {
    txHash:
      "0xc9e58780c6c289c25ae1fe293f85a4db4d0af4f305172f2a1868ddd917458bdf",
    txOutputIndex: 1,
    txOutputValue: constants.walletMinBtcBalance,
  }

  let governance: SignerWithAddress
  let bridge: Bridge & BridgeStub
  let thirdParty: SignerWithAddress

  let maintainerProxy: MaintainerProxy
  let reimbursementPool: ReimbursementPool
  let relay: FakeContract<IRelay>

  let bank: Bank & BankStub

  before(async () => {
    // eslint-disable-next-line @typescript-eslint/no-extra-semi
    ;({
      thirdParty,
      governance,
      bridge,
      maintainerProxy,
      reimbursementPool,
      relay,
      bank,
    } = await waffle.loadFixture(fixture))
  })

  describe("requestNewWallet", () => {
    describe("when called by an unauthorized third party", async () => {
      it("should revert", async () => {
        await expect(
          maintainerProxy.connect(thirdParty).requestNewWallet(NO_MAIN_UTXO)
        ).to.be.revertedWith("Caller is not authorized")
      })
    })

    describe("when called by an authorized third party", async () => {
      let tx: ContractTransaction
      let initThirdPartyBalance: BigNumber

      before(async () => {
        await createSnapshot()

        initThirdPartyBalance = await provider.getBalance(thirdParty.address)

        await maintainerProxy.connect(governance).authorize(thirdParty.address)
        await reimbursementPool
          .connect(governance)
          .authorize(maintainerProxy.address)

        tx = await maintainerProxy
          .connect(thirdParty)
          .requestNewWallet(activeWalletMainUtxo)
      })

      after(async () => {
        await restoreSnapshot()
      })

      it("should emit NewWalletRequested event", async () => {
        await expect(tx).to.emit(bridge, "NewWalletRequested")
      })

      it("should refund ETH", async () => {
        const postNotifyThirdPartyBalance = await provider.getBalance(
          thirdParty.address
        )
        const diff = postNotifyThirdPartyBalance.sub(initThirdPartyBalance)

        expect(diff).to.be.gt(0)
        expect(diff).to.be.lt(
          ethers.utils.parseUnits("2000000", "gwei") // 0,002 ETH
        )
      })
    })
  })

  describe("submitSweepProof", () => {
    context("when the wallet state is Live", () => {
      context("when transaction proof is valid", () => {
        context("when there is only one output", () => {
          context("when wallet public key hash length is 20 bytes", () => {
            context("when main UTXO data are valid", () => {
              context(
                "when transaction fee does not exceed the deposit transaction maximum fee",
                () => {
                  context("when there is only one input", () => {
                    context(
                      "when the single input is a revealed unswept P2SH deposit",
                      () => {
                        let tx: ContractTransaction
                        const data: SweepTestData = SingleP2SHDeposit
                        // Take wallet public key hash from first deposit. All
                        // deposits in same sweep batch should have the same value
                        // of that field.
                        const { walletPubKeyHash } = data.deposits[0].reveal
                        let initThirdPartyBalance: BigNumber

                        before(async () => {
                          await createSnapshot()

                          // Set the deposit dust threshold to 0.0001 BTC, i.e. 100x smaller than
                          // the initial value in the Bridge in order to save test Bitcoins.
                          await bridge.setDepositDustThreshold(10000)

                          // Simulate the wallet is an Live one and is known in
                          // the system.
                          await bridge.setWallet(walletPubKeyHash, {
                            ecdsaWalletID: ethers.constants.HashZero,
                            mainUtxoHash: ethers.constants.HashZero,
                            pendingRedemptionsValue: 0,
                            createdAt: await lastBlockTime(),
                            movingFundsRequestedAt: 0,
                            state: walletState.Live,
                            movingFundsTargetWalletsCommitmentHash:
                              ethers.constants.HashZero,
                          })

                          initThirdPartyBalance = await provider.getBalance(
                            thirdParty.address
                          )
                          tx = await runSweepScenario(data)
                        })

                        after(async () => {
                          await restoreSnapshot()
                        })

                        it("should emit DepositsSwept event", async () => {
                          await expect(tx)
                            .to.emit(bridge, "DepositsSwept")
                            .withArgs(walletPubKeyHash, data.sweepTx.hash)
                        })

                        it("should refund ETH", async () => {
                          const postNotifyThirdPartyBalance =
                            await provider.getBalance(thirdParty.address)
                          const diff = postNotifyThirdPartyBalance.sub(
                            initThirdPartyBalance
                          )

                          expect(diff).to.be.gt(0)
                          expect(diff).to.be.lt(
                            ethers.utils.parseUnits("2000000", "gwei") // 0,002 ETH
                          )
                        })
                      }
                    )

                    context(
                      "when the single input is a revealed unswept P2WSH deposit",
                      () => {
                        let tx: ContractTransaction
                        const data: SweepTestData = SingleP2WSHDeposit
                        // Take wallet public key hash from first deposit. All
                        // deposits in same sweep batch should have the same value
                        // of that field.
                        const { walletPubKeyHash } = data.deposits[0].reveal
                        let initThirdPartyBalance: BigNumber

                        before(async () => {
                          await createSnapshot()

                          // Set the deposit dust threshold to 0.0001 BTC, i.e. 100x smaller than
                          // the initial value in the Bridge in order to save test Bitcoins.
                          await bridge.setDepositDustThreshold(10000)

                          // Simulate the wallet is an Live one and is known in
                          // the system.
                          await bridge.setWallet(walletPubKeyHash, {
                            ecdsaWalletID: ethers.constants.HashZero,
                            mainUtxoHash: ethers.constants.HashZero,
                            pendingRedemptionsValue: 0,
                            createdAt: await lastBlockTime(),
                            movingFundsRequestedAt: 0,
                            state: walletState.Live,
                            movingFundsTargetWalletsCommitmentHash:
                              ethers.constants.HashZero,
                          })

                          initThirdPartyBalance = await provider.getBalance(
                            thirdParty.address
                          )
                          tx = await runSweepScenario(data)
                        })

                        after(async () => {
                          await restoreSnapshot()
                        })

                        it("should emit DepositsSwept event", async () => {
                          await expect(tx)
                            .to.emit(bridge, "DepositsSwept")
                            .withArgs(walletPubKeyHash, data.sweepTx.hash)
                        })

                        it("should refund ETH", async () => {
                          const postNotifyThirdPartyBalance =
                            await provider.getBalance(thirdParty.address)
                          const diff = postNotifyThirdPartyBalance.sub(
                            initThirdPartyBalance
                          )

                          expect(diff).to.be.gt(0)
                          expect(diff).to.be.lt(
                            ethers.utils.parseUnits("2000000", "gwei") // 0,002 ETH
                          )
                        })
                      }
                    )
                  })

                  context("when there are multiple inputs", () => {
                    context(
                      "when input vector consists only of revealed unswept " +
                        "deposits and the expected main UTXO",
                      () => {
                        let tx: ContractTransaction
                        const previousData: SweepTestData =
                          MultipleDepositsNoMainUtxo
                        const data: SweepTestData = MultipleDepositsWithMainUtxo
                        // Take wallet public key hash from first deposit. All
                        // deposits in same sweep batch should have the same value
                        // of that field.
                        const { walletPubKeyHash } = data.deposits[0].reveal
                        let initThirdPartyBalance: BigNumber

                        before(async () => {
                          await createSnapshot()

                          // Set the deposit dust threshold to 0.0001 BTC, i.e. 100x smaller than
                          // the initial value in the Bridge in order to save test Bitcoins.
                          await bridge.setDepositDustThreshold(10000)

                          // Simulate the wallet is an Live one and is known in
                          // the system.
                          await bridge.setWallet(walletPubKeyHash, {
                            ecdsaWalletID: ethers.constants.HashZero,
                            mainUtxoHash: ethers.constants.HashZero,
                            pendingRedemptionsValue: 0,
                            createdAt: await lastBlockTime(),
                            movingFundsRequestedAt: 0,
                            state: walletState.Live,
                            movingFundsTargetWalletsCommitmentHash:
                              ethers.constants.HashZero,
                          })

                          // Make the first sweep which is actually the predecessor
                          // of the sweep tested within this scenario.
                          await runSweepScenario(previousData)

                          initThirdPartyBalance = await provider.getBalance(
                            thirdParty.address
                          )
                          tx = await runSweepScenario(data)
                        })

                        after(async () => {
                          await restoreSnapshot()
                        })

                        it("should emit DepositsSwept event", async () => {
                          await expect(tx)
                            .to.emit(bridge, "DepositsSwept")
                            .withArgs(walletPubKeyHash, data.sweepTx.hash)
                        })

                        it("should refund ETH", async () => {
                          const postNotifyThirdPartyBalance =
                            await provider.getBalance(thirdParty.address)
                          const diff = postNotifyThirdPartyBalance.sub(
                            initThirdPartyBalance
                          )

                          expect(diff).to.be.gt(0)
                          expect(diff).to.be.lt(
                            ethers.utils.parseUnits("2000000", "gwei") // 0,002 ETH
                          )
                        })
                      }
                    )

                    context(
                      "when input vector consists only of revealed unswept " +
                        "deposits but there is no main UTXO since it is not expected",
                      () => {
                        let tx: ContractTransaction
                        const data: SweepTestData = MultipleDepositsNoMainUtxo
                        // Take wallet public key hash from first deposit. All
                        // deposits in same sweep batch should have the same value
                        // of that field.
                        const { walletPubKeyHash } = data.deposits[0].reveal
                        let initThirdPartyBalance: BigNumber

                        before(async () => {
                          await createSnapshot()

                          // Set the deposit dust threshold to 0.0001 BTC, i.e. 100x smaller than
                          // the initial value in the Bridge in order to save test Bitcoins.
                          await bridge.setDepositDustThreshold(10000)

                          // Simulate the wallet is an Live one and is known in
                          // the system.
                          await bridge.setWallet(walletPubKeyHash, {
                            ecdsaWalletID: ethers.constants.HashZero,
                            mainUtxoHash: ethers.constants.HashZero,
                            pendingRedemptionsValue: 0,
                            createdAt: await lastBlockTime(),
                            movingFundsRequestedAt: 0,
                            state: walletState.Live,
                            movingFundsTargetWalletsCommitmentHash:
                              ethers.constants.HashZero,
                          })

                          initThirdPartyBalance = await provider.getBalance(
                            thirdParty.address
                          )

                          tx = await runSweepScenario(data)
                        })

                        after(async () => {
                          await restoreSnapshot()
                        })

                        it("should emit DepositsSwept event", async () => {
                          await expect(tx)
                            .to.emit(bridge, "DepositsSwept")
                            .withArgs(walletPubKeyHash, data.sweepTx.hash)
                        })

                        it("should refund ETH", async () => {
                          const postNotifyThirdPartyBalance =
                            await provider.getBalance(thirdParty.address)
                          const diff = postNotifyThirdPartyBalance.sub(
                            initThirdPartyBalance
                          )

                          expect(diff).to.be.gt(0)
                          expect(diff).to.be.lt(
                            ethers.utils.parseUnits("2000000", "gwei") // 0,002 ETH
                          )
                        })
                      }
                    )
                  })
                }
              )
            })
          })
        })
      })
    })

    context("when the wallet state is MovingFunds", () => {
      // The execution of `submitSweepProof` is the same for wallets in
      // `MovingFunds` state as for the ones in `Live` state. Therefore the
      // testing of `MovingFunds` state is limited to just one simple test case
      // (sweeping single P2SH deposit).
      const data: SweepTestData = SingleP2SHDeposit
      const { fundingTx, reveal } = data.deposits[0]

      let tx: Promise<ContractTransaction>
      let initThirdPartyBalance: BigNumber

      before(async () => {
        await createSnapshot()

        // Set the deposit dust threshold to 0.0001 BTC, i.e. 100x smaller than
        // the initial value in the Bridge in order to save test Bitcoins.
        await bridge.setDepositDustThreshold(10000)

        // Initially set the state to Live, so that the deposit can be revealed
        await bridge.setWallet(reveal.walletPubKeyHash, {
          ecdsaWalletID: ethers.constants.HashZero,
          mainUtxoHash: ethers.constants.HashZero,
          pendingRedemptionsValue: 0,
          createdAt: await lastBlockTime(),
          movingFundsRequestedAt: 0,
          state: walletState.Live,
          movingFundsTargetWalletsCommitmentHash: ethers.constants.HashZero,
        })

        relay.getPrevEpochDifficulty.returns(data.chainDifficulty)
        relay.getCurrentEpochDifficulty.returns(data.chainDifficulty)

        await bridge.revealDeposit(fundingTx, reveal)

        // Simulate the wallet's state has changed to MovingFunds
        const wallet = await bridge.getWallet(reveal.walletPubKeyHash)
        await bridge.setWallet(reveal.walletPubKeyHash, {
          ...wallet,
          state: walletState.MovingFunds,
        })

        initThirdPartyBalance = await provider.getBalance(thirdParty.address)

        await maintainerProxy.connect(governance).authorize(thirdParty.address)
        await reimbursementPool
          .connect(governance)
          .authorize(maintainerProxy.address)

        tx = maintainerProxy
          .connect(thirdParty)
          .submitSweepProof(data.sweepTx, data.sweepProof, data.mainUtxo)
      })

      after(async () => {
        await restoreSnapshot()
      })

      it("should successfully submit sweep proof", async () => {
        await expect(tx).not.to.be.reverted
      })

      it("should refund ETH", async () => {
        const postNotifyThirdPartyBalance = await provider.getBalance(
          thirdParty.address
        )
        const diff = postNotifyThirdPartyBalance.sub(initThirdPartyBalance)

        expect(diff).to.be.gt(0)
        expect(diff).to.be.lt(
          ethers.utils.parseUnits("2000000", "gwei") // 0,002 ETH
        )
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

                        let outcome: Promise<RedemptionScenarioOutcome>

                        before(async () => {
                          await createSnapshot()

                          // Simulate the situation when treasury fee is 0% to
                          // allow using the whole wallet's main UTXO value
                          // to fulfill the redemption request.
                          await bridge.setRedemptionTreasuryFeeDivisor(0)

                          // eslint-disable-next-line @typescript-eslint/no-extra-semi

                          outcome = runRedemptionScenario(data)
                        })

                        after(async () => {
                          await restoreSnapshot()
                        })

                        it("should succeed", async () => {
                          await expect(outcome).to.not.be.reverted
                        })

                        it("should refund ETH", async () => {
                          const resolvedOutcome = await outcome

                          const postThirdPartyBalance =
                            await provider.getBalance(thirdParty.address)

                          const diff = postThirdPartyBalance.sub(
                            resolvedOutcome.initThirdPartyBalance
                          )
                          expect(diff).to.be.gt(0)
                          expect(diff).to.be.lt(
                            ethers.utils.parseUnits("3500000", "gwei") // 0,0035 ETH
                          )
                        })
                      }
                    )

                    context(
                      "when the single output is a non-reported timed out requested redemption",
                      () => {
                        const data: RedemptionTestData =
                          SinglePendingRequestedRedemption

                        let outcome: Promise<RedemptionScenarioOutcome>

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
                            await increaseTime(await bridge.redemptionTimeout())
                          }

                          // eslint-disable-next-line @typescript-eslint/no-extra-semi
                          outcome = runRedemptionScenario(
                            data,
                            beforeProofActions
                          )
                        })

                        after(async () => {
                          await restoreSnapshot()
                        })

                        it("should succeed", async () => {
                          await expect(outcome).to.not.be.reverted
                        })

                        it("should refund ETH", async () => {
                          const resolvedOutcome = await outcome

                          const postThirdPartyBalance =
                            await provider.getBalance(thirdParty.address)

                          const diff = postThirdPartyBalance.sub(
                            resolvedOutcome.initThirdPartyBalance
                          )
                          expect(diff).to.be.gt(0)
                          expect(diff).to.be.lt(
                            ethers.utils.parseUnits("3500000", "gwei") // 0,0035 ETH
                          )
                        })
                      }
                    )

                    context(
                      "when the single output is a reported timed out requested redemption",
                      () => {
                        const data: RedemptionTestData =
                          SinglePendingRequestedRedemption

                        let outcome: Promise<RedemptionScenarioOutcome>

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
                            await increaseTime(await bridge.redemptionTimeout())
                            await bridge.notifyRedemptionTimeout(
                              data.wallet.pubKeyHash,
                              data.redemptionRequests[0].redeemerOutputScript
                            )
                          }

                          // eslint-disable-next-line @typescript-eslint/no-extra-semi
                          outcome = runRedemptionScenario(
                            data,
                            beforeProofActions
                          )
                        })

                        after(async () => {
                          await restoreSnapshot()
                        })

                        it("should succeed", async () => {
                          await expect(outcome).to.not.be.reverted
                        })

                        it("should refund ETH", async () => {
                          const resolvedOutcome = await outcome

                          const postThirdPartyBalance =
                            await provider.getBalance(thirdParty.address)

                          const diff = postThirdPartyBalance.sub(
                            resolvedOutcome.initThirdPartyBalance
                          )

                          expect(diff).to.be.gt(0)
                          expect(diff).to.be.lt(
                            ethers.utils.parseUnits("2000000", "gwei") // 0,002 ETH
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

                        let outcome: Promise<RedemptionScenarioOutcome>

                        before(async () => {
                          await createSnapshot()

                          // Simulate the situation when treasury fee is 0% to
                          // allow using the whole wallet's main UTXO value
                          // to fulfill the redemption requests.
                          await bridge.setRedemptionTreasuryFeeDivisor(0)

                          // eslint-disable-next-line @typescript-eslint/no-extra-semi
                          outcome = runRedemptionScenario(data)
                        })

                        after(async () => {
                          await restoreSnapshot()
                        })

                        it("should succeed", async () => {
                          await expect(outcome).to.not.be.reverted
                        })

                        it("should refund ETH", async () => {
                          const resolvedOutcome = await outcome

                          const postThirdPartyBalance =
                            await provider.getBalance(thirdParty.address)

                          const diff = postThirdPartyBalance.sub(
                            resolvedOutcome.initThirdPartyBalance
                          )
                          expect(diff).to.be.gt(0)
                          expect(diff).to.be.lt(
                            ethers.utils.parseUnits("8000000", "gwei") // 0,008 ETH
                          )
                        })
                      }
                    )

                    context(
                      "when output vector consists of pending requested redemptions and a non-zero change",
                      () => {
                        const data: RedemptionTestData =
                          MultiplePendingRequestedRedemptionsWithP2WPKHChange

                        let outcome: Promise<RedemptionScenarioOutcome>

                        before(async () => {
                          await createSnapshot()

                          // eslint-disable-next-line @typescript-eslint/no-extra-semi
                          outcome = runRedemptionScenario(data)
                        })

                        after(async () => {
                          await restoreSnapshot()
                        })

                        it("should succeed", async () => {
                          await expect(outcome).to.not.be.reverted
                        })

                        it("should refund ETH", async () => {
                          const resolvedOutcome = await outcome

                          const postThirdPartyBalance =
                            await provider.getBalance(thirdParty.address)

                          const diff = postThirdPartyBalance.sub(
                            resolvedOutcome.initThirdPartyBalance
                          )
                          expect(diff).to.be.gt(0)
                          expect(diff).to.be.lt(
                            ethers.utils.parseUnits("8500000", "gwei") // 0,0085 ETH
                          )
                        })
                      }
                    )

                    context(
                      "when output vector consists only of reported timed out requested redemptions",
                      () => {
                        const data: RedemptionTestData =
                          MultiplePendingRequestedRedemptions

                        let outcome: Promise<RedemptionScenarioOutcome>

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
                            await increaseTime(await bridge.redemptionTimeout())

                            for (
                              let i = 0;
                              i < data.redemptionRequests.length;
                              i++
                            ) {
                              // eslint-disable-next-line no-await-in-loop
                              await bridge.notifyRedemptionTimeout(
                                data.wallet.pubKeyHash,
                                data.redemptionRequests[i].redeemerOutputScript
                              )
                            }
                          }

                          // eslint-disable-next-line @typescript-eslint/no-extra-semi
                          outcome = runRedemptionScenario(
                            data,
                            beforeProofActions
                          )
                        })

                        after(async () => {
                          await restoreSnapshot()
                        })

                        it("should succeed", async () => {
                          await expect(outcome).to.not.be.reverted
                        })

                        it("should refund ETH", async () => {
                          const resolvedOutcome = await outcome

                          const postThirdPartyBalance =
                            await provider.getBalance(thirdParty.address)

                          const diff = postThirdPartyBalance.sub(
                            resolvedOutcome.initThirdPartyBalance
                          )
                          expect(diff).to.be.gt(
                            ethers.utils.parseUnits("-1000000", "gwei")
                          ) // // -0,001 ETH
                          expect(diff).to.be.lt(
                            ethers.utils.parseUnits("1000000", "gwei") // 0,001 ETH
                          )
                        })
                      }
                    )

                    context(
                      "when output vector consists of reported timed out requested redemptions and a non-zero change",
                      () => {
                        const data: RedemptionTestData =
                          MultiplePendingRequestedRedemptionsWithP2WPKHChange

                        let outcome: Promise<RedemptionScenarioOutcome>

                        before(async () => {
                          await createSnapshot()

                          // Before submitting the redemption proof, wait
                          // an amount of time that will make the requests
                          // timed out and then report the timeouts.
                          const beforeProofActions = async () => {
                            await increaseTime(await bridge.redemptionTimeout())

                            for (
                              let i = 0;
                              i < data.redemptionRequests.length;
                              i++
                            ) {
                              // eslint-disable-next-line no-await-in-loop
                              await bridge.notifyRedemptionTimeout(
                                data.wallet.pubKeyHash,
                                data.redemptionRequests[i].redeemerOutputScript
                              )
                            }
                          }

                          // eslint-disable-next-line @typescript-eslint/no-extra-semi
                          outcome = runRedemptionScenario(
                            data,
                            beforeProofActions
                          )
                        })

                        after(async () => {
                          await restoreSnapshot()
                        })

                        it("should succeed", async () => {
                          await expect(outcome).to.not.be.reverted
                        })

                        it("should refund ETH", async () => {
                          const resolvedOutcome = await outcome

                          const postThirdPartyBalance =
                            await provider.getBalance(thirdParty.address)

                          const diff = postThirdPartyBalance.sub(
                            resolvedOutcome.initThirdPartyBalance
                          )
                          expect(diff).to.be.gt(
                            ethers.utils.parseUnits("-2000000", "gwei")
                          ) // -0,002 ETH
                          expect(diff).to.be.lt(
                            ethers.utils.parseUnits("2000000", "gwei") // 0,002 ETH
                          )
                        })
                      }
                    )

                    context(
                      "when output vector consists of pending requested redemptions and reported timed out requested redemptions",
                      () => {
                        const data: RedemptionTestData =
                          MultiplePendingRequestedRedemptions

                        let outcome: Promise<RedemptionScenarioOutcome>

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
                            await increaseTime(await bridge.redemptionTimeout())

                            await bridge.notifyRedemptionTimeout(
                              data.wallet.pubKeyHash,
                              data.redemptionRequests[0].redeemerOutputScript
                            )
                            await bridge.notifyRedemptionTimeout(
                              data.wallet.pubKeyHash,
                              data.redemptionRequests[1].redeemerOutputScript
                            )
                          }

                          // eslint-disable-next-line @typescript-eslint/no-extra-semi
                          outcome = runRedemptionScenario(
                            data,
                            beforeProofActions
                          )
                        })

                        after(async () => {
                          await restoreSnapshot()
                        })

                        it("should succeed", async () => {
                          await expect(outcome).to.not.be.reverted
                        })

                        it("should refund ETH", async () => {
                          const resolvedOutcome = await outcome

                          const postThirdPartyBalance =
                            await provider.getBalance(thirdParty.address)

                          const diff = postThirdPartyBalance.sub(
                            resolvedOutcome.initThirdPartyBalance
                          )
                          expect(diff).to.be.gt(0)
                          expect(diff).to.be.lt(
                            ethers.utils.parseUnits("6000000", "gwei") // 0,006 ETH
                          )
                        })
                      }
                    )

                    context(
                      "when output vector consists of pending requested redemptions, reported timed out requested redemptions and a non-zero change",
                      () => {
                        const data: RedemptionTestData =
                          MultiplePendingRequestedRedemptionsWithP2WPKHChange

                        let outcome: Promise<RedemptionScenarioOutcome>

                        before(async () => {
                          await createSnapshot()

                          // Before submitting the redemption proof, wait
                          // an amount of time that will make the requests
                          // timed out but report timeout only the two first
                          // requests.
                          const beforeProofActions = async () => {
                            await increaseTime(await bridge.redemptionTimeout())

                            await bridge.notifyRedemptionTimeout(
                              data.wallet.pubKeyHash,
                              data.redemptionRequests[0].redeemerOutputScript
                            )
                            await bridge.notifyRedemptionTimeout(
                              data.wallet.pubKeyHash,
                              data.redemptionRequests[1].redeemerOutputScript
                            )
                          }

                          // eslint-disable-next-line @typescript-eslint/no-extra-semi
                          outcome = runRedemptionScenario(
                            data,
                            beforeProofActions
                          )
                        })

                        after(async () => {
                          await restoreSnapshot()
                        })

                        it("should succeed", async () => {
                          await expect(outcome).to.not.be.reverted
                        })

                        it("should refund ETH", async () => {
                          const resolvedOutcome = await outcome

                          const postThirdPartyBalance =
                            await provider.getBalance(thirdParty.address)

                          const diff = postThirdPartyBalance.sub(
                            resolvedOutcome.initThirdPartyBalance
                          )
                          expect(diff).to.be.gt(0)
                          expect(diff).to.be.lt(
                            ethers.utils.parseUnits("5500000", "gwei") // 0,0055 ETH
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
                      const wallet = await bridge.getWallet(
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

                  it("should refund ETH", async () => {
                    const resolvedOutcome = await outcome

                    const postThirdPartyBalance = await provider.getBalance(
                      thirdParty.address
                    )

                    const diff = postThirdPartyBalance.sub(
                      resolvedOutcome.initThirdPartyBalance
                    )
                    expect(diff).to.be.gt(0)
                    expect(diff).to.be.lt(
                      ethers.utils.parseUnits("8500000", "gwei") // 0,0085 ETH
                    )
                  })
                })
              }
            )
          })
        })
      })
    })
  })

  interface RedemptionScenarioOutcome {
    tx: ContractTransaction
    initThirdPartyBalance: BigNumber
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

  async function runSweepScenario(
    data: SweepTestData
  ): Promise<ContractTransaction> {
    relay.getPrevEpochDifficulty.returns(data.chainDifficulty)
    relay.getCurrentEpochDifficulty.returns(data.chainDifficulty)

    await maintainerProxy.connect(governance).authorize(thirdParty.address)
    await reimbursementPool
      .connect(governance)
      .authorize(maintainerProxy.address)

    for (let i = 0; i < data.deposits.length; i++) {
      const { fundingTx, reveal } = data.deposits[i]
      // eslint-disable-next-line no-await-in-loop
      await bridge.revealDeposit(fundingTx, reveal)
    }

    return maintainerProxy
      .connect(thirdParty)
      .submitSweepProof(data.sweepTx, data.sweepProof, data.mainUtxo)
  }

  async function runRedemptionScenario(
    data: RedemptionTestData,
    beforeProofActions?: () => Promise<void>
  ): Promise<RedemptionScenarioOutcome> {
    relay.getPrevEpochDifficulty.returns(data.chainDifficulty)
    relay.getCurrentEpochDifficulty.returns(data.chainDifficulty)

    await bridge.setRedemptionDustThreshold(10000)

    // Simulate the wallet is a registered one.
    await bridge.setWallet(data.wallet.pubKeyHash, {
      ecdsaWalletID: data.wallet.ecdsaWalletID,
      mainUtxoHash: ethers.constants.HashZero,
      pendingRedemptionsValue: data.wallet.pendingRedemptionsValue,
      createdAt: await lastBlockTime(),
      movingFundsRequestedAt: 0,
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
        value: 100, // use default value
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

    const initThirdPartyBalance = await provider.getBalance(thirdParty.address)

    await maintainerProxy.connect(governance).authorize(thirdParty.address)
    await reimbursementPool
      .connect(governance)
      .authorize(maintainerProxy.address)

    const tx = await maintainerProxy
      .connect(thirdParty)
      .submitRedemptionProof(
        data.redemptionTx,
        data.redemptionProof,
        data.mainUtxo,
        data.wallet.pubKeyHash
      )

    return {
      tx,
      initThirdPartyBalance,
    }
  }

  describe("authorize", () => {
    // TODO: implement
  })

  describe("unauthorize", () => {
    // TODO: implement
  })

  describe("updateBridge", () => {
    // TODO: implement
  })

  // TODO: add tests for updating gas
})
