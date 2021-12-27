import { ethers, helpers, waffle } from "hardhat"
import { SignerWithAddress } from "@nomiclabs/hardhat-ethers/signers"
import { expect } from "chai"
import type { Bank } from "../../typechain"

const { to1e18 } = helpers.number

const { createSnapshot, restoreSnapshot } = helpers.snapshot

const fixture = async () => {
  const [deployer, bridge, thirdParty] = await ethers.getSigners()

  const Bank = await ethers.getContractFactory("Bank")
  const bank = await Bank.deploy()
  await bank.deployed()

  await bank.connect(deployer).updateBridge(bridge.address)

  return {
    bridge,
    thirdParty,
    bank,
  }
}

describe("Bank", () => {
  let bridge: SignerWithAddress
  let thirdParty: SignerWithAddress

  let bank: Bank

  before(async () => {
    // eslint-disable-next-line @typescript-eslint/no-extra-semi
    ;({ bridge, thirdParty, bank } = await waffle.loadFixture(
      fixture
    ))
  })

  describe("increaseBalance", () => {
    let recipient
    let amount
    
    before(async () => {
      recipient = thirdParty.address
      amount = to1e18(10)
    })

    context("when called by a third party", () => {
      it("should revert", async () => {
        await expect(
          bank
            .connect(thirdParty)
            .increaseBalance(recipient, amount)
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
})
