import { helpers, waffle, ethers } from "hardhat"
import { SignerWithAddress } from "@nomiclabs/hardhat-ethers/signers"
import { expect } from "chai"
import { ContractTransaction } from "ethers"
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
        expect(await bridgeGovernance.governanceDelay()).to.be.equal(
          constants.governanceDelay
        )
      })

      it("should start the governance delay timer", async () => {
        expect(
          await bridgeGovernance.getRemainingGovernanceDelayUpdateTime()
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
          expect(await bridgeGovernance.governanceDelay()).to.be.equal(7331)
        })

        it("should emit GovernanceDelayUpdated event", async () => {
          await expect(tx)
            .to.emit(bridgeGovernance, "GovernanceDelayUpdated")
            .withArgs(7331)
        })

        it("should reset the governance delay timer", async () => {
          await expect(
            bridgeGovernance.getRemainingGovernanceDelayUpdateTime()
          ).to.be.revertedWith("Change not initiated")
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
        expect(
          await bridgeGovernance.getRemainingBridgeGovernanceTransferDelayUpdateTime()
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
            bridgeGovernance.getRemainingBridgeGovernanceTransferDelayUpdateTime()
          ).to.be.revertedWith("Change not initiated")
        })
      }
    )
  })
})
