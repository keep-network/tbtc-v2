import { helpers, waffle, ethers } from "hardhat"
import { SignerWithAddress } from "@nomiclabs/hardhat-ethers/signers"
import { expect } from "chai"
import { ContractTransaction } from "ethers"
import type { Bridge, BridgeStub, RedemptionWatchtower } from "../../typechain"
import bridgeFixture from "../fixtures/bridge"

const { createSnapshot, restoreSnapshot } = helpers.snapshot
const { lastBlockTime } = helpers.time

describe("RedemptionWatchtower", () => {
  let governance: SignerWithAddress
  let thirdParty: SignerWithAddress
  let redemptionWatchtowerManager: SignerWithAddress
  let guardians: SignerWithAddress[]

  let bridge: Bridge & BridgeStub
  let redemptionWatchtower: RedemptionWatchtower

  before(async () => {
    // eslint-disable-next-line @typescript-eslint/no-extra-semi
    ;({
      governance,
      thirdParty,
      redemptionWatchtowerManager,
      guardians,
      bridge,
      redemptionWatchtower,
    } = await waffle.loadFixture(bridgeFixture))

    // Make sure test actors are correctly set up.
    const actors = [
      governance,
      thirdParty,
      redemptionWatchtowerManager,
      ...guardians,
    ].map((actor) => actor.address)

    if (actors.length !== new Set(actors).size) {
      throw new Error("Duplicate actors; please double check the fixture")
    }
  })

  describe("enableWatchtower", () => {
    context("when called not by the owner", () => {
      it("should revert", async () => {
        await expect(
          redemptionWatchtower.connect(thirdParty).enableWatchtower(
            redemptionWatchtowerManager.address,
            guardians.map((g) => g.address)
          )
        ).to.be.revertedWith("Ownable: caller is not the owner")
      })
    })

    context("when called by the owner", () => {
      context("when already enabled", () => {
        before(async () => {
          await createSnapshot()

          await redemptionWatchtower.connect(governance).enableWatchtower(
            redemptionWatchtowerManager.address,
            guardians.map((g) => g.address)
          )
        })

        after(async () => {
          await restoreSnapshot()
        })

        it("should revert", async () => {
          await expect(
            redemptionWatchtower.connect(governance).enableWatchtower(
              redemptionWatchtowerManager.address,
              guardians.map((g) => g.address)
            )
          ).to.be.revertedWith("Already enabled")
        })
      })

      context("when not enabled yet", () => {
        context("when manager address is zero", () => {
          it("should revert", async () => {
            await expect(
              redemptionWatchtower.connect(governance).enableWatchtower(
                ethers.constants.AddressZero,
                guardians.map((g) => g.address)
              )
            ).to.be.revertedWith("Manager address must not be 0x0")
          })
        })

        context("when manager address is non-zero", () => {
          let tx: ContractTransaction

          before(async () => {
            await createSnapshot()

            tx = await redemptionWatchtower
              .connect(governance)
              .enableWatchtower(
                redemptionWatchtowerManager.address,
                guardians.map((g) => g.address)
              )
          })

          after(async () => {
            await restoreSnapshot()
          })

          it("should set the watchtower manager properly", async () => {
            expect(await redemptionWatchtower.manager()).to.equal(
              redemptionWatchtowerManager.address
            )
          })

          it("should set initial guardians properly", async () => {
            // eslint-disable-next-line no-restricted-syntax
            for (const guardian of guardians) {
              // eslint-disable-next-line no-await-in-loop,@typescript-eslint/no-unused-expressions
              expect(await redemptionWatchtower.isGuardian(guardian.address)).to
                .be.true
            }
          })

          it("should emit WatchtowerEnabled event", async () => {
            await expect(tx)
              .to.emit(redemptionWatchtower, "WatchtowerEnabled")
              .withArgs(
                await lastBlockTime(),
                redemptionWatchtowerManager.address
              )
          })

          it("should emit GuardianAdded events", async () => {
            await expect(tx)
              .to.emit(redemptionWatchtower, "GuardianAdded")
              .withArgs(guardians[0].address)

            await expect(tx)
              .to.emit(redemptionWatchtower, "GuardianAdded")
              .withArgs(guardians[1].address)

            await expect(tx)
              .to.emit(redemptionWatchtower, "GuardianAdded")
              .withArgs(guardians[2].address)
          })
        })
      })
    })
  })

  describe("addGuardian", () => {
    before(async () => {
      await createSnapshot()

      await redemptionWatchtower.connect(governance).enableWatchtower(
        redemptionWatchtowerManager.address,
        guardians.map((g) => g.address)
      )
    })

    after(async () => {
      await restoreSnapshot()
    })

    context("when called not by the watchtower manager", () => {
      it("should revert", async () => {
        await expect(
          redemptionWatchtower
            .connect(governance) // governance has not such a power
            .addGuardian(thirdParty.address)
        ).to.be.revertedWith("Caller is not watchtower manager")
      })
    })

    context("when called by the watchtower manager", () => {
      context("when guardian already exists", () => {
        it("should revert", async () => {
          await expect(
            redemptionWatchtower
              .connect(redemptionWatchtowerManager)
              .addGuardian(guardians[0].address)
          ).to.be.revertedWith("Guardian already exists")
        })
      })

      context("when guardian does not exist", () => {
        let tx: ContractTransaction

        before(async () => {
          await createSnapshot()

          tx = await redemptionWatchtower
            .connect(redemptionWatchtowerManager)
            .addGuardian(thirdParty.address)
        })

        after(async () => {
          await restoreSnapshot()
        })

        it("should add the guardian properly", async () => {
          // eslint-disable-next-line @typescript-eslint/no-unused-expressions
          expect(await redemptionWatchtower.isGuardian(thirdParty.address)).to
            .be.true
        })

        it("should emit GuardianAdded event", async () => {
          await expect(tx)
            .to.emit(redemptionWatchtower, "GuardianAdded")
            .withArgs(thirdParty.address)
        })
      })
    })
  })

  describe("removeGuardian", () => {
    before(async () => {
      await createSnapshot()

      await redemptionWatchtower.connect(governance).enableWatchtower(
        redemptionWatchtowerManager.address,
        guardians.map((g) => g.address)
      )
    })

    after(async () => {
      await restoreSnapshot()
    })

    context("when called not by the governance", () => {
      it("should revert", async () => {
        await expect(
          redemptionWatchtower
            .connect(redemptionWatchtowerManager) // manager has not such a power
            .removeGuardian(guardians[0].address)
        ).to.be.revertedWith("Ownable: caller is not the owner")
      })
    })

    context("when called by the governance", () => {
      context("when guardian does not exist", () => {
        it("should revert", async () => {
          await expect(
            redemptionWatchtower
              .connect(governance)
              .removeGuardian(thirdParty.address)
          ).to.be.revertedWith("Guardian does not exist")
        })
      })

      context("when guardian exists", () => {
        let tx: ContractTransaction

        before(async () => {
          await createSnapshot()

          tx = await redemptionWatchtower
            .connect(governance)
            .removeGuardian(guardians[0].address)
        })

        after(async () => {
          await restoreSnapshot()
        })

        it("should remove the guardian properly", async () => {
          // eslint-disable-next-line @typescript-eslint/no-unused-expressions
          expect(await redemptionWatchtower.isGuardian(guardians[0].address)).to
            .be.false
        })

        it("should emit GuardianRemoved event", async () => {
          await expect(tx)
            .to.emit(redemptionWatchtower, "GuardianRemoved")
            .withArgs(guardians[0].address)
        })
      })
    })
  })
})
