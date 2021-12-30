import { SignerWithAddress } from "@nomiclabs/hardhat-ethers/signers"
import { ethers, getUnnamedAccounts, helpers, waffle } from "hardhat"
import { expect } from "chai"

import type { Bank, VaultStub } from "../../typechain"

const { to1e18 } = helpers.number
const { createSnapshot, restoreSnapshot } = helpers.snapshot

const ZERO_ADDRESS = ethers.constants.AddressZero

const fixture = async () => {
  const [deployer, bridge] = await ethers.getSigners()

  const Bank = await ethers.getContractFactory("Bank")
  const bank = await Bank.deploy()
  await bank.deployed()

  await bank.connect(deployer).updateBridge(bridge.address)

  const VaultStub = await ethers.getContractFactory("VaultStub")
  const vault = await VaultStub.deploy(bank.address)
  await vault.deployed()

  return {
    bridge,
    bank,
    vault,
  }
}

describe("Vault", () => {
  let bridge: SignerWithAddress
  let bank: Bank
  let vault: VaultStub

  const initialBalance = to1e18(100)

  let account1: SignerWithAddress
  let account2: SignerWithAddress

  before(async () => {
    // eslint-disable-next-line @typescript-eslint/no-extra-semi
    ;({ bridge, bank, vault } = await waffle.loadFixture(fixture))

    const accounts = await getUnnamedAccounts()
    account1 = await ethers.getSigner(accounts[0])
    account2 = await ethers.getSigner(accounts[1])

    await bank.connect(bridge).increaseBalance(account1.address, initialBalance)
    await bank.connect(bridge).increaseBalance(account2.address, initialBalance)

    await bank.connect(account1).approveBalance(vault.address, initialBalance)
    await bank.connect(account2).approveBalance(vault.address, initialBalance)
  })

  describe("constructor", () => {
    context("when called with a 0-address bank", () => {
      it("should revert", async () => {
        const Vault = await ethers.getContractFactory("Vault")
        await expect(Vault.deploy(ZERO_ADDRESS)).to.be.revertedWith(
          "Bank can not be the zero address"
        )
      })
    })

    context("when called with a non-zero bank address", () => {
      it("should set the Bank field", async () => {
        expect(await vault.bank()).to.equal(bank.address)
      })
    })
  })

  describe("lockBalance", () => {
    context("when account has not enough balance in the bank", () => {
      const amount = initialBalance.add(1)

      before(async () => {
        await createSnapshot()

        await bank.connect(account1).approveBalance(vault.address, amount)
      })

      after(async () => {
        await restoreSnapshot()
      })

      it("should revert", async () => {
        await expect(
          vault.publicLockBalance(account1.address, amount)
        ).to.be.revertedWith("Amount exceeds balance in the bank")
      })
    })

    context("when single account locked part of their balance", () => {
      const amount = to1e18(3)

      before(async () => {
        await createSnapshot()

        await vault.publicLockBalance(account1.address, amount)
      })

      after(async () => {
        await restoreSnapshot()
      })

      it("should transfer balance to the vault", async () => {
        expect(await bank.balanceOf(vault.address)).to.equal(amount)
        expect(await bank.balanceOf(account1.address)).to.equal(
          initialBalance.sub(amount)
        )
      })

      it("should update locked balance", async () => {
        expect(await vault.lockedBalance(account1.address)).to.equal(amount)
      })
    })

    context("when single account locked their entire balance", () => {
      before(async () => {
        await createSnapshot()

        await vault.publicLockBalance(account1.address, initialBalance)
      })

      after(async () => {
        await restoreSnapshot()
      })

      it("should transfer balances to the vault", async () => {
        expect(await bank.balanceOf(vault.address)).to.equal(initialBalance)
        expect(await bank.balanceOf(account1.address)).to.equal(0)
      })

      it("should update locked balances", async () => {
        expect(await vault.lockedBalance(account1.address)).to.equal(
          initialBalance
        )
      })
    })

    context("when multiple accounts locked part of their balances", () => {
      const amount1 = to1e18(3)
      const amount2 = to1e18(13)

      before(async () => {
        await createSnapshot()

        await vault.publicLockBalance(account1.address, amount1)
        await vault.publicLockBalance(account2.address, amount2)
      })

      after(async () => {
        await restoreSnapshot()
      })

      it("should transfer balances to the vault", async () => {
        expect(await bank.balanceOf(vault.address)).to.equal(
          amount1.add(amount2)
        )
        expect(await bank.balanceOf(account1.address)).to.equal(
          initialBalance.sub(amount1)
        )
        expect(await bank.balanceOf(account2.address)).to.equal(
          initialBalance.sub(amount2)
        )
      })

      it("should update locked balances", async () => {
        expect(await vault.lockedBalance(account1.address)).to.equal(amount1)
        expect(await vault.lockedBalance(account2.address)).to.equal(amount2)
      })
    })

    context("when multiple accounts locked their entire balances", () => {
      before(async () => {
        await createSnapshot()

        await vault.publicLockBalance(account1.address, initialBalance)
        await vault.publicLockBalance(account2.address, initialBalance)
      })

      after(async () => {
        await restoreSnapshot()
      })

      it("should transfer balances to the vault", async () => {
        expect(await bank.balanceOf(vault.address)).to.equal(
          initialBalance.mul(2)
        )
        expect(await bank.balanceOf(account1.address)).to.equal(0)
        expect(await bank.balanceOf(account2.address)).to.equal(0)
      })

      it("should update locked balances", async () => {
        expect(await vault.lockedBalance(account1.address)).to.equal(
          initialBalance
        )
        expect(await vault.lockedBalance(account2.address)).to.equal(
          initialBalance
        )
      })
    })

    context(
      "when multiple accounts several times locked their balances",
      () => {
        const totalAmount1 = to1e18(5) // 3 + 2 = 5
        const totalAmount2 = to1e18(11) // 10 + 1 = 11

        before(async () => {
          await createSnapshot()

          await vault.publicLockBalance(account1.address, to1e18(3))
          await vault.publicLockBalance(account2.address, to1e18(10))
          await vault.publicLockBalance(account1.address, to1e18(2))
          await vault.publicLockBalance(account2.address, to1e18(1))
        })

        after(async () => {
          await restoreSnapshot()
        })

        it("should transfer balances to the vault", async () => {
          expect(await bank.balanceOf(vault.address)).to.equal(
            totalAmount1.add(totalAmount2)
          )
          expect(await bank.balanceOf(account1.address)).to.equal(
            initialBalance.sub(totalAmount1)
          )
          expect(await bank.balanceOf(account2.address)).to.equal(
            initialBalance.sub(totalAmount2)
          )
        })

        it("should update locked balances", async () => {
          expect(await vault.lockedBalance(account1.address)).to.equal(
            totalAmount1
          )
          expect(await vault.lockedBalance(account2.address)).to.equal(
            totalAmount2
          )
        })
      }
    )
  })

  describe("unlockBalance", () => {
    context("when account has not enough balance locked", () => {
      const lockedAmount = to1e18(10)

      before(async () => {
        await createSnapshot()

        await vault.publicLockBalance(account1.address, lockedAmount)
      })

      after(async () => {
        await restoreSnapshot()
      })

      it("should revert", async () => {
        await expect(
          vault.publicUnlockBalance(account1.address, lockedAmount.add(1))
        ).to.be.revertedWith("Amount exceeds locked balance")
      })
    })

    context("when single account unlocked everything", () => {
      const amount = to1e18(3)

      before(async () => {
        await createSnapshot()

        await vault.publicLockBalance(account1.address, amount)
        await vault.publicUnlockBalance(account1.address, amount)
      })

      after(async () => {
        await restoreSnapshot()
      })

      it("should transfer balance out of the vault", async () => {
        expect(await bank.balanceOf(vault.address)).to.equal(0)
        expect(await bank.balanceOf(account1.address)).to.equal(initialBalance)
      })

      it("should zero locked balance", async () => {
        expect(await vault.lockedBalance(account1.address)).to.equal(0)
      })
    })

    context("when single account unlocked part of their locked balance", () => {
      const amountLocked = to1e18(3)
      const amountUnlocked = to1e18(1)
      const amountStillLocked = amountLocked.sub(amountUnlocked)

      before(async () => {
        await createSnapshot()

        await vault.publicLockBalance(account1.address, amountLocked)
        await vault.publicUnlockBalance(account1.address, amountUnlocked)
      })

      after(async () => {
        await restoreSnapshot()
      })

      it("should transfer balance out of the vault", async () => {
        expect(await bank.balanceOf(vault.address)).to.equal(amountStillLocked)
        expect(await bank.balanceOf(account1.address)).to.equal(
          initialBalance.sub(amountStillLocked)
        )
      })

      it("should update locked balance", async () => {
        expect(await vault.lockedBalance(account1.address)).to.equal(
          amountStillLocked
        )
      })
    })

    context("when multiple accounts unlocked everything", () => {
      const amount1 = to1e18(3)
      const amount2 = to1e18(5)

      before(async () => {
        await createSnapshot()

        await vault.publicLockBalance(account1.address, amount1)
        await vault.publicLockBalance(account2.address, amount2)
        await vault.publicUnlockBalance(account1.address, amount1)
        await vault.publicUnlockBalance(account2.address, amount2)
      })

      after(async () => {
        await restoreSnapshot()
      })

      it("should transfer balances out of the vault", async () => {
        expect(await bank.balanceOf(vault.address)).to.equal(0)
        expect(await bank.balanceOf(account1.address)).to.equal(initialBalance)
        expect(await bank.balanceOf(account2.address)).to.equal(initialBalance)
      })

      it("should zero locked balances", async () => {
        expect(await vault.lockedBalance(account1.address)).to.equal(0)
        expect(await vault.lockedBalance(account2.address)).to.equal(0)
      })
    })

    context(
      "when multiple accounts unlocked part of their locked balances",
      () => {
        const amountLocked1 = to1e18(3)
        const amountUnlocked1 = to1e18(1)
        const amountStillLocked1 = amountLocked1.sub(amountUnlocked1)

        const amountLocked2 = to1e18(9)
        const amountUnlocked2 = to1e18(4)
        const amountStillLocked2 = amountLocked2.sub(amountUnlocked2)

        before(async () => {
          await createSnapshot()

          await vault.publicLockBalance(account1.address, amountLocked1)
          await vault.publicLockBalance(account2.address, amountLocked2)
          await vault.publicUnlockBalance(account1.address, amountUnlocked1)
          await vault.publicUnlockBalance(account2.address, amountUnlocked2)
        })

        after(async () => {
          await restoreSnapshot()
        })

        it("should transfer balances out of the vault", async () => {
          expect(await bank.balanceOf(vault.address)).to.equal(
            amountStillLocked1.add(amountStillLocked2)
          )
          expect(await bank.balanceOf(account1.address)).to.equal(
            initialBalance.sub(amountStillLocked1)
          )
          expect(await bank.balanceOf(account2.address)).to.equal(
            initialBalance.sub(amountStillLocked2)
          )
        })

        it("should update locked balances", async () => {
          expect(await vault.lockedBalance(account1.address)).to.equal(
            amountStillLocked1
          )
          expect(await vault.lockedBalance(account2.address)).to.equal(
            amountStillLocked2
          )
        })
      }
    )

    context(
      "when multiple accounts unlocked their balances several times",
      () => {
        const amountStillLocked1 = to1e18(13) // 20 - 1 - 6 = 13
        const amountStillLocked2 = to1e18(36) // 50 - 2 - 12 = 36

        before(async () => {
          await createSnapshot()

          await vault.publicLockBalance(account1.address, to1e18(20))
          await vault.publicLockBalance(account2.address, to1e18(50))
          await vault.publicUnlockBalance(account1.address, to1e18(1))
          await vault.publicUnlockBalance(account2.address, to1e18(2))
          await vault.publicUnlockBalance(account1.address, to1e18(6))
          await vault.publicUnlockBalance(account2.address, to1e18(12))
        })

        after(async () => {
          await restoreSnapshot()
        })

        it("should transfer balances out of the vault", async () => {
          expect(await bank.balanceOf(vault.address)).to.equal(
            amountStillLocked1.add(amountStillLocked2)
          )
          expect(await bank.balanceOf(account1.address)).to.equal(
            initialBalance.sub(amountStillLocked1)
          )
          expect(await bank.balanceOf(account2.address)).to.equal(
            initialBalance.sub(amountStillLocked2)
          )
        })

        it("should update locked balances", async () => {
          expect(await vault.lockedBalance(account1.address)).to.equal(
            amountStillLocked1
          )
          expect(await vault.lockedBalance(account2.address)).to.equal(
            amountStillLocked2
          )
        })
      }
    )
  })
})
