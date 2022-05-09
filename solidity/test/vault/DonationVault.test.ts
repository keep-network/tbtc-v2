import { SignerWithAddress } from "@nomiclabs/hardhat-ethers/signers"
import { ethers, helpers, waffle } from "hardhat"
import { expect } from "chai"

import { ContractTransaction } from "ethers"
import type {
  Bank,
  Bank__factory,
  DonationVault,
  DonationVault__factory,
} from "../../typechain"

const { createSnapshot, restoreSnapshot } = helpers.snapshot

const fixture = async () => {
  const [deployer, bridge, thirdParty1, thirdParty2] = await ethers.getSigners()

  const Bank = await ethers.getContractFactory<Bank__factory>("Bank")
  const bank = await Bank.deploy()
  await bank.deployed()

  await bank.connect(deployer).updateBridge(bridge.address)

  const DonationVault = await ethers.getContractFactory<DonationVault__factory>(
    "DonationVault"
  )
  const vault = await DonationVault.deploy(bank.address)
  await vault.deployed()

  return {
    bridge,
    thirdParty1,
    thirdParty2,
    bank,
    vault,
  }
}

describe("DonationVault", () => {
  let bridge: SignerWithAddress
  let thirdParty1: SignerWithAddress
  let thirdParty2: SignerWithAddress
  let bank: Bank
  let vault: DonationVault

  before(async () => {
    // eslint-disable-next-line @typescript-eslint/no-extra-semi
    ;({ bridge, thirdParty1, thirdParty2, bank, vault } =
      await waffle.loadFixture(fixture))
  })

  describe("constructor", () => {
    context("when called with a 0-address bank", () => {
      it("should revert", async () => {
        const DonationVault = await ethers.getContractFactory("DonationVault")
        await expect(
          DonationVault.deploy(ethers.constants.AddressZero)
        ).to.be.revertedWith("Bank can not be the zero address")
      })
    })

    context("when called with correct parameters", () => {
      it("should set the Bank field", async () => {
        expect(await vault.bank()).to.equal(bank.address)
      })
    })
  })

  describe("receiveBalanceApproval", () => {
    context("when called not by the bank", () => {
      it("should revert", async () => {
        await expect(
          vault
            .connect(bridge)
            .receiveBalanceApproval(thirdParty1.address, 1000)
        ).to.be.revertedWith("Caller is not the Bank")
      })
    })

    context("when called by the bank", () => {
      it("should revert", async () => {
        await expect(
          bank.connect(thirdParty1).approveBalanceAndCall(vault.address, 1000)
        ).to.be.revertedWith("Donation vault cannot receive balance approval")
      })
    })
  })

  describe("receiveBalanceIncrease", () => {
    context("when called not by the bank", () => {
      it("should revert", async () => {
        await expect(
          vault
            .connect(bridge)
            .receiveBalanceIncrease([thirdParty1.address], [1000])
        ).to.be.revertedWith("Caller is not the Bank")
      })
    })

    context("when called with no depositors", () => {
      it("should revert", async () => {
        await expect(
          bank.connect(bridge).increaseBalanceAndCall(vault.address, [], [])
        ).to.be.revertedWith("No depositors specified")
      })
    })

    context("when called with correct parameters", () => {
      let tx: ContractTransaction

      before(async () => {
        await createSnapshot()

        tx = await bank
          .connect(bridge)
          .increaseBalanceAndCall(
            vault.address,
            [thirdParty1.address, thirdParty2.address],
            [1000, 2000]
          )
      })

      after(async () => {
        await restoreSnapshot()
      })

      it("should not increase depositors' balances", async () => {
        expect(await bank.balanceOf(thirdParty1.address)).to.be.equal(0)
        expect(await bank.balanceOf(thirdParty2.address)).to.be.equal(0)
      })

      it("should not increase vault's balance", async () => {
        expect(await bank.balanceOf(vault.address)).to.be.equal(0)
      })

      it("should emit BalanceDecreased event", async () => {
        await expect(tx)
          .to.emit(bank, "BalanceDecreased")
          .withArgs(vault.address, 3000)
      })

      it("should emit DonationReceived event", async () => {
        await expect(tx)
          .to.emit(vault, "DonationReceived")
          .withArgs([thirdParty1.address, thirdParty2.address], [1000, 2000])
      })
    })
  })
})
