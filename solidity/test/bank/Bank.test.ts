import { ethers, getUnnamedAccounts, helpers, waffle } from "hardhat"
import { SignerWithAddress } from "@nomiclabs/hardhat-ethers/signers"
import { expect } from "chai"

import type { Bank } from "../../typechain"

const { to1e18 } = helpers.number
const { createSnapshot, restoreSnapshot } = helpers.snapshot

const ZERO_ADDRESS = ethers.constants.AddressZero

const fixture = async () => {
  const [deployer, governance, bridge, thirdParty] = await ethers.getSigners()

  const Bank = await ethers.getContractFactory("Bank")
  const bank = await Bank.deploy()
  await bank.deployed()

  await bank.connect(deployer).updateBridge(bridge.address)
  await bank.connect(deployer).transferOwnership(governance.address)

  return {
    governance,
    bridge,
    thirdParty,
    bank,
  }
}

describe("Bank", () => {
  let governance: SignerWithAddress
  let bridge: SignerWithAddress
  let thirdParty: SignerWithAddress

  let bank: Bank

  before(async () => {
    // eslint-disable-next-line @typescript-eslint/no-extra-semi
    ;({ governance, bridge, thirdParty, bank } = await waffle.loadFixture(
      fixture
    ))
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
          bank.connect(thirdParty).updateBridge(thirdParty.address)
        ).to.be.revertedWith("Ownable: caller is not the owner")
      })
    })

    context("when called by the governance", () => {
      it("should update the bridge", async () => {
        await bank.connect(governance).updateBridge(thirdParty.address)
        expect(await bank.bridge()).to.equal(thirdParty.address)
      })
    })
  })

  describe("transferBalance", () => {
    const initialBalance = to1e18(500)

    let spender
    let recipient

    before(async () => {
      await createSnapshot()

      const accounts = await getUnnamedAccounts()
      spender = await ethers.getSigner(accounts[0])
      // eslint-disable-next-line prefer-destructuring
      recipient = accounts[1]

      await bank
        .connect(bridge)
        .increaseBalance(spender.address, initialBalance)
    })

    after(async () => {
      await restoreSnapshot()
    })

    context("when the recipient is the zero address", () => {
      it("should revert", async () => {
        await expect(
          bank.connect(spender).transferBalance(ZERO_ADDRESS, initialBalance)
        ).to.be.revertedWith("Can not transfer to the zero address")
      })
    })

    context("when the recipient is the bank address", () => {
      it("should revert", async () => {
        await expect(
          bank.connect(spender).transferBalance(bank.address, initialBalance)
        ).to.be.revertedWith("Can not transfer to the Bank address")
      })
    })

    context("when the spender has not enough balance", () => {
      it("should revert", async () => {
        await expect(
          bank
            .connect(spender)
            .transferBalance(recipient, initialBalance.add(1))
        ).to.be.revertedWith("Transfer amount exceeds balance")
      })
    })

    context("when the spender transfers part of their balance", () => {
      const amount = to1e18(21)
      let tx

      before(async () => {
        await createSnapshot()
        tx = await bank.connect(spender).transferBalance(recipient, amount)
      })

      after(async () => {
        await restoreSnapshot()
      })

      it("should transfer the requested amount", async () => {
        expect(await bank.balanceOf(spender.address)).to.equal(
          initialBalance.sub(amount)
        )
        expect(await bank.balanceOf(recipient)).to.equal(amount)
      })

      it("should emit the BalanceTransferred event", async () => {
        await expect(tx)
          .to.emit(bank, "BalanceTransferred")
          .withArgs(spender.address, recipient, amount)
      })
    })

    context(
      "when the spender transfers part of their balance in two transactions",
      () => {
        const amount1 = to1e18(21)
        const amount2 = to1e18(12)

        before(async () => {
          await createSnapshot()
          await bank.connect(spender).transferBalance(recipient, amount1)
          await bank.connect(spender).transferBalance(recipient, amount2)
        })

        after(async () => {
          await restoreSnapshot()
        })

        it("should transfer the requested amount", async () => {
          expect(await bank.balanceOf(spender.address)).to.equal(
            initialBalance.sub(amount1).sub(amount2)
          )
          expect(await bank.balanceOf(recipient)).to.equal(amount1.add(amount2))
        })
      }
    )

    context("when the spender transfers their entire balance", () => {
      const amount = initialBalance
      let tx

      before(async () => {
        await createSnapshot()
        tx = await bank.connect(spender).transferBalance(recipient, amount)
      })

      after(async () => {
        await restoreSnapshot()
      })

      it("should transfer the entire balance", async () => {
        expect(await bank.balanceOf(spender.address)).to.equal(0)
        expect(await bank.balanceOf(recipient)).to.equal(amount)
      })

      it("should emit the BalanceTransferred event", async () => {
        await expect(tx)
          .to.emit(bank, "BalanceTransferred")
          .withArgs(spender.address, recipient, amount)
      })
    })

    context("when the spender transfers 0 balance", () => {
      const amount = 0
      let tx

      before(async () => {
        await createSnapshot()
        tx = await bank.connect(spender).transferBalance(recipient, amount)
      })

      after(async () => {
        await restoreSnapshot()
      })

      it("should transfer no balance", async () => {
        expect(await bank.balanceOf(spender.address)).to.equal(initialBalance)
        expect(await bank.balanceOf(recipient)).to.equal(0)
      })

      it("should emit the BalanceTransferred event", async () => {
        await expect(tx)
          .to.emit(bank, "BalanceTransferred")
          .withArgs(spender.address, recipient, 0)
      })
    })
  })

  describe("increaseBalance", () => {
    const amount = to1e18(10)
    let recipient

    before(async () => {
      await createSnapshot()
      recipient = thirdParty.address
    })

    after(async () => {
      await restoreSnapshot()
    })

    context("when called by a third party", () => {
      it("should revert", async () => {
        await expect(
          bank.connect(thirdParty).increaseBalance(recipient, amount)
        ).to.be.revertedWith("Caller is not the bridge")
      })
    })

    context("when called by the bridge", () => {
      context("when increasing balance for the Bank", () => {
        it("should revert", async () => {
          await expect(
            bank.connect(bridge).increaseBalance(bank.address, amount)
          ).to.be.revertedWith("Can not increase balance for Bank")
        })
      })

      it("should increase recipient's balance", async () => {
        await bank.connect(bridge).increaseBalance(recipient, amount)
        expect(await bank.balanceOf(recipient)).to.equal(amount)
      })
    })
  })

  describe("increaseBalances", () => {
    const amount1 = to1e18(12)
    const amount2 = to1e18(15)
    const amount3 = to1e18(17)

    let recipient1
    let recipient2
    let recipient3

    before(async () => {
      await createSnapshot()
      ;[recipient1, recipient2, recipient3] = await getUnnamedAccounts()
    })

    after(async () => {
      await restoreSnapshot()
    })

    context("when called by a third party", () => {
      it("should revert", async () => {
        await expect(
          bank
            .connect(thirdParty)
            .increaseBalances(
              [recipient1, recipient2, recipient3],
              [amount1, amount2, amount3]
            )
        ).to.be.revertedWith("Caller is not the bridge")
      })
    })

    context("when called by the bridge", () => {
      context("when increasing balance for the bank", () => {
        it("should revert", async () => {
          await expect(
            bank
              .connect(bridge)
              .increaseBalances(
                [recipient1, bank.address, recipient3],
                [amount1, amount2, amount3]
              )
          ).to.be.revertedWith("Can not increase balance for Bank")
        })
      })

      it("should increase recipients' balances", async () => {
        await bank
          .connect(bridge)
          .increaseBalances(
            [recipient1, recipient2, recipient3],
            [amount1, amount2, amount3]
          )

        expect(await bank.balanceOf(recipient1)).to.equal(amount1)
        expect(await bank.balanceOf(recipient2)).to.equal(amount2)
        expect(await bank.balanceOf(recipient3)).to.equal(amount3)
      })
    })
  })

  describe("decreaseBalance", () => {
    const initialBalance = to1e18(21)
    const amount = to1e18(10)

    let spender

    before(async () => {
      await createSnapshot()
      spender = thirdParty.address
      // first increase so that there is something to decrease from
      await bank.connect(bridge).increaseBalance(spender, initialBalance)
    })

    after(async () => {
      await restoreSnapshot()
    })

    context("when called by a third party", () => {
      it("should revert", async () => {
        await expect(
          bank.connect(thirdParty).decreaseBalance(spender, amount)
        ).to.be.revertedWith("Caller is not the bridge")
      })
    })

    context("when called by the bridge", () => {
      it("should decrease spender's balance", async () => {
        await bank.connect(bridge).decreaseBalance(spender, amount)
        expect(await bank.balanceOf(thirdParty.address)).to.equal(
          initialBalance.sub(amount)
        )
      })
    })
  })

  describe("decreaseBalances", () => {
    const initialBalance = to1e18(181)
    const amount1 = to1e18(12)
    const amount2 = to1e18(15)
    const amount3 = to1e18(17)

    let spender1
    let spender2
    let spender3

    before(async () => {
      await createSnapshot()
      ;[spender1, spender2, spender3] = await getUnnamedAccounts()

      // first increase so that there is something to decrease from
      await bank
        .connect(bridge)
        .increaseBalances(
          [spender1, spender2, spender3],
          [initialBalance, initialBalance, initialBalance]
        )
    })

    after(async () => {
      await restoreSnapshot()
    })

    context("when called by a third party", () => {
      it("should revert", async () => {
        await expect(
          bank
            .connect(thirdParty)
            .decreaseBalances(
              [spender1, spender2, spender3],
              [amount1, amount2, amount3]
            )
        ).to.be.revertedWith("Caller is not the bridge")
      })
    })

    context("when called by the bridge", () => {
      it("should decrease spenders' balances", async () => {
        await bank
          .connect(bridge)
          .decreaseBalances(
            [spender1, spender2, spender3],
            [amount1, amount2, amount3]
          )

        expect(await bank.balanceOf(spender1)).to.equal(
          initialBalance.sub(amount1)
        )
        expect(await bank.balanceOf(spender2)).to.equal(
          initialBalance.sub(amount2)
        )
        expect(await bank.balanceOf(spender3)).to.equal(
          initialBalance.sub(amount3)
        )
      })
    })
  })
})
