/* eslint-disable no-underscore-dangle */
import { ethers, helpers, waffle } from "hardhat"
import { SignerWithAddress } from "@nomiclabs/hardhat-ethers/signers"
import { SigningKey } from "ethers/lib/utils"
import { assert, expect } from "chai"
import { ContractTransaction, BigNumber, BigNumberish } from "ethers"
import type { FakeContract } from "@defi-wonderland/smock"
import { smock } from "@defi-wonderland/smock"
import { to1ePrecision } from "../helpers/contract-test-helpers"

import { ecdsaWalletTestData } from "../data/ecdsa"
import type {
  BridgeStub,
  IWalletRegistry,
  Bank,
  BankStub,
  MaintainerProxy,
  ReimbursementPool,
  Bridge,
  IRelay,
  IVault,
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
  DepositSweepTestData,
} from "../data/deposit-sweep"

import {
  wallet as fraudWallet,
  nonWitnessSignSingleInputTx,
  nonWitnessSignMultipleInputsTx,
  witnessSignSingleInputTx,
  witnessSignMultipleInputTx,
} from "../data/fraud"

import {
  MovedFundsSweepTestData,
  MovedFundsSweepWithMainUtxo,
  MovedFundsSweepWithoutMainUtxo,
  MovingFundsTestData,
  MultipleTargetWalletsAndDivisibleAmount,
  MultipleTargetWalletsAndIndivisibleAmount,
  SingleTargetWallet,
} from "../data/moving-funds"

import bridgeFixture from "../fixtures/bridge"
import { constants, walletState } from "../fixtures"

const { createSnapshot, restoreSnapshot } = helpers.snapshot
const { provider } = waffle
const { impersonateAccount } = helpers.account

const { lastBlockTime, increaseTime } = helpers.time
const { keccak256, sha256 } = ethers.utils

const { publicKey: walletPublicKey, pubKeyHash160: walletPublicKeyHash } =
  fraudWallet

// Most of the tests around specific bridge functionality were ported from the
// other tbtc-v2 tests suites and adjusted to check the refund functionality of
// the Maintainer Proxy contract.
describe("MaintainerProxy", () => {
  const activeWalletMainUtxo = {
    txHash:
      "0xc9e58780c6c289c25ae1fe293f85a4db4d0af4f305172f2a1868ddd917458bdf",
    txOutputIndex: 1,
    txOutputValue: constants.walletCreationMinBtcBalance,
  }

  let governance: SignerWithAddress
  let bridge: Bridge & BridgeStub
  let thirdParty: SignerWithAddress
  let authorizedMaintainer: SignerWithAddress
  let deployer: SignerWithAddress

  let maintainerProxy: MaintainerProxy
  let reimbursementPool: ReimbursementPool
  let relay: FakeContract<IRelay>
  let walletRegistry: FakeContract<IWalletRegistry>
  let bank: Bank & BankStub

  let fraudChallengeDepositAmount: BigNumber
  let movingFundsTimeoutResetDelay: number

  let initialAuthorizedMaintainerBalance: BigNumber

  before(async () => {
    // eslint-disable-next-line @typescript-eslint/no-extra-semi
    ;({
      governance,
      bridge,
      maintainerProxy,
      relay,
      bank,
      reimbursementPool,
      maintainerProxy,
      deployer,
    } = await waffle.loadFixture(bridgeFixture))
    ;({ movingFundsTimeoutResetDelay } = await bridge.movingFundsParameters())

    walletRegistry = await smock.fake<IWalletRegistry>("IWalletRegistry", {
      address: (await bridge.contractReferences()).ecdsaWalletRegistry,
    })

    // Set the deposit dust threshold to 0.0001 BTC, i.e. 100x smaller than
    // the initial value in the Bridge in order to save test Bitcoins.
    // Scaling down deposit TX max fee as well.
    await bridge.setDepositDustThreshold(10000)
    await bridge.setDepositTxMaxFee(2000)

    await deployer.sendTransaction({
      to: walletRegistry.address,
      value: ethers.utils.parseEther("100"),
    })

    await deployer.sendTransaction({
      to: reimbursementPool.address,
      value: ethers.utils.parseEther("100"),
    })
    ;({ fraudChallengeDepositAmount } = await bridge.fraudParameters())
    ;[thirdParty, authorizedMaintainer] =
      await helpers.signers.getUnnamedSigners()

    await maintainerProxy
      .connect(governance)
      .authorize(authorizedMaintainer.address)

    initialAuthorizedMaintainerBalance = await provider.getBalance(
      authorizedMaintainer.address
    )
  })

  describe("requestNewWallet", () => {
    context("when called by an unauthorized third party", async () => {
      it("should revert", async () => {
        await expect(
          maintainerProxy.connect(thirdParty).requestNewWallet(NO_MAIN_UTXO)
        ).to.be.revertedWith("Caller is not authorized")
      })
    })

    context("when called by an authorized maintainer", async () => {
      let tx: ContractTransaction

      before(async () => {
        await createSnapshot()

        initialAuthorizedMaintainerBalance = await provider.getBalance(
          authorizedMaintainer.address
        )

        tx = await maintainerProxy
          .connect(authorizedMaintainer)
          .requestNewWallet(activeWalletMainUtxo)
      })

      after(async () => {
        await restoreSnapshot()
      })

      it("should emit NewWalletRequested event", async () => {
        await expect(tx).to.emit(bridge, "NewWalletRequested")
      })

      it("should refund ETH", async () => {
        const postMaintainerBalance = await provider.getBalance(
          authorizedMaintainer.address
        )
        const diff = postMaintainerBalance.sub(
          initialAuthorizedMaintainerBalance
        )

        expect(diff).to.be.gt(0)
        expect(diff).to.be.lt(
          ethers.utils.parseUnits("2000000", "gwei") // 0,002 ETH
        )
      })
    })
  })

  describe("submitDepositSweepProof", () => {
    before(async () => {
      await createSnapshot()

      const data: DepositSweepTestData = SingleP2SHDeposit
      // Take wallet public key hash from first deposit. All
      // deposits in same sweep batch should have the same value
      // of that field.
      const { walletPubKeyHash } = data.deposits[0].reveal

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

    context("when called by an unauthorized third party", async () => {
      const data: DepositSweepTestData = SingleP2SHDeposit

      before(async () => {
        await createSnapshot()
      })

      after(async () => {
        await restoreSnapshot()
      })

      it("should revert", async () => {
        const tx = maintainerProxy
          .connect(thirdParty)
          .submitDepositSweepProof(
            data.sweepTx,
            data.sweepProof,
            data.mainUtxo,
            data.vault
          )

        await expect(tx).to.be.revertedWith("Caller is not authorized")
      })
    })

    context("when called by an authorized maintainer", async () => {
      before(async () => {
        await createSnapshot()
      })

      after(async () => {
        await restoreSnapshot()
      })

      context("when there is only one input", () => {
        context(
          "when the single input is a revealed unswept P2SH deposit",
          () => {
            const data: DepositSweepTestData = SingleP2SHDeposit
            let tx: ContractTransaction

            before(async () => {
              await createSnapshot()

              tx = await runDepositSweepScenario(data)
            })

            after(async () => {
              await restoreSnapshot()
            })

            it("should emit DepositSwept event", async () => {
              await expect(tx).to.emit(bridge, "DepositsSwept")
            })

            it("should refund ETH", async () => {
              const postMaintainerBalance = await provider.getBalance(
                authorizedMaintainer.address
              )
              const diff = postMaintainerBalance.sub(
                initialAuthorizedMaintainerBalance
              )

              expect(diff).to.be.gt(0)
              expect(diff).to.be.lt(
                ethers.utils.parseUnits("1500000", "gwei") // 0,0015 ETH
              )
            })
          }
        )

        context(
          "when the single input is a revealed unswept P2WSH deposit",
          () => {
            const data: DepositSweepTestData = SingleP2WSHDeposit
            let tx: ContractTransaction

            before(async () => {
              await createSnapshot()

              tx = await runDepositSweepScenario(data)
            })

            after(async () => {
              await restoreSnapshot()
            })

            it("should emit DepositSwept event", async () => {
              await expect(tx).to.emit(bridge, "DepositsSwept")
            })

            it("should refund ETH", async () => {
              const postMaintainerBalance = await provider.getBalance(
                authorizedMaintainer.address
              )
              const diff = postMaintainerBalance.sub(
                initialAuthorizedMaintainerBalance
              )

              expect(diff).to.be.gt(0)
              expect(diff).to.be.lt(
                ethers.utils.parseUnits("2100000", "gwei") // 0,002 ETH
              )
            })
          }
        )

        context(
          "when the single input is a revealed unswept deposit with a trusted vault",
          async () => {
            const data: DepositSweepTestData = SingleP2WSHDeposit
            let vault: FakeContract<IVault>
            let tx: ContractTransaction

            before(async () => {
              await createSnapshot()

              // Deploy a fake vault and mark it as trusted.
              vault = await smock.fake<IVault>("IVault")
              await bridge
                .connect(governance)
                .setVaultStatus(vault.address, true)

              // Enrich the test data with the vault parameter.
              const dataWithVault: DepositSweepTestData = JSON.parse(
                JSON.stringify(data)
              )
              dataWithVault.vault = vault.address
              dataWithVault.deposits[0].reveal.vault = vault.address

              tx = await runDepositSweepScenario(dataWithVault)
            })

            after(async () => {
              await restoreSnapshot()
            })

            it("should emit DepositSwept event", async () => {
              await expect(tx).to.emit(bridge, "DepositsSwept")
            })

            it("should refund ETH", async () => {
              const postMaintainerBalance = await provider.getBalance(
                authorizedMaintainer.address
              )
              const diff = postMaintainerBalance.sub(
                initialAuthorizedMaintainerBalance
              )

              expect(diff).to.be.gt(0)
              expect(diff).to.be.lt(
                ethers.utils.parseUnits("2000000", "gwei") // 0,002 ETH
              )
            })
          }
        )

        context(
          "when the single input is a revealed unswept deposit with a non-trusted vault",
          async () => {
            const data: DepositSweepTestData = SingleP2WSHDeposit
            let vault: FakeContract<IVault>
            let tx: ContractTransaction

            before(async () => {
              await createSnapshot()

              // Deploy a fake vault and mark it as trusted.
              vault = await smock.fake<IVault>("IVault")
              await bridge
                .connect(governance)
                .setVaultStatus(vault.address, true)

              // Enrich the test data with the vault parameter.
              const dataWithVault: DepositSweepTestData = JSON.parse(
                JSON.stringify(data)
              )
              dataWithVault.vault = vault.address
              dataWithVault.deposits[0].reveal.vault = vault.address

              // Mark the vault as non-trusted just before
              // proof submission.
              const beforeProofActions = async () => {
                await bridge
                  .connect(governance)
                  .setVaultStatus(vault.address, false)
              }

              tx = await runDepositSweepScenario(
                dataWithVault,
                beforeProofActions
              )
            })

            after(async () => {
              await restoreSnapshot()
            })

            it("should emit DepositSwept event", async () => {
              await expect(tx).to.emit(bridge, "DepositsSwept")
            })

            it("should refund ETH", async () => {
              const postMaintainerBalance = await provider.getBalance(
                authorizedMaintainer.address
              )
              const diff = postMaintainerBalance.sub(
                initialAuthorizedMaintainerBalance
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
            const previousData: DepositSweepTestData =
              MultipleDepositsNoMainUtxo
            const data: DepositSweepTestData = MultipleDepositsWithMainUtxo
            let tx: ContractTransaction

            before(async () => {
              await createSnapshot()

              // Make the first sweep which is actually the predecessor
              // of the sweep tested within this scenario.
              await runDepositSweepScenario(previousData)

              tx = await runDepositSweepScenario(data)
            })

            after(async () => {
              await restoreSnapshot()
            })

            it("should emit DepositSwept event", async () => {
              await expect(tx).to.emit(bridge, "DepositsSwept")
            })

            it("should refund ETH", async () => {
              const postMaintainerBalance = await provider.getBalance(
                authorizedMaintainer.address
              )
              const diff = postMaintainerBalance.sub(
                initialAuthorizedMaintainerBalance
              )

              expect(diff).to.be.gt(0)
              expect(diff).to.be.lt(
                ethers.utils.parseUnits("1000000", "gwei") // 0,001 ETH
              )
            })
          }
        )

        context(
          "when input vector consists only of revealed unswept deposits with a " +
            "trusted vault and the expected main UTXO",
          () => {
            const previousData: DepositSweepTestData =
              MultipleDepositsNoMainUtxo
            const data: DepositSweepTestData = MultipleDepositsWithMainUtxo
            let vault: FakeContract<IVault>
            let tx: ContractTransaction

            before(async () => {
              await createSnapshot()

              // Make the first sweep which is actually the predecessor
              // of the sweep tested within this scenario.
              await runDepositSweepScenario(previousData)

              // Deploy a fake vault and mark it as trusted.
              vault = await smock.fake<IVault>("IVault")
              await bridge
                .connect(governance)
                .setVaultStatus(vault.address, true)

              // Enrich the test data with the vault parameter.
              const dataWithVault: DepositSweepTestData = JSON.parse(
                JSON.stringify(data)
              )
              dataWithVault.vault = vault.address
              dataWithVault.deposits[0].reveal.vault = vault.address
              dataWithVault.deposits[1].reveal.vault = vault.address
              dataWithVault.deposits[2].reveal.vault = vault.address
              dataWithVault.deposits[3].reveal.vault = vault.address
              dataWithVault.deposits[4].reveal.vault = vault.address

              tx = await runDepositSweepScenario(data)
            })

            after(async () => {
              await restoreSnapshot()
            })

            it("should emit DepositSwept event", async () => {
              await expect(tx).to.emit(bridge, "DepositsSwept")
            })

            it("should refund ETH", async () => {
              const postMaintainerBalance = await provider.getBalance(
                authorizedMaintainer.address
              )
              const diff = postMaintainerBalance.sub(
                initialAuthorizedMaintainerBalance
              )

              expect(diff).to.be.gt(0)
              expect(diff).to.be.lt(
                ethers.utils.parseUnits("1000000", "gwei") // 0,001 ETH
              )
            })
          }
        )

        context(
          "when input vector consists only of revealed unswept deposits with a non-trusted vault and the expected main UTXO",
          () => {
            const previousData: DepositSweepTestData =
              MultipleDepositsNoMainUtxo
            const data: DepositSweepTestData = MultipleDepositsWithMainUtxo
            let vault: FakeContract<IVault>
            let tx: ContractTransaction

            before(async () => {
              await createSnapshot()

              // Make the first sweep which is actually the predecessor
              // of the sweep tested within this scenario.
              await runDepositSweepScenario(previousData)

              // Deploy a fake vault and mark it as trusted.
              vault = await smock.fake<IVault>("IVault")
              await bridge
                .connect(governance)
                .setVaultStatus(vault.address, true)

              // Enrich the test data with the vault parameter.
              const dataWithVault: DepositSweepTestData = JSON.parse(
                JSON.stringify(data)
              )
              dataWithVault.vault = vault.address
              dataWithVault.deposits[0].reveal.vault = vault.address
              dataWithVault.deposits[1].reveal.vault = vault.address
              dataWithVault.deposits[2].reveal.vault = vault.address
              dataWithVault.deposits[3].reveal.vault = vault.address
              dataWithVault.deposits[4].reveal.vault = vault.address

              // Mark the vault as non-trusted just before
              // proof submission.
              const beforeProofActions = async () => {
                await bridge
                  .connect(governance)
                  .setVaultStatus(vault.address, false)
              }

              tx = await runDepositSweepScenario(
                dataWithVault,
                beforeProofActions
              )
            })

            after(async () => {
              await restoreSnapshot()
            })

            it("should emit DepositSwept event", async () => {
              await expect(tx).to.emit(bridge, "DepositsSwept")
            })

            it("should refund ETH", async () => {
              const postMaintainerBalance = await provider.getBalance(
                authorizedMaintainer.address
              )
              const diff = postMaintainerBalance.sub(
                initialAuthorizedMaintainerBalance
              )

              expect(diff).to.be.gt(0)
              expect(diff).to.be.lt(
                ethers.utils.parseUnits("2100000", "gwei") // 0,0021 ETH
              )
            })
          }
        )

        context(
          "when input vector consists only of revealed unswept deposits with different trusted vaults and the expected main UTXO",
          () => {
            const previousData: DepositSweepTestData =
              MultipleDepositsNoMainUtxo
            const data: DepositSweepTestData = MultipleDepositsWithMainUtxo
            let vaultA: FakeContract<IVault>
            let vaultB: FakeContract<IVault>
            let tx: ContractTransaction

            before(async () => {
              await createSnapshot()

              // Make the first sweep which is actually the predecessor
              // of the sweep tested within this scenario.
              await runDepositSweepScenario(previousData)

              // Deploy two fake vaults and mark them as trusted.
              vaultA = await smock.fake<IVault>("IVault")
              vaultB = await smock.fake<IVault>("IVault")
              await bridge
                .connect(governance)
                .setVaultStatus(vaultA.address, true)
              await bridge
                .connect(governance)
                .setVaultStatus(vaultB.address, true)

              // Enrich the test data with the vault parameter.
              const dataWithVault: DepositSweepTestData = JSON.parse(
                JSON.stringify(data)
              )
              dataWithVault.vault = vaultA.address
              dataWithVault.deposits[0].reveal.vault = vaultA.address
              dataWithVault.deposits[1].reveal.vault = vaultA.address
              dataWithVault.deposits[2].reveal.vault = vaultB.address
              dataWithVault.deposits[3].reveal.vault = vaultB.address
              dataWithVault.deposits[4].reveal.vault = vaultA.address

              tx = await runDepositSweepScenario(data)
            })

            after(async () => {
              await restoreSnapshot()
            })

            it("should emit DepositSwept event", async () => {
              await expect(tx).to.emit(bridge, "DepositsSwept")
            })

            it("should refund ETH", async () => {
              const postMaintainerBalance = await provider.getBalance(
                authorizedMaintainer.address
              )
              const diff = postMaintainerBalance.sub(
                initialAuthorizedMaintainerBalance
              )

              expect(diff).to.be.gt(0)
              expect(diff).to.be.lt(
                ethers.utils.parseUnits("1000000", "gwei") // 0,001 ETH
              )
            })
          }
        )

        context(
          "when input vector consists only of revealed unswept " +
            "deposits but there is no main UTXO since it is not expected",
          () => {
            const data: DepositSweepTestData = MultipleDepositsNoMainUtxo
            let tx: ContractTransaction

            before(async () => {
              await createSnapshot()

              tx = await runDepositSweepScenario(data)
            })

            after(async () => {
              await restoreSnapshot()
            })

            it("should emit DepositSwept event", async () => {
              await expect(tx).to.emit(bridge, "DepositsSwept")
            })

            it("should refund ETH", async () => {
              const postMaintainerBalance = await provider.getBalance(
                authorizedMaintainer.address
              )
              const diff = postMaintainerBalance.sub(
                initialAuthorizedMaintainerBalance
              )

              expect(diff).to.be.gt(0)
              expect(diff).to.be.lt(
                ethers.utils.parseUnits("1000000", "gwei") // 0,001 ETH
              )
            })
          }
        )
      })
    })
  })

  describe("submitRedemptionProof", () => {
    let redemptionTimeout: BigNumber

    context("when called by an unauthorized third party", async () => {
      before(async () => {
        await createSnapshot()
        redemptionTimeout = BigNumber.from(
          (await bridge.redemptionParameters()).redemptionTimeout
        )
      })

      after(async () => {
        await restoreSnapshot()
      })

      it("should revert", async () => {
        // Simulate the situation when treasury fee is 0% to
        // allow using the whole wallet's main UTXO value
        // to fulfill the redemption request.
        await bridge.setRedemptionTreasuryFeeDivisor(0)
        const data: RedemptionTestData = SinglePendingRequestedRedemption

        const tx = maintainerProxy
          .connect(thirdParty)
          .submitRedemptionProof(
            data.redemptionTx,
            data.redemptionProof,
            data.mainUtxo,
            data.wallet.pubKeyHash
          )
        await expect(tx).to.be.revertedWith("Caller is not authorized")
      })
    })

    context("when called by an authorized maintainer", async () => {
      context("when transaction proof is valid", () => {
        before(async () => {
          await createSnapshot()
        })

        after(async () => {
          await restoreSnapshot()
        })

        context("when there is only one output", () => {
          context(
            "when the single output is a pending requested redemption",
            () => {
              const data: RedemptionTestData = SinglePendingRequestedRedemption
              let tx: ContractTransaction

              before(async () => {
                await createSnapshot()

                // Simulate the situation when treasury fee is 0% to
                // allow using the whole wallet's main UTXO value
                // to fulfill the redemption request.
                await bridge.setRedemptionTreasuryFeeDivisor(0)

                // eslint-disable-next-line @typescript-eslint/no-extra-semi
                tx = await runRedemptionScenario(data)
              })

              after(async () => {
                await restoreSnapshot()
              })

              it("should emit RedemptionsCompleted event", async () => {
                await expect(tx).to.emit(bridge, "RedemptionsCompleted")
              })

              it("should refund ETH", async () => {
                const postThirdPartyBalance = await provider.getBalance(
                  authorizedMaintainer.address
                )
                const diff = postThirdPartyBalance.sub(
                  initialAuthorizedMaintainerBalance
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
              const data: RedemptionTestData = SinglePendingRequestedRedemption
              let tx: ContractTransaction

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
                tx = await runRedemptionScenario(data, beforeProofActions)
              })

              after(async () => {
                await restoreSnapshot()
              })

              it("should emit RedemptionsCompleted event", async () => {
                await expect(tx).to.emit(bridge, "RedemptionsCompleted")
              })

              it("should refund ETH", async () => {
                const postThirdPartyBalance = await provider.getBalance(
                  authorizedMaintainer.address
                )
                const diff = postThirdPartyBalance.sub(
                  initialAuthorizedMaintainerBalance
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
              const data: RedemptionTestData = SinglePendingRequestedRedemption
              let tx: ContractTransaction

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
                tx = await runRedemptionScenario(data, beforeProofActions)
              })

              after(async () => {
                await restoreSnapshot()
              })

              it("should emit RedemptionsCompleted event", async () => {
                await expect(tx).to.emit(bridge, "RedemptionsCompleted")
              })

              it("should refund ETH", async () => {
                const postThirdPartyBalance = await provider.getBalance(
                  authorizedMaintainer.address
                )
                const diff = postThirdPartyBalance.sub(
                  initialAuthorizedMaintainerBalance
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
              let tx: ContractTransaction

              before(async () => {
                await createSnapshot()

                // Simulate the situation when treasury fee is 0% to
                // allow using the whole wallet's main UTXO value
                // to fulfill the redemption requests.
                await bridge.setRedemptionTreasuryFeeDivisor(0)

                // eslint-disable-next-line @typescript-eslint/no-extra-semi
                tx = await runRedemptionScenario(data)
              })

              after(async () => {
                await restoreSnapshot()
              })

              it("should emit RedemptionsCompleted event", async () => {
                await expect(tx).to.emit(bridge, "RedemptionsCompleted")
              })

              it("should refund ETH", async () => {
                const postThirdPartyBalance = await provider.getBalance(
                  authorizedMaintainer.address
                )
                const diff = postThirdPartyBalance.sub(
                  initialAuthorizedMaintainerBalance
                )

                expect(diff).to.be.gt(0)
                expect(diff).to.be.lt(
                  ethers.utils.parseUnits("8200000", "gwei") // 0,0082 ETH
                )
              })
            }
          )

          context(
            "when output vector consists of pending requested redemptions and a non-zero change",
            () => {
              const data: RedemptionTestData =
                MultiplePendingRequestedRedemptionsWithP2WPKHChange
              let tx: ContractTransaction

              before(async () => {
                await createSnapshot()

                // eslint-disable-next-line @typescript-eslint/no-extra-semi
                tx = await runRedemptionScenario(data)
              })

              after(async () => {
                await restoreSnapshot()
              })

              it("should emit RedemptionsCompleted event", async () => {
                await expect(tx).to.emit(bridge, "RedemptionsCompleted")
              })

              it("should refund ETH", async () => {
                const postThirdPartyBalance = await provider.getBalance(
                  authorizedMaintainer.address
                )

                const diff = postThirdPartyBalance.sub(
                  initialAuthorizedMaintainerBalance
                )
                expect(diff).to.be.gt(0)
                expect(diff).to.be.lt(
                  ethers.utils.parseUnits("9000000", "gwei") // 0,009 ETH
                )
              })
            }
          )

          context(
            "when output vector consists only of reported timed out requested redemptions",
            () => {
              const data: RedemptionTestData =
                MultiplePendingRequestedRedemptions
              let tx: ContractTransaction

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

                  for (let i = 0; i < data.redemptionRequests.length; i++) {
                    // eslint-disable-next-line no-await-in-loop
                    await bridge.notifyRedemptionTimeout(
                      data.wallet.pubKeyHash,
                      [],
                      data.redemptionRequests[i].redeemerOutputScript
                    )
                  }
                }

                // eslint-disable-next-line @typescript-eslint/no-extra-semi
                tx = await runRedemptionScenario(data, beforeProofActions)
              })

              after(async () => {
                await restoreSnapshot()
              })

              it("should emit RedemptionsCompleted event", async () => {
                await expect(tx).to.emit(bridge, "RedemptionsCompleted")
              })

              it("should refund ETH", async () => {
                const postThirdPartyBalance = await provider.getBalance(
                  authorizedMaintainer.address
                )
                const diff = postThirdPartyBalance.sub(
                  initialAuthorizedMaintainerBalance
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
              let tx: ContractTransaction

              before(async () => {
                await createSnapshot()

                // Before submitting the redemption proof, wait
                // an amount of time that will make the requests
                // timed out and then report the timeouts.
                const beforeProofActions = async () => {
                  await increaseTime(redemptionTimeout)

                  for (let i = 0; i < data.redemptionRequests.length; i++) {
                    // eslint-disable-next-line no-await-in-loop
                    await bridge.notifyRedemptionTimeout(
                      data.wallet.pubKeyHash,
                      [],
                      data.redemptionRequests[i].redeemerOutputScript
                    )
                  }
                }

                // eslint-disable-next-line @typescript-eslint/no-extra-semi
                tx = await runRedemptionScenario(data, beforeProofActions)
              })

              after(async () => {
                await restoreSnapshot()
              })

              it("should emit RedemptionsCompleted event", async () => {
                await expect(tx).to.emit(bridge, "RedemptionsCompleted")
              })

              it("should refund ETH", async () => {
                const postThirdPartyBalance = await provider.getBalance(
                  authorizedMaintainer.address
                )
                const diff = postThirdPartyBalance.sub(
                  initialAuthorizedMaintainerBalance
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
              let tx: ContractTransaction

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

                tx = await runRedemptionScenario(data, beforeProofActions)
              })

              after(async () => {
                await restoreSnapshot()
              })

              it("should emit RedemptionsCompleted event", async () => {
                await expect(tx).to.emit(bridge, "RedemptionsCompleted")
              })

              it("should refund ETH", async () => {
                const postThirdPartyBalance = await provider.getBalance(
                  authorizedMaintainer.address
                )
                const diff = postThirdPartyBalance.sub(
                  initialAuthorizedMaintainerBalance
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
              let tx: ContractTransaction

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

                tx = await runRedemptionScenario(data, beforeProofActions)
              })

              after(async () => {
                await restoreSnapshot()
              })

              it("should emit RedemptionsCompleted event", async () => {
                await expect(tx).to.emit(bridge, "RedemptionsCompleted")
              })

              it("should refund ETH", async () => {
                const postThirdPartyBalance = await provider.getBalance(
                  authorizedMaintainer.address
                )
                const diff = postThirdPartyBalance.sub(
                  initialAuthorizedMaintainerBalance
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
    })
  })

  describe("notifyWalletCloseable", () => {
    before(async () => {
      await createSnapshot()
    })

    after(async () => {
      walletRegistry.requestNewWallet.reset()

      await restoreSnapshot()
    })
    context("when called by an unauthorized third party", async () => {
      it("should revert", async () => {
        await expect(
          maintainerProxy
            .connect(thirdParty)
            .notifyWalletCloseable(
              ecdsaWalletTestData.pubKeyHash160,
              NO_MAIN_UTXO
            )
        ).to.be.revertedWith("Caller is not authorized")
      })
    })

    context("when called by an authorized maintainer", async () => {
      context("when the reported wallet is not the active one", () => {
        context("when wallet is in Live state", () => {
          before(async () => {
            await createSnapshot()

            await bridge.setWallet(ecdsaWalletTestData.pubKeyHash160, {
              ecdsaWalletID: ecdsaWalletTestData.walletID,
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
            walletRegistry.requestNewWallet.reset()

            await restoreSnapshot()
          })

          context("when wallet reached the maximum age", () => {
            before(async () => {
              await createSnapshot()

              await increaseTime((await bridge.walletParameters()).walletMaxAge)
            })

            after(async () => {
              walletRegistry.requestNewWallet.reset()

              await restoreSnapshot()
            })

            context("when wallet balance is zero", () => {
              let tx: ContractTransaction

              before(async () => {
                await createSnapshot()

                tx = await maintainerProxy
                  .connect(authorizedMaintainer)
                  .notifyWalletCloseable(
                    ecdsaWalletTestData.pubKeyHash160,
                    NO_MAIN_UTXO
                  )
              })

              after(async () => {
                await restoreSnapshot()
              })

              it("should emit WalletClosing event", async () => {
                await expect(tx).to.emit(bridge, "WalletClosing")
              })

              it("should refund ETH", async () => {
                const postMaintainerBalance = await provider.getBalance(
                  authorizedMaintainer.address
                )
                const diff = postMaintainerBalance.sub(
                  initialAuthorizedMaintainerBalance
                )

                expect(diff).to.be.gt(0)
                expect(diff).to.be.lt(
                  ethers.utils.parseUnits("2000000", "gwei") // 0,002 ETH
                )
              })
            })

            context("when wallet balance is greater than zero", () => {
              const walletMainUtxo = {
                txHash:
                  "0xc9e58780c6c289c25ae1fe293f85a4db4d0af4f305172f2a1868ddd917458bdf",
                txOutputIndex: 0,
                txOutputValue: 1,
              }

              let tx: ContractTransaction

              before(async () => {
                await createSnapshot()

                await bridge.setWalletMainUtxo(
                  ecdsaWalletTestData.pubKeyHash160,
                  walletMainUtxo
                )

                tx = await maintainerProxy
                  .connect(authorizedMaintainer)
                  .notifyWalletCloseable(
                    ecdsaWalletTestData.pubKeyHash160,
                    walletMainUtxo
                  )
              })

              after(async () => {
                await restoreSnapshot()
              })

              it("should emit WalletMovingFunds event", async () => {
                await expect(tx).to.emit(bridge, "WalletMovingFunds")
              })

              it("should refund ETH", async () => {
                const postMaintainerBalance = await provider.getBalance(
                  authorizedMaintainer.address
                )
                const diff = postMaintainerBalance.sub(
                  initialAuthorizedMaintainerBalance
                )

                expect(diff).to.be.gt(0)
                expect(diff).to.be.lt(
                  ethers.utils.parseUnits("2000000", "gwei") // 0,002 ETH
                )
              })
            })
          })

          context(
            "when wallet did not reach the maximum age but their balance is lesser than the minimum threshold",
            () => {
              context("when wallet balance is zero", () => {
                let tx: ContractTransaction

                before(async () => {
                  await createSnapshot()

                  tx = await maintainerProxy
                    .connect(authorizedMaintainer)
                    .notifyWalletCloseable(
                      ecdsaWalletTestData.pubKeyHash160,
                      NO_MAIN_UTXO
                    )
                })

                after(async () => {
                  await restoreSnapshot()
                })

                it("should emit WalletClosing event", async () => {
                  await expect(tx).to.emit(bridge, "WalletClosing")
                })

                it("should refund ETH", async () => {
                  const postMaintainerBalance = await provider.getBalance(
                    authorizedMaintainer.address
                  )
                  const diff = postMaintainerBalance.sub(
                    initialAuthorizedMaintainerBalance
                  )

                  expect(diff).to.be.gt(0)
                  expect(diff).to.be.lt(
                    ethers.utils.parseUnits("2000000", "gwei") // 0,002 ETH
                  )
                })
              })

              context("when wallet balance is greater than zero", () => {
                const walletMainUtxo = {
                  txHash:
                    "0xc9e58780c6c289c25ae1fe293f85a4db4d0af4f305172f2a1868ddd917458bdf",
                  txOutputIndex: 0,
                  txOutputValue: constants.walletClosureMinBtcBalance.sub(1),
                }

                let tx: ContractTransaction

                before(async () => {
                  await createSnapshot()

                  await bridge.setWalletMainUtxo(
                    ecdsaWalletTestData.pubKeyHash160,
                    walletMainUtxo
                  )

                  tx = await maintainerProxy
                    .connect(authorizedMaintainer)
                    .notifyWalletCloseable(
                      ecdsaWalletTestData.pubKeyHash160,
                      walletMainUtxo
                    )
                })

                after(async () => {
                  await restoreSnapshot()
                })

                it("should emit WalletMovingFunds event", async () => {
                  await expect(tx).to.emit(bridge, "WalletMovingFunds")
                })

                it("should refund ETH", async () => {
                  const postMaintainerBalance = await provider.getBalance(
                    authorizedMaintainer.address
                  )
                  const diff = postMaintainerBalance.sub(
                    initialAuthorizedMaintainerBalance
                  )

                  expect(diff).to.be.gt(0)
                  expect(diff).to.be.lt(
                    ethers.utils.parseUnits("2000000", "gwei") // 0,002 ETH
                  )
                })
              })
            }
          )
        })
      })
    })
  })

  describe("defeatFraudChallenge", () => {
    before(async () => {
      await createSnapshot()
    })

    after(async () => {
      await restoreSnapshot()
    })

    context("when the challenge exists", () => {
      context("when the input is non-witness", () => {
        context("when the transaction has single input", () => {
          context(
            "when the input is marked as correctly spent in the Bridge",
            () => {
              const data = nonWitnessSignSingleInputTx
              let tx: ContractTransaction

              before(async () => {
                await createSnapshot()

                await bridge.setWallet(walletPublicKeyHash, {
                  ecdsaWalletID: ethers.constants.HashZero,
                  mainUtxoHash: ethers.constants.HashZero,
                  pendingRedemptionsValue: 0,
                  createdAt: await lastBlockTime(),
                  movingFundsRequestedAt: 0,
                  closingStartedAt: 0,
                  pendingMovedFundsSweepRequestsCount: 0,
                  state: walletState.Live,
                  movingFundsTargetWalletsCommitmentHash:
                    ethers.constants.HashZero,
                })
                await bridge.setSweptDeposits(data.deposits)
                await bridge.setSpentMainUtxos(data.spentMainUtxos)
                await bridge.setProcessedMovedFundsSweepRequests(
                  data.movedFundsSweepRequests
                )

                await bridge
                  .connect(thirdParty)
                  .submitFraudChallenge(
                    walletPublicKey,
                    data.preimageSha256,
                    data.signature,
                    {
                      value: fraudChallengeDepositAmount,
                    }
                  )

                initialAuthorizedMaintainerBalance = await provider.getBalance(
                  authorizedMaintainer.address
                )

                tx = await maintainerProxy
                  .connect(authorizedMaintainer)
                  .defeatFraudChallenge(
                    walletPublicKey,
                    data.preimage,
                    data.witness
                  )
              })

              after(async () => {
                await restoreSnapshot()
              })

              it("should emit FraudChallengeDefeated event", async () => {
                await expect(tx).to.emit(bridge, "FraudChallengeDefeated")
              })

              it("should refund ETH", async () => {
                const postMaintainerBalance = await provider.getBalance(
                  authorizedMaintainer.address
                )
                const diff = postMaintainerBalance.sub(
                  initialAuthorizedMaintainerBalance
                )

                expect(diff).to.be.gt(0)
                expect(diff).to.be.lt(
                  ethers.utils.parseUnits("2000000", "gwei") // 0,002 ETH
                )
              })
            }
          )
        })

        context("when the transaction has multiple inputs", () => {
          context(
            "when the input is marked as correctly spent in the Bridge",
            () => {
              const data = nonWitnessSignMultipleInputsTx
              let tx: ContractTransaction

              before(async () => {
                await createSnapshot()

                await bridge.setWallet(walletPublicKeyHash, {
                  ecdsaWalletID: ethers.constants.HashZero,
                  mainUtxoHash: ethers.constants.HashZero,
                  pendingRedemptionsValue: 0,
                  createdAt: await lastBlockTime(),
                  movingFundsRequestedAt: 0,
                  closingStartedAt: 0,
                  pendingMovedFundsSweepRequestsCount: 0,
                  state: walletState.Live,
                  movingFundsTargetWalletsCommitmentHash:
                    ethers.constants.HashZero,
                })
                await bridge.setSweptDeposits(data.deposits)
                await bridge.setSpentMainUtxos(data.spentMainUtxos)
                await bridge.setProcessedMovedFundsSweepRequests(
                  data.movedFundsSweepRequests
                )

                await bridge
                  .connect(thirdParty)
                  .submitFraudChallenge(
                    walletPublicKey,
                    data.preimageSha256,
                    data.signature,
                    {
                      value: fraudChallengeDepositAmount,
                    }
                  )

                initialAuthorizedMaintainerBalance = await provider.getBalance(
                  authorizedMaintainer.address
                )

                tx = await maintainerProxy
                  .connect(authorizedMaintainer)
                  .defeatFraudChallenge(
                    walletPublicKey,
                    data.preimage,
                    data.witness
                  )
              })

              after(async () => {
                await restoreSnapshot()
              })

              it("should emit FraudChallengeDefeated event", async () => {
                await expect(tx).to.emit(bridge, "FraudChallengeDefeated")
              })

              it("should refund ETH", async () => {
                const postMaintainerBalance = await provider.getBalance(
                  authorizedMaintainer.address
                )
                const diff = postMaintainerBalance.sub(
                  initialAuthorizedMaintainerBalance
                )

                expect(diff).to.be.gt(0)
                expect(diff).to.be.lt(
                  ethers.utils.parseUnits("2000000", "gwei") // 0,002 ETH
                )
              })
            }
          )
        })
      })

      context("when the input is witness", () => {
        context("when the transaction has single input", () => {
          context(
            "when the input is marked as correctly spent in the Bridge",
            () => {
              const data = witnessSignSingleInputTx
              let tx: ContractTransaction

              before(async () => {
                await createSnapshot()

                await bridge.setWallet(walletPublicKeyHash, {
                  ecdsaWalletID: ethers.constants.HashZero,
                  mainUtxoHash: ethers.constants.HashZero,
                  pendingRedemptionsValue: 0,
                  createdAt: await lastBlockTime(),
                  movingFundsRequestedAt: 0,
                  closingStartedAt: 0,
                  pendingMovedFundsSweepRequestsCount: 0,
                  state: walletState.Live,
                  movingFundsTargetWalletsCommitmentHash:
                    ethers.constants.HashZero,
                })
                await bridge.setSweptDeposits(data.deposits)
                await bridge.setSpentMainUtxos(data.spentMainUtxos)
                await bridge.setProcessedMovedFundsSweepRequests(
                  data.movedFundsSweepRequests
                )

                await bridge
                  .connect(thirdParty)
                  .submitFraudChallenge(
                    walletPublicKey,
                    data.preimageSha256,
                    data.signature,
                    {
                      value: fraudChallengeDepositAmount,
                    }
                  )

                initialAuthorizedMaintainerBalance = await provider.getBalance(
                  authorizedMaintainer.address
                )

                tx = await maintainerProxy
                  .connect(authorizedMaintainer)
                  .defeatFraudChallenge(
                    walletPublicKey,
                    data.preimage,
                    data.witness
                  )
              })

              after(async () => {
                await restoreSnapshot()
              })

              it("should emit FraudChallengeDefeated event", async () => {
                await expect(tx).to.emit(bridge, "FraudChallengeDefeated")
              })

              it("should refund ETH", async () => {
                const postMaintainerBalance = await provider.getBalance(
                  authorizedMaintainer.address
                )
                const diff = postMaintainerBalance.sub(
                  initialAuthorizedMaintainerBalance
                )

                expect(diff).to.be.gt(0)
                expect(diff).to.be.lt(
                  ethers.utils.parseUnits("2000000", "gwei") // 0,002 ETH
                )
              })
            }
          )
        })

        context("when the transaction has multiple inputs", () => {
          context(
            "when the input is marked as correctly spent in the Bridge",
            () => {
              const data = witnessSignMultipleInputTx
              let tx: ContractTransaction

              before(async () => {
                await createSnapshot()

                await bridge.setWallet(walletPublicKeyHash, {
                  ecdsaWalletID: ethers.constants.HashZero,
                  mainUtxoHash: ethers.constants.HashZero,
                  pendingRedemptionsValue: 0,
                  createdAt: await lastBlockTime(),
                  movingFundsRequestedAt: 0,
                  closingStartedAt: 0,
                  pendingMovedFundsSweepRequestsCount: 0,
                  state: walletState.Live,
                  movingFundsTargetWalletsCommitmentHash:
                    ethers.constants.HashZero,
                })
                await bridge.setSweptDeposits(data.deposits)
                await bridge.setSpentMainUtxos(data.spentMainUtxos)
                await bridge.setProcessedMovedFundsSweepRequests(
                  data.movedFundsSweepRequests
                )

                await bridge
                  .connect(thirdParty)
                  .submitFraudChallenge(
                    walletPublicKey,
                    data.preimageSha256,
                    data.signature,
                    {
                      value: fraudChallengeDepositAmount,
                    }
                  )

                initialAuthorizedMaintainerBalance = await provider.getBalance(
                  authorizedMaintainer.address
                )

                tx = await maintainerProxy
                  .connect(authorizedMaintainer)
                  .defeatFraudChallenge(
                    walletPublicKey,
                    data.preimage,
                    data.witness
                  )
              })

              after(async () => {
                await restoreSnapshot()
              })

              it("should emit FraudChallengeDefeated event", async () => {
                await expect(tx).to.emit(bridge, "FraudChallengeDefeated")
              })

              it("should refund ETH", async () => {
                const postMaintainerBalance = await provider.getBalance(
                  authorizedMaintainer.address
                )
                const diff = postMaintainerBalance.sub(
                  initialAuthorizedMaintainerBalance
                )

                expect(diff).to.be.gt(0)
                expect(diff).to.be.lt(
                  ethers.utils.parseUnits("2000000", "gwei") // 0,002 ETH
                )
              })
            }
          )
        })
      })
    })
  })

  describe("submitMovingFundsProof", () => {
    context("when there is only one input", () => {
      before(async () => {
        await createSnapshot()
      })

      after(async () => {
        walletRegistry.requestNewWallet.reset()

        await restoreSnapshot()
      })

      const testData: {
        testName: string
        data: MovingFundsTestData
      }[] = [
        {
          testName: "when there is a single target wallet",
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

            tx = await runMovingFundsScenario(test.data)
          })

          after(async () => {
            await restoreSnapshot()
          })

          it("should emit MovingFundsCompleted event", async () => {
            await expect(tx).to.emit(bridge, "MovingFundsCompleted")
          })

          it("should refund ETH", async () => {
            const postThirdPartyBalance = await provider.getBalance(
              authorizedMaintainer.address
            )
            const diff = postThirdPartyBalance.sub(
              initialAuthorizedMaintainerBalance
            )

            expect(diff).to.be.gt(0)
            expect(diff).to.be.lt(
              ethers.utils.parseUnits("2000000", "gwei") // 0,002 ETH
            )
          })
        })
      })
    })
  })

  describe("submitMovingFundsCommitment", () => {
    const walletDraft = {
      ecdsaWalletID: ecdsaWalletTestData.walletID,
      mainUtxoHash: ethers.constants.HashZero,
      pendingRedemptionsValue: 0,
      createdAt: 0,
      movingFundsRequestedAt: 0,
      closingStartedAt: 0,
      pendingMovedFundsSweepRequestsCount: 0,
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
        context("when the caller is a member of the source wallet", () => {
          const walletMembersIDs = [1, 2, 3, 4, 5]
          const walletMemberIndex = 2

          let caller: SignerWithAddress

          before(async () => {
            await createSnapshot()

            caller = thirdParty

            await maintainerProxy.connect(governance).authorize(caller.address)

            walletRegistry.isWalletMember
              .whenCalledWith(
                ecdsaWalletTestData.walletID,
                walletMembersIDs,
                maintainerProxy.address,
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
                      const expectedTargetWalletsCount = 3

                      context(
                        "when all target wallets are in the Live state",
                        () => {
                          let tx: ContractTransaction
                          let initCallerBalance: BigNumber

                          const targetWallets = liveWallets.slice(
                            0,
                            expectedTargetWalletsCount
                          )

                          before(async () => {
                            await createSnapshot()

                            initCallerBalance = await provider.getBalance(
                              caller.address
                            )

                            tx = await maintainerProxy
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

                          it("should emit MovingFundsCommitmentSubmitted event", async () => {
                            await expect(tx).to.emit(
                              bridge,
                              "MovingFundsCommitmentSubmitted"
                            )
                          })

                          it("should refund ETH", async () => {
                            const postThirdPartyBalance =
                              await provider.getBalance(caller.address)
                            const diff =
                              postThirdPartyBalance.sub(initCallerBalance)

                            expect(diff).to.be.gt(0)
                            expect(diff).to.be.lt(
                              ethers.utils.parseUnits("1000000", "gwei") // 0,001 ETH
                            )
                          })
                        }
                      )
                    }
                  )
                }
              )
            })
          })
        })
      })
    })
  })

  describe("resetMovingFundsTimeout", () => {
    const walletDraft = {
      ecdsaWalletID: ecdsaWalletTestData.walletID,
      mainUtxoHash: ethers.constants.HashZero,
      pendingRedemptionsValue: 0,
      createdAt: 0,
      movingFundsRequestedAt: 0,
      closingStartedAt: 0,
      pendingMovedFundsSweepRequestsCount: 0,
      state: walletState.Unknown,
      movingFundsTargetWalletsCommitmentHash: ethers.constants.HashZero,
    }

    context("when the wallet is in the MovingFunds state", () => {
      before(async () => {
        await createSnapshot()

        await bridge.setWallet(ecdsaWalletTestData.pubKeyHash160, {
          ...walletDraft,
          state: walletState.MovingFunds,
          movingFundsRequestedAt: (await lastBlockTime()) - 3600,
        })
      })

      after(async () => {
        await restoreSnapshot()
      })

      context("when the wallet's commitment is not submitted yet", () => {
        context("when Live wallets count is zero", () => {
          // No need to do any specific setup. There is only one MovingFunds
          // wallet in the system and its commitment is not yet submitted.
          // All preconditions are met by default.

          let tx: ContractTransaction

          before(async () => {
            await createSnapshot()

            // Set the timestamp of the block that contains the `setWallet` tx.
            await bridge.setWallet(ecdsaWalletTestData.pubKeyHash160, {
              ...(await bridge.wallets(ecdsaWalletTestData.pubKeyHash160)),
              movingFundsRequestedAt: (await lastBlockTime()) + 1,
            })

            await increaseTime(movingFundsTimeoutResetDelay)

            initialAuthorizedMaintainerBalance = await provider.getBalance(
              authorizedMaintainer.address
            )
            tx = await maintainerProxy
              .connect(authorizedMaintainer)
              .resetMovingFundsTimeout(ecdsaWalletTestData.pubKeyHash160)
          })

          after(async () => {
            await restoreSnapshot()
          })

          it("should emit MovingFundsTimeoutReset event", async () => {
            await expect(tx).to.emit(bridge, "MovingFundsTimeoutReset")
          })

          it("should refund ETH", async () => {
            const postThirdPartyBalance = await provider.getBalance(
              authorizedMaintainer.address
            )
            const diff = postThirdPartyBalance.sub(
              initialAuthorizedMaintainerBalance
            )

            expect(diff).to.be.gt(0)
            expect(diff).to.be.lt(
              ethers.utils.parseUnits("1000000", "gwei") // 0,001 ETH
            )
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
      pendingMovedFundsSweepRequestsCount: 0,
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

            initialAuthorizedMaintainerBalance = await provider.getBalance(
              authorizedMaintainer.address
            )

            tx = await maintainerProxy
              .connect(authorizedMaintainer)
              .notifyMovingFundsBelowDust(
                ecdsaWalletTestData.pubKeyHash160,
                mainUtxo
              )
          })

          after(async () => {
            await restoreSnapshot()
          })

          it("should emit MovingFundsBelowDustReported event", async () => {
            await expect(tx).to.emit(bridge, "MovingFundsBelowDustReported")
          })

          it("should refund ETH", async () => {
            const postThirdPartyBalance = await provider.getBalance(
              authorizedMaintainer.address
            )
            const diff = postThirdPartyBalance.sub(
              initialAuthorizedMaintainerBalance
            )

            expect(diff).to.be.gt(0)
            expect(diff).to.be.lt(
              ethers.utils.parseUnits("1000000", "gwei") // 0,001 ETH
            )
          })
        })
      })
    })
  })

  describe("submitMovedFundsSweepProof", () => {
    context("when called by an unauthorized third party", async () => {
      it("should revert", async () => {
        const data: MovedFundsSweepTestData = MovedFundsSweepWithoutMainUtxo
        const tx = maintainerProxy
          .connect(thirdParty)
          .submitMovedFundsSweepProof(
            data.sweepTx,
            data.sweepProof,
            data.mainUtxo
          )
        await expect(tx).to.be.revertedWith("Caller is not authorized")
      })
    })

    context("when transaction proof is valid", () => {
      before(async () => {
        await createSnapshot()
      })

      after(async () => {
        await restoreSnapshot()
      })
      context("when there is only one output", () => {
        context("when sweeping wallet is in the Live state", () => {
          context("when main UTXO data are valid", () => {
            context(
              "when transaction fee does not exceed the sweep transaction maximum fee",
              () => {
                context("when the sweeping wallet has no main UTXO set", () => {
                  context(
                    "when there is a single input referring to a Pending sweep request",
                    () => {
                      const data: MovedFundsSweepTestData =
                        MovedFundsSweepWithoutMainUtxo
                      let tx: ContractTransaction

                      before(async () => {
                        await createSnapshot()

                        tx = await runMovedFundsSweepScenario(data)
                      })

                      after(async () => {
                        await restoreSnapshot()
                      })

                      it("should emit MovedFundsSwept event", async () => {
                        await expect(tx).to.emit(bridge, "MovedFundsSwept")
                      })

                      it("should refund ETH", async () => {
                        const postThirdPartyBalance = await provider.getBalance(
                          authorizedMaintainer.address
                        )
                        const diff = postThirdPartyBalance.sub(
                          initialAuthorizedMaintainerBalance
                        )

                        expect(diff).to.be.gt(0)
                        expect(diff).to.be.lt(
                          ethers.utils.parseUnits("1000000", "gwei") // 0,001 ETH
                        )
                      })
                    }
                  )
                })

                context("when the sweeping wallet has a main UTXO set", () => {
                  context(
                    "when the first input refers to a Pending sweep request and the second input refers to the sweeping wallet main UTXO",
                    () => {
                      const data: MovedFundsSweepTestData =
                        MovedFundsSweepWithMainUtxo

                      let tx: ContractTransaction

                      before(async () => {
                        await createSnapshot()

                        tx = await runMovedFundsSweepScenario(data)
                      })

                      after(async () => {
                        await restoreSnapshot()
                      })

                      it("should emit MovedFundsSwept event", async () => {
                        await expect(tx).to.emit(bridge, "MovedFundsSwept")
                      })

                      it("should refund ETH", async () => {
                        const postThirdPartyBalance = await provider.getBalance(
                          authorizedMaintainer.address
                        )
                        const diff = postThirdPartyBalance.sub(
                          initialAuthorizedMaintainerBalance
                        )

                        expect(diff).to.be.gt(0)
                        expect(diff).to.be.lt(
                          ethers.utils.parseUnits("1000000", "gwei") // 0,001 ETH
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

  describe("notifyWalletClosingPeriodElapsed", () => {
    const walletDraft = {
      ecdsaWalletID: ecdsaWalletTestData.walletID,
      mainUtxoHash: ethers.constants.HashZero,
      pendingRedemptionsValue: 0,
      createdAt: 0,
      movingFundsRequestedAt: 0,
      closingStartedAt: 0,
      pendingMovedFundsSweepRequestsCount: 0,
      state: walletState.Unknown,
      movingFundsTargetWalletsCommitmentHash: ethers.constants.HashZero,
    }

    context("when the wallet is in the Closing state", () => {
      before(async () => {
        await createSnapshot()

        await bridge.setWallet(ecdsaWalletTestData.pubKeyHash160, {
          ...walletDraft,
          state: walletState.Live,
        })

        // Switches the wallet to Closing state because the wallet has
        // no main UTXO set.
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

      context("when closing period has elapsed", () => {
        let tx: ContractTransaction

        before(async () => {
          await createSnapshot()

          await increaseTime(
            (
              await bridge.walletParameters()
            ).walletClosingPeriod
          )

          tx = await maintainerProxy
            .connect(authorizedMaintainer)
            .notifyWalletClosingPeriodElapsed(ecdsaWalletTestData.pubKeyHash160)
        })

        after(async () => {
          await walletRegistry.closeWallet.reset()

          await restoreSnapshot()
        })

        it("should emit WalletClosed event", async () => {
          await expect(tx).to.emit(bridge, "WalletClosed")
        })

        it("should refund ETH", async () => {
          const postMaintainerBalance = await provider.getBalance(
            authorizedMaintainer.address
          )
          const diff = postMaintainerBalance.sub(
            initialAuthorizedMaintainerBalance
          )

          expect(diff).to.be.gt(0)
          expect(diff).to.be.lt(
            ethers.utils.parseUnits("1000000", "gwei") // 0,001 ETH
          )
        })
      })
    })
  })

  describe("defeatFraudChallengeWithHeartbeat", () => {
    let heartbeatWalletPublicKey: string
    let heartbeatWalletSigningKey: SigningKey

    before(async () => {
      await createSnapshot()

      // For `defeatFraudChallengeWithHeartbeat` unit tests we do not use test
      // data from `fraud.ts`. Instead, we create random wallet and use its
      // SigningKey.
      //
      // This approach is better long-term. In case the format of the heartbeat
      // message changes or in case we want to add more unit tests, we can simply
      // call appropriate function to compute another signature. Also, we do not
      // use any BTC-specific data for this set of unit tests.
      const wallet = ethers.Wallet.createRandom()
      // We use `ethers.utils.SigningKey` for a `Wallet` instead of
      // `Signer.signMessage` to do not add '\x19Ethereum Signed Message:\n'
      // prefix to the signed message. The format of the heartbeat message is
      // the same no matter on which host chain TBTC is deployed.
      heartbeatWalletSigningKey = new ethers.utils.SigningKey(wallet.privateKey)
      // Public key obtained as `wallet.publicKey` is an uncompressed key,
      // prefixed with `0x04`. To compute raw ECDSA key, we need to drop `0x04`.
      heartbeatWalletPublicKey = `0x${wallet.publicKey.substring(4)}`

      const walletID = keccak256(heartbeatWalletPublicKey)
      const walletPublicKeyX = `0x${heartbeatWalletPublicKey.substring(2, 66)}`
      const walletPublicKeyY = `0x${heartbeatWalletPublicKey.substring(66)}`
      await bridge
        .connect(walletRegistry.wallet)
        .__ecdsaWalletCreatedCallback(
          walletID,
          walletPublicKeyX,
          walletPublicKeyY
        )
    })

    after(async () => {
      await restoreSnapshot()
    })

    context("when the challenge exists", () => {
      context("when the challenge is open", () => {
        context("when the heartbeat message has correct format", () => {
          const heartbeatMessage = "0xFFFFFFFFFFFFFFFF0000000000E0EED7"
          const heartbeatMessageSha256 = sha256(heartbeatMessage)
          const sighash = sha256(sha256(heartbeatMessage))

          let tx: ContractTransaction

          before(async () => {
            await createSnapshot()

            const signature = ethers.utils.splitSignature(
              heartbeatWalletSigningKey.signDigest(sighash)
            )

            await bridge
              .connect(thirdParty)
              .submitFraudChallenge(
                heartbeatWalletPublicKey,
                heartbeatMessageSha256,
                signature,
                {
                  value: fraudChallengeDepositAmount,
                }
              )

            initialAuthorizedMaintainerBalance = await provider.getBalance(
              authorizedMaintainer.address
            )
            tx = await maintainerProxy
              .connect(authorizedMaintainer)
              .defeatFraudChallengeWithHeartbeat(
                heartbeatWalletPublicKey,
                heartbeatMessage
              )
          })

          after(async () => {
            await restoreSnapshot()
          })

          it("should emit FraudChallengeDefeated event", async () => {
            await expect(tx).to.emit(bridge, "FraudChallengeDefeated")
          })

          it("should refund ETH", async () => {
            const postMaintainerBalance = await provider.getBalance(
              authorizedMaintainer.address
            )
            const diff = postMaintainerBalance.sub(
              initialAuthorizedMaintainerBalance
            )

            expect(diff).to.be.gt(0)
            expect(diff).to.be.lt(
              ethers.utils.parseUnits("1000000", "gwei") // 0,001 ETH
            )
          })
        })
      })
    })
  })

  describe("authorize", () => {
    context("when the caller is not the owner", () => {
      it("should revert", async () => {
        await expect(
          maintainerProxy.connect(thirdParty).authorize(thirdParty.address)
        ).to.be.revertedWith("Ownable: caller is not the owner")
      })
    })

    context("when the caller is the owner", () => {
      let tx: ContractTransaction

      before(async () => {
        await createSnapshot()
        const maintainers = await maintainerProxy.allMaintainers()

        tx = await maintainerProxy
          .connect(governance)
          .authorize(thirdParty.address)
      })

      after(async () => {
        await restoreSnapshot()
      })

      it("should be already populated with the authorized maintainer", async () => {
        expect(
          await maintainerProxy.isAuthorized(authorizedMaintainer.address)
        ).to.be.equal(1)
      })

      it("should authorize a thirdParty", async () => {
        expect(
          await maintainerProxy.isAuthorized(thirdParty.address)
        ).to.be.equal(2)
      })

      it("should be total of 2 authorized maintainers", async () => {
        const maintainers = await maintainerProxy.allMaintainers()
        expect(maintainers.length).to.be.equal(2)
      })

      it("should add a thirdParty to a maintainers list", async () => {
        const contract = await maintainerProxy.maintainers(1)
        expect(contract).to.be.equal(thirdParty.address)
      })

      it("should emit a MaintainerAuthorized event", async () => {
        await expect(tx)
          .to.emit(maintainerProxy, "MaintainerAuthorized")
          .withArgs(thirdParty.address)
      })
    })
  })

  describe("unauthorize", () => {
    before(async () => {
      await createSnapshot()

      await maintainerProxy
        .connect(governance)
        .unauthorize(authorizedMaintainer.address)
    })

    after(async () => {
      await restoreSnapshot()
    })

    context("when the caller is not the owner", () => {
      it("should revert", async () => {
        await expect(
          maintainerProxy.connect(thirdParty).unauthorize(thirdParty.address)
        ).to.be.revertedWith("Ownable: caller is not the owner")
      })
    })

    context("when the caller is the owner", () => {
      it("should be a total of 0 authorized maintainers", async () => {
        const authorizedMaintainers = await maintainerProxy.allMaintainers()
        await expect(authorizedMaintainers.length).to.be.equal(0)
      })

      context("when there are no authorized maintainers", () => {
        before(async () => {
          await createSnapshot()
        })

        after(async () => {
          await restoreSnapshot()
        })

        it("should revert", async () => {
          await expect(
            maintainerProxy.connect(governance).unauthorize(thirdParty.address)
          ).to.be.revertedWith("No maintainer to unauthorize")
        })
      })

      context("when there are authorized maintainers", () => {
        context(
          "when maintainer to unauthorize is not among the authorized maintainers",
          () => {
            before(async () => {
              await createSnapshot()
              const signers = await helpers.signers.getUnnamedSigners()
              const maintainers = [
                signers[1],
                signers[2],
                signers[3],
                signers[4],
                signers[5],
                signers[6],
                signers[7],
                signers[8],
              ]

              for (let i = 0; i < maintainers.length; i++) {
                /* eslint-disable no-await-in-loop */
                await maintainerProxy
                  .connect(governance)
                  .authorize(maintainers[i].address)
              }
            })

            after(async () => {
              await restoreSnapshot()
            })

            it("should revert", async () => {
              await expect(
                maintainerProxy
                  .connect(governance)
                  .unauthorize(governance.address)
              ).to.be.revertedWith("No maintainer to unauthorize")
            })
          }
        )
      })

      context("when there is one authorized maintainer", () => {
        context("when unauthorizing the one that is authorized", () => {
          let tx: ContractTransaction

          before(async () => {
            await createSnapshot()

            await maintainerProxy
              .connect(governance)
              .authorize(thirdParty.address)

            tx = await maintainerProxy
              .connect(governance)
              .unauthorize(thirdParty.address)
          })

          after(async () => {
            await restoreSnapshot()
          })

          it("should unauthorize a contract", async () => {
            expect(
              await maintainerProxy.isAuthorized(thirdParty.address)
            ).to.be.equal(0)
          })

          it("should emit a MaintainerUnauthorized event", async () => {
            await expect(tx)
              .to.emit(maintainerProxy, "MaintainerUnauthorized")
              .withArgs(thirdParty.address)
          })
        })
      })

      context("when there are many authorized maintainers", () => {
        let maintainer1: SignerWithAddress
        let maintainer2: SignerWithAddress
        let maintainer3: SignerWithAddress
        let maintainer4: SignerWithAddress
        let maintainer5: SignerWithAddress
        let maintainer6: SignerWithAddress
        let maintainer7: SignerWithAddress
        let maintainer8: SignerWithAddress

        before(async () => {
          await createSnapshot()
          const signers = await helpers.signers.getUnnamedSigners()
          /* eslint-disable */
          maintainer1 = signers[1]
          maintainer2 = signers[2]
          maintainer3 = signers[3]
          maintainer4 = signers[4]
          maintainer5 = signers[5]
          maintainer6 = signers[6]
          maintainer7 = signers[7]
          maintainer8 = signers[8]
          /* eslint-enable */
          const maintainers = [
            maintainer1,
            maintainer2,
            maintainer3,
            maintainer4,
            maintainer5,
            maintainer6,
            maintainer7,
            maintainer8,
          ]

          for (let i = 0; i < maintainers.length; i++) {
            /* eslint-disable no-await-in-loop */
            await maintainerProxy
              .connect(governance)
              .authorize(maintainers[i].address)
          }
        })

        after(async () => {
          await restoreSnapshot()
        })

        // Init authorized maintainers: [0x1, 0x2, 0x3, 0x4, 0x5, 0x6, 0x7, 0x8]
        // Unauthorize: [0x1, 0x3]
        // Swap the last maintainer with the one to unauthorize
        // New authorized maintainers: [0x8, 0x2, 0x7, 0x4, 0x5, 0x6]
        context(
          "when unauthorizing a couple of maintainers from the beginning",
          () => {
            let tx1: ContractTransaction
            let tx3: ContractTransaction
            before(async () => {
              await createSnapshot()

              tx1 = await maintainerProxy
                .connect(governance)
                .unauthorize(maintainer1.address)

              tx3 = await maintainerProxy
                .connect(governance)
                .unauthorize(maintainer3.address)
            })

            after(async () => {
              await restoreSnapshot()
            })

            it("should unauthorize a maintainer", async () => {
              expect(
                await maintainerProxy.isAuthorized(maintainer1.address)
              ).to.be.equal(0)
            })

            it("should change the last maintainer's index with the unauthorized one", async () => {
              expect(
                await maintainerProxy.isAuthorized(maintainer8.address)
              ).to.be.equal(1)
            })

            it("should unauthorize a contract", async () => {
              expect(
                await maintainerProxy.isAuthorized(maintainer3.address)
              ).to.be.equal(0)
            })

            it("should change the last maintainer's index with the unauthorized one", async () => {
              expect(
                await maintainerProxy.isAuthorized(maintainer7.address)
              ).to.be.equal(3)
            })

            it("should remove 2 maintainers from the maintainers array", async () => {
              const authorizedMaintainers =
                await maintainerProxy.allMaintainers()

              expect(authorizedMaintainers.length).to.be.equal(6)
              const expectedMaintainers = [
                maintainer8.address,
                maintainer2.address,
                maintainer7.address,
                maintainer4.address,
                maintainer5.address,
                maintainer6.address,
              ]

              expect(authorizedMaintainers).to.be.deep.equal(
                expectedMaintainers
              )
            })

            it("should emit a MaintainerUnauthorized event", async () => {
              await expect(tx1)
                .to.emit(maintainerProxy, "MaintainerUnauthorized")
                .withArgs(maintainer1.address)
            })

            it("should emit a MaintainerUnauthorized event", async () => {
              await expect(tx3)
                .to.emit(maintainerProxy, "MaintainerUnauthorized")
                .withArgs(maintainer3.address)
            })
          }
        )

        // Init authorized maintainers: [0x1, 0x2, 0x3, 0x4, 0x5, 0x6, 0x7, 0x8]
        // Unauthorize: [0x3, 0x6]
        // Swap the last maintainer with the one to unauthorize
        // New authorized maintainers: [0x1, 0x2, 0x8, 0x4, 0x5, 0x7]
        context(
          "when unauthorizing a couple of maintainers from the middle",
          () => {
            let tx3: ContractTransaction
            let tx6: ContractTransaction
            before(async () => {
              await createSnapshot()

              tx3 = await maintainerProxy
                .connect(governance)
                .unauthorize(maintainer3.address)

              tx6 = await maintainerProxy
                .connect(governance)
                .unauthorize(maintainer6.address)
            })

            after(async () => {
              await restoreSnapshot()
            })

            it("should unauthorize a maintainer", async () => {
              expect(
                await maintainerProxy.isAuthorized(maintainer3.address)
              ).to.be.equal(0)
            })

            it("should change the last maintainer's index with the unauthorized one", async () => {
              expect(
                await maintainerProxy.isAuthorized(maintainer8.address)
              ).to.be.equal(3)
            })

            it("should unauthorize a contract", async () => {
              expect(
                await maintainerProxy.isAuthorized(maintainer6.address)
              ).to.be.equal(0)
            })

            it("should change the last maintainer's index with the unauthorized one", async () => {
              expect(
                await maintainerProxy.isAuthorized(maintainer7.address)
              ).to.be.equal(6)
            })

            it("should remove 2 maintainers from the maintainers array", async () => {
              const authorizedMaintainers =
                await maintainerProxy.allMaintainers()

              expect(authorizedMaintainers.length).to.be.equal(6)
              const expectedMaintainers = [
                maintainer1.address,
                maintainer2.address,
                maintainer8.address,
                maintainer4.address,
                maintainer5.address,
                maintainer7.address,
              ]

              expect(authorizedMaintainers).to.be.deep.equal(
                expectedMaintainers
              )
            })

            it("should emit a MaintainerUnauthorized event", async () => {
              await expect(tx3)
                .to.emit(maintainerProxy, "MaintainerUnauthorized")
                .withArgs(maintainer3.address)
            })

            it("should emit a MaintainerUnauthorized event", async () => {
              await expect(tx6)
                .to.emit(maintainerProxy, "MaintainerUnauthorized")
                .withArgs(maintainer6.address)
            })
          }
        )

        // Init authorized maintainers: [0x1, 0x2, 0x3, 0x4, 0x5, 0x6, 0x7, 0x8]
        // Unauthorize: [0x5, 0x8]
        // Swap the last maintainer with the one to unauthorize
        // New authorized maintainers: [0x1, 0x2, 0x3, 0x4, 0x7, 0x6]
        context(
          "when unauthorizing a couple of maintainers from the end",
          () => {
            let tx5: ContractTransaction
            let tx8: ContractTransaction
            before(async () => {
              await createSnapshot()

              tx5 = await maintainerProxy
                .connect(governance)
                .unauthorize(maintainer5.address)

              tx8 = await maintainerProxy
                .connect(governance)
                .unauthorize(maintainer8.address)
            })

            after(async () => {
              await restoreSnapshot()
            })

            it("should unauthorize a maintainer", async () => {
              expect(
                await maintainerProxy.isAuthorized(maintainer5.address)
              ).to.be.equal(0)
            })

            it("should unauthorize a contract", async () => {
              expect(
                await maintainerProxy.isAuthorized(maintainer8.address)
              ).to.be.equal(0)
            })

            it("should change the last maintainer's index with the unauthorized one", async () => {
              expect(
                await maintainerProxy.isAuthorized(maintainer7.address)
              ).to.be.equal(5)
            })

            it("should remove 2 maintainers from the maintainers array", async () => {
              const authorizedMaintainers =
                await maintainerProxy.allMaintainers()

              expect(authorizedMaintainers.length).to.be.equal(6)
              const expectedMaintainers = [
                maintainer1.address,
                maintainer2.address,
                maintainer3.address,
                maintainer4.address,
                maintainer7.address,
                maintainer6.address,
              ]

              expect(authorizedMaintainers).to.be.deep.equal(
                expectedMaintainers
              )
            })

            it("should emit a MaintainerUnauthorized event", async () => {
              await expect(tx5)
                .to.emit(maintainerProxy, "MaintainerUnauthorized")
                .withArgs(maintainer5.address)
            })

            it("should emit a MaintainerUnauthorized event", async () => {
              await expect(tx8)
                .to.emit(maintainerProxy, "MaintainerUnauthorized")
                .withArgs(maintainer8.address)
            })
          }
        )
      })
    })
  })

  describe("updateBridge", () => {
    before(async () => {
      await createSnapshot()
    })

    after(async () => {
      await restoreSnapshot()
    })

    context("when called by a third party", () => {
      it("should revert", async () => {
        await expect(
          maintainerProxy.connect(thirdParty).updateBridge(thirdParty.address)
        ).to.be.revertedWith("Ownable: caller is not the owner")
      })
    })

    context("when called by the owner", () => {
      let tx: ContractTransaction

      before(async () => {
        await createSnapshot()
        tx = await maintainerProxy
          .connect(governance)
          .updateBridge(thirdParty.address)
      })

      after(async () => {
        await restoreSnapshot()
      })

      it("should update the bridge", async () => {
        expect(await maintainerProxy.bridge()).to.equal(thirdParty.address)
      })

      it("should emit the BridgeUpdated event", async () => {
        await expect(tx)
          .to.emit(maintainerProxy, "BridgeUpdated")
          .withArgs(thirdParty.address)
      })
    })
  })

  describe("updateGasOffsetParameters", () => {
    before(async () => {
      await createSnapshot()
    })

    after(async () => {
      await restoreSnapshot()
    })

    context("when called by a third party", () => {
      it("should revert", async () => {
        await expect(
          maintainerProxy
            .connect(thirdParty)
            .updateGasOffsetParameters(
              40,
              41,
              42,
              43,
              44,
              45,
              46,
              47,
              48,
              49,
              50,
              51
            )
        ).to.be.revertedWith("Ownable: caller is not the owner")
      })
    })

    context("when called by the owner", () => {
      let tx: ContractTransaction

      before(async () => {
        await createSnapshot()
        tx = await maintainerProxy
          .connect(governance)
          .updateGasOffsetParameters(
            40,
            41,
            42,
            43,
            44,
            45,
            46,
            47,
            48,
            49,
            50,
            51
          )
      })

      after(async () => {
        await restoreSnapshot()
      })

      it("should emit the GasOffsetParametersUpdated event", async () => {
        await expect(tx)
          .to.emit(maintainerProxy, "GasOffsetParametersUpdated")
          .withArgs(40, 41, 42, 43, 44, 45, 46, 47, 48, 49, 50, 51)
      })

      it("should update submitRedemptionProofGasOffset", async () => {
        const updatedOffset =
          await maintainerProxy.submitRedemptionProofGasOffset()
        expect(updatedOffset).to.be.equal(41)
      })

      it("should update submitMovingFundsCommitmentGasOffset", async () => {
        const updatedOffset =
          await maintainerProxy.submitMovingFundsCommitmentGasOffset()
        expect(updatedOffset).to.be.equal(42)
      })

      it("should update resetMovingFundsTimeoutGasOffset", async () => {
        const updatedOffset =
          await maintainerProxy.resetMovingFundsTimeoutGasOffset()
        expect(updatedOffset).to.be.equal(43)
      })

      it("should update submitMovingFundsProofGasOffset", async () => {
        const updatedOffset =
          await maintainerProxy.submitMovingFundsProofGasOffset()
        expect(updatedOffset).to.be.equal(44)
      })

      it("should update notifyMovingFundsBelowDustGasOffset", async () => {
        const updatedOffset =
          await maintainerProxy.notifyMovingFundsBelowDustGasOffset()
        expect(updatedOffset).to.be.equal(45)
      })

      it("should update submitMovedFundsSweepProofGasOffset", async () => {
        const updatedOffset =
          await maintainerProxy.submitMovedFundsSweepProofGasOffset()
        expect(updatedOffset).to.be.equal(46)
      })

      it("should update requestNewWalletGasOffset", async () => {
        const updatedOffset = await maintainerProxy.requestNewWalletGasOffset()
        expect(updatedOffset).to.be.equal(47)
      })

      it("should update notifyWalletCloseableGasOffset", async () => {
        const updatedOffset =
          await maintainerProxy.notifyWalletCloseableGasOffset()
        expect(updatedOffset).to.be.equal(48)
      })

      it("should update notifyWalletClosingPeriodElapsedGasOffset", async () => {
        const updatedOffset =
          await maintainerProxy.notifyWalletClosingPeriodElapsedGasOffset()
        expect(updatedOffset).to.be.equal(49)
      })

      it("should update defeatFraudChallengeGasOffset", async () => {
        const updatedOffset =
          await maintainerProxy.defeatFraudChallengeGasOffset()
        expect(updatedOffset).to.be.equal(50)
      })

      it("should update defeatFraudChallengeWithHeartbeatGasOffset", async () => {
        const updatedOffset =
          await maintainerProxy.defeatFraudChallengeWithHeartbeatGasOffset()
        expect(updatedOffset).to.be.equal(51)
      })
    })
  })

  describe("updateReimbursementPool", () => {
    before(async () => {
      await createSnapshot()
    })

    after(async () => {
      await restoreSnapshot()
    })

    context("when called by a third party", () => {
      it("should revert", async () => {
        await expect(
          maintainerProxy
            .connect(thirdParty)
            .updateReimbursementPool(thirdParty.address)
        ).to.be.revertedWith("Caller is not the owner")
      })
    })

    context("when called by the owner", () => {
      let tx: ContractTransaction

      before(async () => {
        await createSnapshot()
        tx = await maintainerProxy
          .connect(governance)
          .updateReimbursementPool(thirdParty.address)
      })

      after(async () => {
        await restoreSnapshot()
      })

      it("should emit the ReimbursementPoolUpdated event", async () => {
        await expect(tx)
          .to.emit(maintainerProxy, "ReimbursementPoolUpdated")
          .withArgs(thirdParty.address)
      })
    })
  })

  async function makeRedemptionAllowance(
    redeemer: SignerWithAddress,
    amount: BigNumberish
  ): Promise<ContractTransaction> {
    // Simulate the redeemer has a TBTC balance allowing to make the request.
    await bank.setBalance(redeemer.address, amount)
    // Redeemer must allow the Bridge to spent the requested amount.
    return bank
      .connect(redeemer)
      .increaseBalanceAllowance(bridge.address, amount)
  }

  async function runDepositSweepScenario(
    data: DepositSweepTestData,
    beforeProofActions?: () => Promise<void>
  ): Promise<ContractTransaction> {
    relay.getCurrentEpochDifficulty.returns(data.chainDifficulty)
    relay.getPrevEpochDifficulty.returns(data.chainDifficulty)

    for (let i = 0; i < data.deposits.length; i++) {
      const { fundingTx, reveal } = data.deposits[i]
      // eslint-disable-next-line no-await-in-loop
      await bridge.revealDeposit(fundingTx, reveal)
    }

    if (beforeProofActions) {
      await beforeProofActions()
    }

    return maintainerProxy
      .connect(authorizedMaintainer)
      .submitDepositSweepProof(
        data.sweepTx,
        data.sweepProof,
        data.mainUtxo,
        data.vault
      )
      .then((tx: ContractTransaction) => {
        relay.getCurrentEpochDifficulty.reset()
        relay.getPrevEpochDifficulty.reset()

        return tx
      })
  }

  async function runRedemptionScenario(
    data: RedemptionTestData,
    beforeProofActions?: () => Promise<void>
  ): Promise<ContractTransaction> {
    relay.getPrevEpochDifficulty.returns(data.chainDifficulty)
    relay.getCurrentEpochDifficulty.returns(data.chainDifficulty)

    // Scaling down deposit dust threshold 100x to what is in Bridge default
    // parameters. Scaling down redemption TX max fee accordingly.
    await bridge.setRedemptionDustThreshold(10000)
    await bridge.setRedemptionTxMaxFee(1000)

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
        value: 100,
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

    return maintainerProxy
      .connect(authorizedMaintainer)
      .submitRedemptionProof(
        data.redemptionTx,
        data.redemptionProof,
        data.mainUtxo,
        data.wallet.pubKeyHash
      )
      .then((tx: ContractTransaction) => {
        relay.getCurrentEpochDifficulty.reset()
        relay.getPrevEpochDifficulty.reset()

        return tx
      })
  }

  async function runMovingFundsScenario(
    data: MovingFundsTestData,
    beforeProofActions?: () => Promise<void>
  ): Promise<ContractTransaction> {
    relay.getPrevEpochDifficulty.returns(data.chainDifficulty)
    relay.getCurrentEpochDifficulty.returns(data.chainDifficulty)

    // Simulate the wallet is a registered one.
    await bridge.setWallet(data.wallet.pubKeyHash, {
      ecdsaWalletID: data.wallet.ecdsaWalletID,
      mainUtxoHash: ethers.constants.HashZero,
      pendingRedemptionsValue: 0,
      createdAt: await lastBlockTime(),
      movingFundsRequestedAt: await lastBlockTime(),
      closingStartedAt: 0,
      pendingMovedFundsSweepRequestsCount: 0,
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

    return maintainerProxy
      .connect(authorizedMaintainer)
      .submitMovingFundsProof(
        data.movingFundsTx,
        data.movingFundsProof,
        data.mainUtxo,
        data.wallet.pubKeyHash
      )
      .then((tx: ContractTransaction) => {
        relay.getCurrentEpochDifficulty.reset()
        relay.getPrevEpochDifficulty.reset()

        return tx
      })
  }

  async function runMovedFundsSweepScenario(
    data: MovedFundsSweepTestData,
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
      movingFundsRequestedAt: 0,
      closingStartedAt: 0,
      pendingMovedFundsSweepRequestsCount: 0,
      state: data.wallet.state,
      movingFundsTargetWalletsCommitmentHash: ethers.constants.HashZero,
    })

    if (data.mainUtxo.txHash !== ethers.constants.HashZero) {
      // Simulate the prepared main UTXO belongs to the wallet.
      await bridge.setWalletMainUtxo(data.wallet.pubKeyHash, data.mainUtxo)
    }

    if (data.movedFundsSweepRequest) {
      await bridge.setPendingMovedFundsSweepRequest(
        data.movedFundsSweepRequest.walletPubKeyHash,
        data.movedFundsSweepRequest
      )
      // Just make sure the stub function `setPendingMovedFundsSweepRequest`
      // initialized the counter properly.
      assert(
        (await bridge.wallets(data.movedFundsSweepRequest.walletPubKeyHash))
          .pendingMovedFundsSweepRequestsCount === 1,
        "Pending moved funds request counter for the sweeping wallet should be set up to 1"
      )
    }

    if (beforeProofActions) {
      await beforeProofActions()
    }

    return maintainerProxy
      .connect(authorizedMaintainer)
      .submitMovedFundsSweepProof(data.sweepTx, data.sweepProof, data.mainUtxo)
      .then((tx: ContractTransaction) => {
        relay.getCurrentEpochDifficulty.reset()
        relay.getPrevEpochDifficulty.reset()

        return tx
      })
  }
})
