import { helpers, waffle, ethers } from "hardhat"
import { SignerWithAddress } from "@nomiclabs/hardhat-ethers/signers"
import { expect } from "chai"
import { ContractTransaction, BigNumber } from "ethers"
import type { BridgeGovernance, Bridge } from "../../typechain"
import { constants } from "../fixtures"
import bridgeFixture from "../fixtures/bridge"

const { createSnapshot, restoreSnapshot } = helpers.snapshot

describe("Bridge - Governance", () => {
  let governance: SignerWithAddress
  let thirdParty: SignerWithAddress
  let bridgeGovernance: BridgeGovernance
  let bridge: Bridge

  before(async () => {
    // eslint-disable-next-line @typescript-eslint/no-extra-semi
    ;({ governance, thirdParty, bridgeGovernance, bridge } =
      await waffle.loadFixture(bridgeFixture))
  })

  describe("beginGovernanceDelayUpdate", () => {
    context("when the caller is not the owner", () => {
      it("should revert", async () => {
        await expect(
          bridgeGovernance.connect(thirdParty).beginGovernanceDelayUpdate(1)
        ).to.be.revertedWith("Ownable: caller is not the owner")
      })
    })

    context("when the caller is the owner", () => {
      let tx: ContractTransaction

      before(async () => {
        await createSnapshot()

        tx = await bridgeGovernance
          .connect(governance)
          .beginGovernanceDelayUpdate(1337)
      })

      after(async () => {
        await restoreSnapshot()
      })

      it("should not update the governance delay", async () => {
        expect(await bridgeGovernance.governanceDelays(0)).to.be.equal(
          constants.governanceDelay
        )
      })

      it("should start the governance delay timer", async () => {
        const blockTimestamp = (await ethers.provider.getBlock(tx.blockNumber))
          .timestamp
        const initTimestamp = await bridgeGovernance.governanceDelays(2)
        const elapsedTime = BigNumber.from(blockTimestamp).sub(initTimestamp)

        expect(
          BigNumber.from(constants.governanceDelay).sub(elapsedTime)
        ).to.be.equal(constants.governanceDelay)
      })

      it("should emit GovernanceDelayUpdateStarted event", async () => {
        const blockTimestamp = (await ethers.provider.getBlock(tx.blockNumber))
          .timestamp
        await expect(tx)
          .to.emit(bridgeGovernance, "GovernanceDelayUpdateStarted")
          .withArgs(1337, blockTimestamp)
      })
    })
  })

  describe("finalizeGovernanceDelayUpdate", () => {
    context("when the caller is not the owner", () => {
      it("should revert", async () => {
        await expect(
          bridgeGovernance.connect(thirdParty).finalizeGovernanceDelayUpdate()
        ).to.be.revertedWith("Ownable: caller is not the owner")
      })
    })

    context("when the update process is not initialized", () => {
      it("should revert", async () => {
        await expect(
          bridgeGovernance.connect(governance).finalizeGovernanceDelayUpdate()
        ).to.be.revertedWith("Change not initiated")
      })
    })

    context("when the governance delay has not passed", () => {
      before(async () => {
        await createSnapshot()

        await bridgeGovernance
          .connect(governance)
          .beginGovernanceDelayUpdate(7331)

        await helpers.time.increaseTime(constants.governanceDelay - 60) // -1min
      })

      after(async () => {
        await restoreSnapshot()
      })

      it("should revert", async () => {
        await expect(
          bridgeGovernance.connect(governance).finalizeGovernanceDelayUpdate()
        ).to.be.revertedWith("Governance delay has not elapsed")
      })
    })

    context(
      "when the update process is initialized and governance delay passed",
      () => {
        let tx: ContractTransaction

        before(async () => {
          await createSnapshot()

          await bridgeGovernance
            .connect(governance)
            .beginGovernanceDelayUpdate(7331)

          await helpers.time.increaseTime(constants.governanceDelay)

          tx = await bridgeGovernance
            .connect(governance)
            .finalizeGovernanceDelayUpdate()
        })

        after(async () => {
          await restoreSnapshot()
        })

        it("should update the governance delay", async () => {
          expect(await bridgeGovernance.governanceDelays(0)).to.be.equal(7331)
        })

        it("should emit GovernanceDelayUpdated event", async () => {
          await expect(tx)
            .to.emit(bridgeGovernance, "GovernanceDelayUpdated")
            .withArgs(7331)
        })

        it("should reset the governance delay timer", async () => {
          await expect(await bridgeGovernance.governanceDelays(2)).to.be.equal(
            0
          )
        })
      }
    )
  })

  describe("beginBridgeGovernanceTransfer", () => {
    context("when the caller is not the owner", () => {
      it("should revert", async () => {
        await expect(
          bridgeGovernance
            .connect(thirdParty)
            .beginBridgeGovernanceTransfer(thirdParty.address)
        ).to.be.revertedWith("Ownable: caller is not the owner")
      })
    })

    context("when the caller is the owner", () => {
      let tx: ContractTransaction

      before(async () => {
        await createSnapshot()

        tx = await bridgeGovernance
          .connect(governance)
          .beginBridgeGovernanceTransfer(thirdParty.address)
      })

      after(async () => {
        await restoreSnapshot()
      })

      it("should not update the bridge governance transfer", async () => {
        expect(await bridgeGovernance.owner()).to.be.equal(governance.address)
      })

      it("should start the bridge governance transfer timer", async () => {
        const blockTimestamp = (await ethers.provider.getBlock(tx.blockNumber))
          .timestamp
        const initTimestamp = (await tx.wait()).events[0].args.timestamp
        const elapsedTime = BigNumber.from(blockTimestamp).sub(initTimestamp)

        expect(
          BigNumber.from(constants.governanceDelay).sub(elapsedTime)
        ).to.be.equal(constants.governanceDelay)
      })

      it("should emit BridgeGovernanceTransferStarted event", async () => {
        const blockTimestamp = (await ethers.provider.getBlock(tx.blockNumber))
          .timestamp
        await expect(tx)
          .to.emit(bridgeGovernance, "BridgeGovernanceTransferStarted")
          .withArgs(thirdParty.address, blockTimestamp)
      })
    })
  })

  describe("finalizeBridgeGovernanceTransfer", () => {
    context("when the caller is not the owner", () => {
      it("should revert", async () => {
        await expect(
          bridgeGovernance
            .connect(thirdParty)
            .finalizeBridgeGovernanceTransfer()
        ).to.be.revertedWith("Ownable: caller is not the owner")
      })
    })

    context("when the update process is not initialized", () => {
      it("should revert", async () => {
        await expect(
          bridgeGovernance
            .connect(governance)
            .finalizeBridgeGovernanceTransfer()
        ).to.be.revertedWith("Change not initiated")
      })
    })

    context("when the bridge governance transfer has not passed", () => {
      before(async () => {
        await createSnapshot()

        await bridgeGovernance
          .connect(governance)
          .beginBridgeGovernanceTransfer(thirdParty.address)

        await helpers.time.increaseTime(constants.governanceDelay - 60) // -1min
      })

      after(async () => {
        await restoreSnapshot()
      })

      it("should revert", async () => {
        await expect(
          bridgeGovernance
            .connect(governance)
            .finalizeBridgeGovernanceTransfer()
        ).to.be.revertedWith("Governance delay has not elapsed")
      })
    })

    context(
      "when the update process is initialized and governance delay passed",
      () => {
        let tx: ContractTransaction

        before(async () => {
          await createSnapshot()

          await bridgeGovernance
            .connect(governance)
            .beginBridgeGovernanceTransfer(thirdParty.address)

          await helpers.time.increaseTime(constants.governanceDelay)

          tx = await bridgeGovernance
            .connect(governance)
            .finalizeBridgeGovernanceTransfer()
        })

        after(async () => {
          await restoreSnapshot()
        })

        it("should update the bridge governance transfer", async () => {
          expect(await bridge.governance()).to.be.equal(thirdParty.address)
        })

        it("should emit BridgeGovernanceTransferred event", async () => {
          await expect(tx)
            .to.emit(bridgeGovernance, "BridgeGovernanceTransferred")
            .withArgs(thirdParty.address)
        })

        it("should reset the bridge governance transfer timer", async () => {
          await expect(
            await bridgeGovernance.bridgeGovernanceTransferChangeInitiated()
          ).to.be.equal(0)
        })
      }
    )
  })

  describe("beginDepositDustThresholdUpdate", () => {
    context("when the caller is not the owner", () => {
      it("should revert", async () => {
        await expect(
          bridgeGovernance
            .connect(thirdParty)
            .beginDepositDustThresholdUpdate(1)
        ).to.be.revertedWith("Ownable: caller is not the owner")
      })
    })

    context("when the caller is the owner", () => {
      let tx: ContractTransaction

      before(async () => {
        await createSnapshot()

        tx = await bridgeGovernance
          .connect(governance)
          .beginDepositDustThresholdUpdate(1337)
      })

      after(async () => {
        await restoreSnapshot()
      })

      it("should not update the deposit dust threshold", async () => {
        const { depositDustThreshold } = await bridge.depositParameters()
        expect(depositDustThreshold).to.be.equal(constants.depositDustThreshold)
      })

      it("should start the deposit dust threshold timer", async () => {
        const blockTimestamp = (await ethers.provider.getBlock(tx.blockNumber))
          .timestamp
        const initTimestamp = (await tx.wait()).events[0].args.timestamp
        const elapsedTime = BigNumber.from(blockTimestamp).sub(initTimestamp)

        expect(
          BigNumber.from(constants.governanceDelay).sub(elapsedTime)
        ).to.be.equal(constants.governanceDelay)
      })

      it("should emit DepositDustThresholdUpdateStarted event", async () => {
        const blockTimestamp = (await ethers.provider.getBlock(tx.blockNumber))
          .timestamp
        await expect(tx)
          .to.emit(bridgeGovernance, "DepositDustThresholdUpdateStarted")
          .withArgs(1337, blockTimestamp)
      })
    })
  })

  describe("finalizeDepositDustThresholdUpdate", () => {
    context("when the caller is not the owner", () => {
      it("should revert", async () => {
        await expect(
          bridgeGovernance
            .connect(thirdParty)
            .finalizeDepositDustThresholdUpdate()
        ).to.be.revertedWith("Ownable: caller is not the owner")
      })
    })

    context("when the update process is not initialized", () => {
      it("should revert", async () => {
        await expect(
          bridgeGovernance
            .connect(governance)
            .finalizeDepositDustThresholdUpdate()
        ).to.be.revertedWith("Deposit dust threshold must be greater than zero")
      })
    })

    context("when the deposit dust threshold has not passed", () => {
      before(async () => {
        await createSnapshot()

        await bridgeGovernance
          .connect(governance)
          .beginDepositDustThresholdUpdate(7331)

        await helpers.time.increaseTime(constants.governanceDelay - 60) // -1min
      })

      after(async () => {
        await restoreSnapshot()
      })

      it("should revert", async () => {
        await expect(
          bridgeGovernance
            .connect(governance)
            .finalizeDepositDustThresholdUpdate()
        ).to.be.revertedWith("Governance delay has not elapsed")
      })
    })

    context(
      "when the update process is initialized and governance delay passed",
      () => {
        let tx: ContractTransaction

        before(async () => {
          await createSnapshot()

          await bridgeGovernance
            .connect(governance)
            .beginDepositDustThresholdUpdate(7331)

          await helpers.time.increaseTime(constants.governanceDelay)

          tx = await bridgeGovernance
            .connect(governance)
            .finalizeDepositDustThresholdUpdate()
        })

        after(async () => {
          await restoreSnapshot()
        })

        it("should update the deposit dust threshold", async () => {
          const { depositDustThreshold } = await bridge.depositParameters()
          expect(depositDustThreshold).to.be.equal(7331)
        })

        it("should emitDepositDustThresholdUpdated event", async () => {
          await expect(tx)
            .to.emit(bridgeGovernance, "DepositDustThresholdUpdated")
            .withArgs(7331)
        })
      }
    )
  })

  describe("beginDepositTreasuryFeeDivisorUpdate", () => {
    context("when the caller is not the owner", () => {
      it("should revert", async () => {
        await expect(
          bridgeGovernance
            .connect(thirdParty)
            .beginDepositTreasuryFeeDivisorUpdate(1)
        ).to.be.revertedWith("Ownable: caller is not the owner")
      })
    })

    context("when the caller is the owner", () => {
      let tx: ContractTransaction

      before(async () => {
        await createSnapshot()

        tx = await bridgeGovernance
          .connect(governance)
          .beginDepositTreasuryFeeDivisorUpdate(1337)
      })

      after(async () => {
        await restoreSnapshot()
      })

      it("should not update the deposit treasury fee divisor", async () => {
        const { depositTreasuryFeeDivisor } = await bridge.depositParameters()
        expect(depositTreasuryFeeDivisor).to.be.equal(
          constants.depositTreasuryFeeDivisor
        )
      })

      it("should start the deposit treasury fee divisor timer", async () => {
        const blockTimestamp = (await ethers.provider.getBlock(tx.blockNumber))
          .timestamp
        const initTimestamp = (await tx.wait()).events[0].args.timestamp
        const elapsedTime = BigNumber.from(blockTimestamp).sub(initTimestamp)

        expect(
          BigNumber.from(constants.governanceDelay).sub(elapsedTime)
        ).to.be.equal(constants.governanceDelay)
      })

      it("should emit DepositTreasuryFeeDivisorUpdateStarted event", async () => {
        const blockTimestamp = (await ethers.provider.getBlock(tx.blockNumber))
          .timestamp
        await expect(tx)
          .to.emit(bridgeGovernance, "DepositTreasuryFeeDivisorUpdateStarted")
          .withArgs(1337, blockTimestamp)
      })
    })
  })

  describe("finalizeDepositTreasuryFeeDivisorUpdate", () => {
    context("when the caller is not the owner", () => {
      it("should revert", async () => {
        await expect(
          bridgeGovernance
            .connect(thirdParty)
            .finalizeDepositTreasuryFeeDivisorUpdate()
        ).to.be.revertedWith("Ownable: caller is not the owner")
      })
    })

    context("when the update process is not initialized", () => {
      it("should revert", async () => {
        await expect(
          bridgeGovernance
            .connect(governance)
            .finalizeDepositTreasuryFeeDivisorUpdate()
        ).to.be.revertedWith(
          "Deposit treasury fee divisor must be greater than zero"
        )
      })
    })

    context("when the deposit treasury fee divisor has not passed", () => {
      before(async () => {
        await createSnapshot()

        await bridgeGovernance
          .connect(governance)
          .beginDepositTreasuryFeeDivisorUpdate(7331)

        await helpers.time.increaseTime(constants.governanceDelay - 60) // -1min
      })

      after(async () => {
        await restoreSnapshot()
      })

      it("should revert", async () => {
        await expect(
          bridgeGovernance
            .connect(governance)
            .finalizeDepositTreasuryFeeDivisorUpdate()
        ).to.be.revertedWith("Governance delay has not elapsed")
      })
    })

    context(
      "when the update process is initialized and governance delay passed",
      () => {
        let tx: ContractTransaction

        before(async () => {
          await createSnapshot()

          await bridgeGovernance
            .connect(governance)
            .beginDepositTreasuryFeeDivisorUpdate(7331)

          await helpers.time.increaseTime(constants.governanceDelay)

          tx = await bridgeGovernance
            .connect(governance)
            .finalizeDepositTreasuryFeeDivisorUpdate()
        })

        after(async () => {
          await restoreSnapshot()
        })

        it("should update the deposit treasury fee divisor", async () => {
          const { depositTreasuryFeeDivisor } = await bridge.depositParameters()
          expect(depositTreasuryFeeDivisor).to.be.equal(7331)
        })

        it("should emitDepositTreasuryFeeDivisorUpdated event", async () => {
          await expect(tx)
            .to.emit(bridgeGovernance, "DepositTreasuryFeeDivisorUpdated")
            .withArgs(7331)
        })
      }
    )
  })

  describe("beginDepositTxMaxFeeUpdate", () => {
    context("when the caller is not the owner", () => {
      it("should revert", async () => {
        await expect(
          bridgeGovernance.connect(thirdParty).beginDepositTxMaxFeeUpdate(1)
        ).to.be.revertedWith("Ownable: caller is not the owner")
      })
    })

    context("when the caller is the owner", () => {
      let tx: ContractTransaction

      before(async () => {
        await createSnapshot()

        tx = await bridgeGovernance
          .connect(governance)
          .beginDepositTxMaxFeeUpdate(1337)
      })

      after(async () => {
        await restoreSnapshot()
      })

      it("should not update the deposit tx max fee", async () => {
        const { depositTxMaxFee } = await bridge.depositParameters()
        expect(depositTxMaxFee).to.be.equal(constants.depositTxMaxFee)
      })

      it("should start the deposit tx max fee timer", async () => {
        const blockTimestamp = (await ethers.provider.getBlock(tx.blockNumber))
          .timestamp
        const initTimestamp = (await tx.wait()).events[0].args.timestamp
        const elapsedTime = BigNumber.from(blockTimestamp).sub(initTimestamp)

        expect(
          BigNumber.from(constants.governanceDelay).sub(elapsedTime)
        ).to.be.equal(constants.governanceDelay)
      })

      it("should emit DepositTxMaxFeeUpdateStarted event", async () => {
        const blockTimestamp = (await ethers.provider.getBlock(tx.blockNumber))
          .timestamp
        await expect(tx)
          .to.emit(bridgeGovernance, "DepositTxMaxFeeUpdateStarted")
          .withArgs(1337, blockTimestamp)
      })
    })
  })

  describe("finalizeDepositTxMaxFeeUpdate", () => {
    context("when the caller is not the owner", () => {
      it("should revert", async () => {
        await expect(
          bridgeGovernance.connect(thirdParty).finalizeDepositTxMaxFeeUpdate()
        ).to.be.revertedWith("Ownable: caller is not the owner")
      })
    })

    context("when the update process is not initialized", () => {
      it("should revert", async () => {
        await expect(
          bridgeGovernance.connect(governance).finalizeDepositTxMaxFeeUpdate()
        ).to.be.revertedWith(
          "Deposit transaction max fee must be greater than zero"
        )
      })
    })

    context("when the deposit tx max fee has not passed", () => {
      before(async () => {
        await createSnapshot()

        await bridgeGovernance
          .connect(governance)
          .beginDepositTxMaxFeeUpdate(7331)

        await helpers.time.increaseTime(constants.governanceDelay - 60) // -1min
      })

      after(async () => {
        await restoreSnapshot()
      })

      it("should revert", async () => {
        await expect(
          bridgeGovernance.connect(governance).finalizeDepositTxMaxFeeUpdate()
        ).to.be.revertedWith("Governance delay has not elapsed")
      })
    })

    context(
      "when the update process is initialized and governance delay passed",
      () => {
        let tx: ContractTransaction

        before(async () => {
          await createSnapshot()

          await bridgeGovernance
            .connect(governance)
            .beginDepositTxMaxFeeUpdate(7331)

          await helpers.time.increaseTime(constants.governanceDelay)

          tx = await bridgeGovernance
            .connect(governance)
            .finalizeDepositTxMaxFeeUpdate()
        })

        after(async () => {
          await restoreSnapshot()
        })

        it("should update the deposit tx max fee", async () => {
          const { depositTxMaxFee } = await bridge.depositParameters()
          expect(depositTxMaxFee).to.be.equal(7331)
        })

        it("should emitDepositTxMaxFeeUpdated event", async () => {
          await expect(tx)
            .to.emit(bridgeGovernance, "DepositTxMaxFeeUpdated")
            .withArgs(7331)
        })
      }
    )
  })

  describe("beginRedemptionDustThresholdUpdate", () => {
    context("when the caller is not the owner", () => {
      it("should revert", async () => {
        await expect(
          bridgeGovernance
            .connect(thirdParty)
            .beginRedemptionDustThresholdUpdate(1)
        ).to.be.revertedWith("Ownable: caller is not the owner")
      })
    })

    context("when the caller is the owner", () => {
      let tx: ContractTransaction

      before(async () => {
        await createSnapshot()

        tx = await bridgeGovernance
          .connect(governance)
          .beginRedemptionDustThresholdUpdate(1337)
      })

      after(async () => {
        await restoreSnapshot()
      })

      it("should not update the redemption dust threshold", async () => {
        const { redemptionDustThreshold } = await bridge.redemptionParameters()
        expect(redemptionDustThreshold).to.be.equal(
          constants.redemptionDustThreshold
        )
      })

      it("should start the redemption dust threshold timer", async () => {
        const blockTimestamp = (await ethers.provider.getBlock(tx.blockNumber))
          .timestamp
        const initTimestamp = (await tx.wait()).events[0].args.timestamp
        const elapsedTime = BigNumber.from(blockTimestamp).sub(initTimestamp)

        expect(
          BigNumber.from(constants.governanceDelay).sub(elapsedTime)
        ).to.be.equal(constants.governanceDelay)
      })

      it("should emit RedemptionDustThresholdUpdateStarted event", async () => {
        const blockTimestamp = (await ethers.provider.getBlock(tx.blockNumber))
          .timestamp
        await expect(tx)
          .to.emit(bridgeGovernance, "RedemptionDustThresholdUpdateStarted")
          .withArgs(1337, blockTimestamp)
      })
    })
  })

  describe("finalizeRedemptionDustThresholdUpdate", () => {
    context("when the caller is not the owner", () => {
      it("should revert", async () => {
        await expect(
          bridgeGovernance
            .connect(thirdParty)
            .finalizeRedemptionDustThresholdUpdate()
        ).to.be.revertedWith("Ownable: caller is not the owner")
      })
    })

    context("when the update process is not initialized", () => {
      it("should revert", async () => {
        await expect(
          bridgeGovernance
            .connect(governance)
            .finalizeRedemptionDustThresholdUpdate()
        ).to.be.revertedWith(
          "Redemption dust threshold must be greater than moving funds dust threshold"
        )
      })
    })

    context("when the redemption dust threshold has not passed", () => {
      before(async () => {
        await createSnapshot()

        await bridgeGovernance
          .connect(governance)
          .beginRedemptionDustThresholdUpdate(
            constants.redemptionDustThreshold + 1
          )

        await helpers.time.increaseTime(constants.governanceDelay - 60) // -1min
      })

      after(async () => {
        await restoreSnapshot()
      })

      it("should revert", async () => {
        await expect(
          bridgeGovernance
            .connect(governance)
            .finalizeRedemptionDustThresholdUpdate()
        ).to.be.revertedWith("Governance delay has not elapsed")
      })
    })

    context(
      "when the update process is initialized and governance delay passed",
      () => {
        let tx: ContractTransaction

        before(async () => {
          await createSnapshot()

          await bridgeGovernance
            .connect(governance)
            .beginRedemptionDustThresholdUpdate(
              constants.depositDustThreshold + 1
            )

          await helpers.time.increaseTime(constants.governanceDelay)

          tx = await bridgeGovernance
            .connect(governance)
            .finalizeRedemptionDustThresholdUpdate()
        })

        after(async () => {
          await restoreSnapshot()
        })

        it("should update the redemption dust threshold", async () => {
          const { redemptionDustThreshold } =
            await bridge.redemptionParameters()
          expect(redemptionDustThreshold).to.be.equal(
            constants.depositDustThreshold + 1
          )
        })

        it("should emitRedemptionDustThresholdUpdated event", async () => {
          await expect(tx)
            .to.emit(bridgeGovernance, "RedemptionDustThresholdUpdated")
            .withArgs(constants.depositDustThreshold + 1)
        })
      }
    )
  })

  describe("beginRedemptionTreasuryFeeDivisorUpdate", () => {
    context("when the caller is not the owner", () => {
      it("should revert", async () => {
        await expect(
          bridgeGovernance
            .connect(thirdParty)
            .beginRedemptionTreasuryFeeDivisorUpdate(1)
        ).to.be.revertedWith("Ownable: caller is not the owner")
      })
    })

    context("when the caller is the owner", () => {
      let tx: ContractTransaction

      before(async () => {
        await createSnapshot()

        tx = await bridgeGovernance
          .connect(governance)
          .beginRedemptionTreasuryFeeDivisorUpdate(1337)
      })

      after(async () => {
        await restoreSnapshot()
      })

      it("should not update the redemption treasury fee divisor", async () => {
        const { redemptionTreasuryFeeDivisor } =
          await bridge.redemptionParameters()
        expect(redemptionTreasuryFeeDivisor).to.be.equal(
          constants.redemptionTreasuryFeeDivisor
        )
      })

      it("should start the redemption treasury fee divisor timer", async () => {
        const blockTimestamp = (await ethers.provider.getBlock(tx.blockNumber))
          .timestamp
        const initTimestamp = (await tx.wait()).events[0].args.timestamp
        const elapsedTime = BigNumber.from(blockTimestamp).sub(initTimestamp)

        expect(
          BigNumber.from(constants.governanceDelay).sub(elapsedTime)
        ).to.be.equal(constants.governanceDelay)
      })

      it("should emit RedemptionTreasuryFeeDivisorUpdateStarted event", async () => {
        const blockTimestamp = (await ethers.provider.getBlock(tx.blockNumber))
          .timestamp
        await expect(tx)
          .to.emit(
            bridgeGovernance,
            "RedemptionTreasuryFeeDivisorUpdateStarted"
          )
          .withArgs(1337, blockTimestamp)
      })
    })
  })

  describe("finalizeRedemptionTreasuryFeeDivisorUpdate", () => {
    context("when the caller is not the owner", () => {
      it("should revert", async () => {
        await expect(
          bridgeGovernance
            .connect(thirdParty)
            .finalizeRedemptionTreasuryFeeDivisorUpdate()
        ).to.be.revertedWith("Ownable: caller is not the owner")
      })
    })

    context("when the update process is not initialized", () => {
      it("should revert", async () => {
        await expect(
          bridgeGovernance
            .connect(governance)
            .finalizeRedemptionTreasuryFeeDivisorUpdate()
        ).to.be.revertedWith(
          "Redemption treasury fee divisor must be greater than zero"
        )
      })
    })

    context("when the redemption treasury fee divisor has not passed", () => {
      before(async () => {
        await createSnapshot()

        await bridgeGovernance
          .connect(governance)
          .beginRedemptionTreasuryFeeDivisorUpdate(7331)

        await helpers.time.increaseTime(constants.governanceDelay - 60) // -1min
      })

      after(async () => {
        await restoreSnapshot()
      })

      it("should revert", async () => {
        await expect(
          bridgeGovernance
            .connect(governance)
            .finalizeRedemptionTreasuryFeeDivisorUpdate()
        ).to.be.revertedWith("Governance delay has not elapsed")
      })
    })

    context(
      "when the update process is initialized and governance delay passed",
      () => {
        let tx: ContractTransaction

        before(async () => {
          await createSnapshot()

          await bridgeGovernance
            .connect(governance)
            .beginRedemptionTreasuryFeeDivisorUpdate(7331)

          await helpers.time.increaseTime(constants.governanceDelay)

          tx = await bridgeGovernance
            .connect(governance)
            .finalizeRedemptionTreasuryFeeDivisorUpdate()
        })

        after(async () => {
          await restoreSnapshot()
        })

        it("should update the redemption treasury fee divisor", async () => {
          const { redemptionTreasuryFeeDivisor } =
            await bridge.redemptionParameters()
          expect(redemptionTreasuryFeeDivisor).to.be.equal(7331)
        })

        it("should emitRedemptionTreasuryFeeDivisorUpdated event", async () => {
          await expect(tx)
            .to.emit(bridgeGovernance, "RedemptionTreasuryFeeDivisorUpdated")
            .withArgs(7331)
        })
      }
    )
  })

  describe("beginRedemptionTimeoutUpdate", () => {
    context("when the caller is not the owner", () => {
      it("should revert", async () => {
        await expect(
          bridgeGovernance.connect(thirdParty).beginRedemptionTimeoutUpdate(1)
        ).to.be.revertedWith("Ownable: caller is not the owner")
      })
    })

    context("when the caller is the owner", () => {
      let tx: ContractTransaction

      before(async () => {
        await createSnapshot()

        tx = await bridgeGovernance
          .connect(governance)
          .beginRedemptionTimeoutUpdate(1337)
      })

      after(async () => {
        await restoreSnapshot()
      })

      it("should not update the redemption timeout", async () => {
        const { redemptionTimeout } = await bridge.redemptionParameters()
        expect(redemptionTimeout).to.be.equal(constants.redemptionTimeout)
      })

      it("should start the redemption timeout timer", async () => {
        const blockTimestamp = (await ethers.provider.getBlock(tx.blockNumber))
          .timestamp
        const initTimestamp = (await tx.wait()).events[0].args.timestamp
        const elapsedTime = BigNumber.from(blockTimestamp).sub(initTimestamp)

        expect(
          BigNumber.from(constants.governanceDelay).sub(elapsedTime)
        ).to.be.equal(constants.governanceDelay)
      })

      it("should emit RedemptionTimeoutUpdateStarted event", async () => {
        const blockTimestamp = (await ethers.provider.getBlock(tx.blockNumber))
          .timestamp
        await expect(tx)
          .to.emit(bridgeGovernance, "RedemptionTimeoutUpdateStarted")
          .withArgs(1337, blockTimestamp)
      })
    })
  })

  describe("finalizeRedemptionTimeoutUpdate", () => {
    context("when the caller is not the owner", () => {
      it("should revert", async () => {
        await expect(
          bridgeGovernance.connect(thirdParty).finalizeRedemptionTimeoutUpdate()
        ).to.be.revertedWith("Ownable: caller is not the owner")
      })
    })

    context("when the update process is not initialized", () => {
      it("should revert", async () => {
        await expect(
          bridgeGovernance.connect(governance).finalizeRedemptionTimeoutUpdate()
        ).to.be.revertedWith("Redemption timeout must be greater than zero")
      })
    })

    context("when the redemption timeout has not passed", () => {
      before(async () => {
        await createSnapshot()

        await bridgeGovernance
          .connect(governance)
          .beginRedemptionTimeoutUpdate(7331)

        await helpers.time.increaseTime(constants.governanceDelay - 60) // -1min
      })

      after(async () => {
        await restoreSnapshot()
      })

      it("should revert", async () => {
        await expect(
          bridgeGovernance.connect(governance).finalizeRedemptionTimeoutUpdate()
        ).to.be.revertedWith("Governance delay has not elapsed")
      })
    })

    context(
      "when the update process is initialized and governance delay passed",
      () => {
        let tx: ContractTransaction

        before(async () => {
          await createSnapshot()

          await bridgeGovernance
            .connect(governance)
            .beginRedemptionTimeoutUpdate(7331)

          await helpers.time.increaseTime(constants.governanceDelay)

          tx = await bridgeGovernance
            .connect(governance)
            .finalizeRedemptionTimeoutUpdate()
        })

        after(async () => {
          await restoreSnapshot()
        })

        it("should update the redemption timeout", async () => {
          const { redemptionTimeout } = await bridge.redemptionParameters()
          expect(redemptionTimeout).to.be.equal(7331)
        })

        it("should emitRedemptionTimeoutUpdated event", async () => {
          await expect(tx)
            .to.emit(bridgeGovernance, "RedemptionTimeoutUpdated")
            .withArgs(7331)
        })
      }
    )
  })

  describe("beginRedemptionTimeoutSlashingAmountUpdate", () => {
    context("when the caller is not the owner", () => {
      it("should revert", async () => {
        await expect(
          bridgeGovernance
            .connect(thirdParty)
            .beginRedemptionTimeoutSlashingAmountUpdate(1)
        ).to.be.revertedWith("Ownable: caller is not the owner")
      })
    })

    context("when the caller is the owner", () => {
      let tx: ContractTransaction

      before(async () => {
        await createSnapshot()

        tx = await bridgeGovernance
          .connect(governance)
          .beginRedemptionTimeoutSlashingAmountUpdate(1337)
      })

      after(async () => {
        await restoreSnapshot()
      })

      it("should not update the redemption timeout slashing amount", async () => {
        const { redemptionTimeoutSlashingAmount } =
          await bridge.redemptionParameters()
        expect(redemptionTimeoutSlashingAmount).to.be.equal(
          constants.redemptionTimeoutSlashingAmount
        )
      })

      it("should start the redemption timeout slashing amount timer", async () => {
        const blockTimestamp = (await ethers.provider.getBlock(tx.blockNumber))
          .timestamp
        const initTimestamp = (await tx.wait()).events[0].args.timestamp
        const elapsedTime = BigNumber.from(blockTimestamp).sub(initTimestamp)

        expect(
          BigNumber.from(constants.governanceDelay).sub(elapsedTime)
        ).to.be.equal(constants.governanceDelay)
      })

      it("should emit RedemptionTimeoutSlashingAmountUpdateStarted event", async () => {
        const blockTimestamp = (await ethers.provider.getBlock(tx.blockNumber))
          .timestamp
        await expect(tx)
          .to.emit(
            bridgeGovernance,
            "RedemptionTimeoutSlashingAmountUpdateStarted"
          )
          .withArgs(1337, blockTimestamp)
      })
    })
  })

  describe("finalizeRedemptionTimeoutSlashingAmountUpdate", () => {
    context("when the caller is not the owner", () => {
      it("should revert", async () => {
        await expect(
          bridgeGovernance
            .connect(thirdParty)
            .finalizeRedemptionTimeoutSlashingAmountUpdate()
        ).to.be.revertedWith("Ownable: caller is not the owner")
      })
    })

    context("when the update process is not initialized", () => {
      it("should revert", async () => {
        await expect(
          bridgeGovernance
            .connect(governance)
            .finalizeRedemptionTimeoutSlashingAmountUpdate()
        ).to.be.revertedWith("Change not initiated")
      })
    })

    context(
      "when the redemption timeout slashing amount has not passed",
      () => {
        before(async () => {
          await createSnapshot()

          await bridgeGovernance
            .connect(governance)
            .beginRedemptionTimeoutSlashingAmountUpdate(7331)

          await helpers.time.increaseTime(constants.governanceDelay - 60) // -1min
        })

        after(async () => {
          await restoreSnapshot()
        })

        it("should revert", async () => {
          await expect(
            bridgeGovernance
              .connect(governance)
              .finalizeRedemptionTimeoutSlashingAmountUpdate()
          ).to.be.revertedWith("Governance delay has not elapsed")
        })
      }
    )

    context(
      "when the update process is initialized and governance delay passed",
      () => {
        let tx: ContractTransaction

        before(async () => {
          await createSnapshot()

          await bridgeGovernance
            .connect(governance)
            .beginRedemptionTimeoutSlashingAmountUpdate(7331)

          await helpers.time.increaseTime(constants.governanceDelay)

          tx = await bridgeGovernance
            .connect(governance)
            .finalizeRedemptionTimeoutSlashingAmountUpdate()
        })

        after(async () => {
          await restoreSnapshot()
        })

        it("should update the redemption timeout slashing amount", async () => {
          const { redemptionTimeoutSlashingAmount } =
            await bridge.redemptionParameters()
          expect(redemptionTimeoutSlashingAmount).to.be.equal(7331)
        })

        it("should emitRedemptionTimeoutSlashingAmountUpdated event", async () => {
          await expect(tx)
            .to.emit(bridgeGovernance, "RedemptionTimeoutSlashingAmountUpdated")
            .withArgs(7331)
        })
      }
    )
  })

  describe("beginRedemptionTimeoutNotifierRewardMultiplierUpdate", () => {
    context("when the caller is not the owner", () => {
      it("should revert", async () => {
        await expect(
          bridgeGovernance
            .connect(thirdParty)
            .beginRedemptionTimeoutNotifierRewardMultiplierUpdate(1)
        ).to.be.revertedWith("Ownable: caller is not the owner")
      })
    })

    context("when the caller is the owner", () => {
      let tx: ContractTransaction

      before(async () => {
        await createSnapshot()

        tx = await bridgeGovernance
          .connect(governance)
          .beginRedemptionTimeoutNotifierRewardMultiplierUpdate(1337)
      })

      after(async () => {
        await restoreSnapshot()
      })

      it("should not update the redemption timeout notifier reward multiplier", async () => {
        const { redemptionTimeoutNotifierRewardMultiplier } =
          await bridge.redemptionParameters()
        expect(redemptionTimeoutNotifierRewardMultiplier).to.be.equal(
          constants.redemptionTimeoutNotifierRewardMultiplier
        )
      })

      it("should start the redemption timeout notifier reward multiplier timer", async () => {
        const blockTimestamp = (await ethers.provider.getBlock(tx.blockNumber))
          .timestamp
        const initTimestamp = (await tx.wait()).events[0].args.timestamp
        const elapsedTime = BigNumber.from(blockTimestamp).sub(initTimestamp)

        expect(
          BigNumber.from(constants.governanceDelay).sub(elapsedTime)
        ).to.be.equal(constants.governanceDelay)
      })

      it("should emit RedemptionTimeoutNotifierRewardMultiplierUpdateStarted event", async () => {
        const blockTimestamp = (await ethers.provider.getBlock(tx.blockNumber))
          .timestamp
        await expect(tx)
          .to.emit(
            bridgeGovernance,
            "RedemptionTimeoutNotifierRewardMultiplierUpdateStarted"
          )
          .withArgs(1337, blockTimestamp)
      })
    })
  })

  describe("finalizeRedemptionTimeoutNotifierRewardMultiplierUpdate", () => {
    context("when the caller is not the owner", () => {
      it("should revert", async () => {
        await expect(
          bridgeGovernance
            .connect(thirdParty)
            .finalizeRedemptionTimeoutNotifierRewardMultiplierUpdate()
        ).to.be.revertedWith("Ownable: caller is not the owner")
      })
    })

    context("when the update process is not initialized", () => {
      it("should revert", async () => {
        await expect(
          bridgeGovernance
            .connect(governance)
            .finalizeRedemptionTimeoutNotifierRewardMultiplierUpdate()
        ).to.be.revertedWith("Change not initiated")
      })
    })

    context(
      "when the redemption timeout notifier reward multiplier has not passed",
      () => {
        before(async () => {
          await createSnapshot()

          await bridgeGovernance
            .connect(governance)
            .beginRedemptionTimeoutNotifierRewardMultiplierUpdate(42)

          await helpers.time.increaseTime(constants.governanceDelay - 60) // -1min
        })

        after(async () => {
          await restoreSnapshot()
        })

        it("should revert", async () => {
          await expect(
            bridgeGovernance
              .connect(governance)
              .finalizeRedemptionTimeoutNotifierRewardMultiplierUpdate()
          ).to.be.revertedWith("Governance delay has not elapsed")
        })
      }
    )

    context(
      "when the update process is initialized and governance delay passed",
      () => {
        let tx: ContractTransaction

        before(async () => {
          await createSnapshot()

          await bridgeGovernance
            .connect(governance)
            .beginRedemptionTimeoutNotifierRewardMultiplierUpdate(42)

          await helpers.time.increaseTime(constants.governanceDelay)

          tx = await bridgeGovernance
            .connect(governance)
            .finalizeRedemptionTimeoutNotifierRewardMultiplierUpdate()
        })

        after(async () => {
          await restoreSnapshot()
        })

        it("should update the redemption timeout notifier reward multiplier", async () => {
          const { redemptionTimeoutNotifierRewardMultiplier } =
            await bridge.redemptionParameters()
          expect(redemptionTimeoutNotifierRewardMultiplier).to.be.equal(42)
        })

        it("should emitRedemptionTimeoutNotifierRewardMultiplierUpdated event", async () => {
          await expect(tx)
            .to.emit(
              bridgeGovernance,
              "RedemptionTimeoutNotifierRewardMultiplierUpdated"
            )
            .withArgs(42)
        })
      }
    )
  })
})
