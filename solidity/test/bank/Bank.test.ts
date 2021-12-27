import { ethers, helpers, waffle } from "hardhat"
import { SignerWithAddress } from "@nomiclabs/hardhat-ethers/signers"
import { expect } from "chai"
import type { Bank } from "../../typechain"

const { to1e18 } = helpers.number

const { createSnapshot, restoreSnapshot } = helpers.snapshot

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

  describe("increaseBalance", () => {
    let recipient
    let amount

    before(async () => {
      await createSnapshot()

      recipient = thirdParty.address
      amount = to1e18(10)
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
          ).to.be.revertedWith("Bank itself can not have a balance")
        })
      })

      it("should increase recipient's balance", async () => {
        await bank.connect(bridge).increaseBalance(recipient, amount)
        expect(await bank.balanceOf(recipient)).to.equal(amount)
      })
    })
  })

  describe("decreaseBalance", () => {
    let spender
    let initialBalance
    let amount

    before(async () => {
      await createSnapshot()

      spender = thirdParty.address
      initialBalance = to1e18(21)
      amount = to1e18(10)

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
})
