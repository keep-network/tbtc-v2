import { SignerWithAddress } from "@nomiclabs/hardhat-ethers/signers"
import { ethers, getUnnamedAccounts, helpers, waffle } from "hardhat"
import { expect } from "chai"
import { ContractTransaction } from "ethers"

import bridgeFixture from "../fixtures/bridge"

import type { Bridge, BridgeStub, TBTCVault } from "../../typechain"

const { createSnapshot, restoreSnapshot } = helpers.snapshot

describe("TBTCVault - OptimisticMinting", () => {
  let bridge: Bridge & BridgeStub
  let tbtcVault: TBTCVault

  let governance: SignerWithAddress

  let account1: SignerWithAddress
  let account2: SignerWithAddress

  before(async () => {
    // eslint-disable-next-line @typescript-eslint/no-extra-semi
    ;({ governance, bridge, tbtcVault } = await waffle.loadFixture(
      bridgeFixture
    ))

    const accounts = await getUnnamedAccounts()
    account1 = await ethers.getSigner(accounts[0])
    account2 = await ethers.getSigner(accounts[1])
  })

  describe("addMinter", () => {
    context("when called not by the governance", () => {
      it("should revert", async () => {
        await expect(
          tbtcVault.connect(account1).addMinter(account1.address)
        ).to.be.revertedWith("Ownable: caller is not the owner")
      })
    })

    context("when called by the governance", () => {
      context("when address is not a minter", () => {
        let tx: ContractTransaction

        before(async () => {
          await createSnapshot()

          tx = await tbtcVault.connect(governance).addMinter(account1.address)
        })

        after(async () => {
          await restoreSnapshot()
        })

        it("should add address as a minter", async () => {
          // eslint-disable-next-line @typescript-eslint/no-unused-expressions
          expect(await tbtcVault.isMinter(account1.address)).to.be.true
        })

        it("should emit an event", async () => {
          await expect(tx)
            .to.emit(tbtcVault, "MinterAdded")
            .withArgs(account1.address)
        })
      })

      context("when address is a minter", () => {
        before(async () => {
          await createSnapshot()

          await tbtcVault.connect(governance).addMinter(account1.address)
        })

        after(async () => {
          await restoreSnapshot()
        })

        it("should revert", async () => {
          await expect(
            tbtcVault.connect(governance).addMinter(account1.address)
          ).to.be.revertedWith("This address is already a minter")
        })
      })
    })
  })

  describe("removeMinter", () => {
    context("when called not by the governance", () => {
      it("should revert", async () => {
        await expect(
          tbtcVault.connect(account1).removeMinter(account1.address)
        ).to.be.revertedWith("Ownable: caller is not the owner")
      })
    })

    context("when called by the governance", () => {
      context("when address is a minter", () => {
        let tx: ContractTransaction

        before(async () => {
          await createSnapshot()

          await tbtcVault.connect(governance).addMinter(account1.address)
          tx = await tbtcVault
            .connect(governance)
            .removeMinter(account1.address)
        })

        after(async () => {
          await restoreSnapshot()
        })

        it("should take minter role from the address", async () => {
          // eslint-disable-next-line @typescript-eslint/no-unused-expressions
          expect(await tbtcVault.isMinter(account1.address)).to.be.false
        })

        it("should emit an event", async () => {
          await expect(tx)
            .to.emit(tbtcVault, "MinterRemoved")
            .withArgs(account1.address)
        })
      })

      context("when address is not a minter", () => {
        it("should revert", async () => {
          await expect(
            tbtcVault.connect(governance).removeMinter(account1.address)
          ).to.be.revertedWith("This address is not a minter")
        })
      })
    })
  })

  describe("addGuard", () => {
    context("when called not by the governance", () => {
      it("should revert", async () => {
        await expect(
          tbtcVault.connect(account1).addGuard(account1.address)
        ).to.be.revertedWith("Ownable: caller is not the owner")
      })
    })

    context("when called by the governance", () => {
      context("when address is not a guard", () => {
        let tx: ContractTransaction

        before(async () => {
          await createSnapshot()

          tx = await tbtcVault.connect(governance).addGuard(account1.address)
        })

        after(async () => {
          await restoreSnapshot()
        })

        it("should add address as a guard", async () => {
          // eslint-disable-next-line @typescript-eslint/no-unused-expressions
          expect(await tbtcVault.isGuard(account1.address)).to.be.true
        })

        it("should emit an event", async () => {
          await expect(tx)
            .to.emit(tbtcVault, "GuardAdded")
            .withArgs(account1.address)
        })
      })

      context("when address is a guard", () => {
        before(async () => {
          await createSnapshot()

          await tbtcVault.connect(governance).addGuard(account1.address)
        })

        after(async () => {
          await restoreSnapshot()
        })

        it("should revert", async () => {
          await expect(
            tbtcVault.connect(governance).addGuard(account1.address)
          ).to.be.revertedWith("This address is already a guard")
        })
      })
    })
  })

  describe("removeGuard", () => {
    context("when called not by the governance", () => {
      it("should revert", async () => {
        await expect(
          tbtcVault.connect(account1).removeGuard(account1.address)
        ).to.be.revertedWith("Ownable: caller is not the owner")
      })
    })

    context("when called by the governance", () => {
      context("when address is a guard", () => {
        let tx: ContractTransaction

        before(async () => {
          await createSnapshot()

          await tbtcVault.connect(governance).addGuard(account1.address)
          tx = await tbtcVault.connect(governance).removeGuard(account1.address)
        })

        after(async () => {
          await restoreSnapshot()
        })

        it("should take guard role from the address", async () => {
          // eslint-disable-next-line @typescript-eslint/no-unused-expressions
          expect(await tbtcVault.isGuard(account1.address)).to.be.false
        })

        it("should emit an event", async () => {
          await expect(tx)
            .to.emit(tbtcVault, "GuardRemoved")
            .withArgs(account1.address)
        })
      })

      context("when address is not a guard", () => {
        it("should revert", async () => {
          await expect(
            tbtcVault.connect(governance).removeGuard(account1.address)
          ).to.be.revertedWith("This address is not a guard")
        })
      })
    })
  })
})
