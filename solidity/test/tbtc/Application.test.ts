import { SignerWithAddress } from "@nomiclabs/hardhat-ethers/signers"
import { ethers, getUnnamedAccounts, helpers, waffle } from "hardhat"
import { expect } from "chai"

import { ContractTransaction } from "ethers"
import type { Bank, TBTC, Application } from "../../typechain"

const { to1e18 } = helpers.number
const { createSnapshot, restoreSnapshot } = helpers.snapshot

const ZERO_ADDRESS = ethers.constants.AddressZero

const fixture = async () => {
  const [deployer, bridge] = await ethers.getSigners()

  const Bank = await ethers.getContractFactory("Bank")
  const bank = await Bank.deploy()
  await bank.deployed()

  await bank.connect(deployer).updateBridge(bridge.address)

  const TBTC = await ethers.getContractFactory("TBTC")
  const tbtc = await TBTC.deploy()
  await tbtc.deployed()

  const Application = await ethers.getContractFactory("Application")
  const application = await Application.deploy(bank.address, tbtc.address)
  await application.deployed()

  await tbtc.connect(deployer).transferOwnership(application.address)

  return {
    bridge,
    bank,
    application,
    tbtc,
  }
}

describe("Application", () => {
  let bridge: SignerWithAddress
  let bank: Bank
  let application: Application
  let tbtc: TBTC

  const initialBalance = to1e18(100)

  let account1: SignerWithAddress
  let account2: SignerWithAddress

  before(async () => {
    // eslint-disable-next-line @typescript-eslint/no-extra-semi
    ;({ bridge, bank, application, tbtc } = await waffle.loadFixture(fixture))

    const accounts = await getUnnamedAccounts()
    account1 = await ethers.getSigner(accounts[0])
    account2 = await ethers.getSigner(accounts[1])

    await bank.connect(bridge).increaseBalance(account1.address, initialBalance)
    await bank.connect(bridge).increaseBalance(account2.address, initialBalance)

    await bank
      .connect(account1)
      .approveBalance(application.address, initialBalance)
    await bank
      .connect(account2)
      .approveBalance(application.address, initialBalance)
  })

  describe("constructor", () => {
    context("when called with a 0-address bank", () => {
      it("should revert", async () => {
        const Application = await ethers.getContractFactory("Application")
        await expect(
          Application.deploy(ZERO_ADDRESS, tbtc.address)
        ).to.be.revertedWith("Bank can not be the zero address")
      })
    })

    context("when called with a 0-address TBTC token", () => {
      it("should revert", async () => {
        const Application = await ethers.getContractFactory("Application")
        await expect(
          Application.deploy(bank.address, ZERO_ADDRESS)
        ).to.be.revertedWith("TBTC token can not be the zero address")
      })
    })

    context("when called with correct parameters", () => {
      it("should set the Bank field", async () => {
        expect(await application.bank()).to.equal(bank.address)
      })

      it("should set the TBTC token field", async () => {
        expect(await application.tbtcToken()).to.equal(tbtc.address)
      })
    })
  })

  describe("mint", () => {
    context("when minter has not enough balance in the bank", () => {
      const amount = initialBalance.add(1)

      before(async () => {
        await createSnapshot()
        await bank.connect(account1).approveBalance(application.address, amount)
      })

      after(async () => {
        await restoreSnapshot()
      })

      it("should revert", async () => {
        await expect(
          application.connect(account1).mint(amount)
        ).to.be.revertedWith("Amount exceeds balance in the bank")
      })
    })

    context("when there is a single minter", async () => {
      const amount = to1e18(13) // 3 + 1 + 9 = 13

      const transactions: ContractTransaction[] = []

      before(async () => {
        await createSnapshot()

        transactions.push(await application.connect(account1).mint(to1e18(3)))
        transactions.push(await application.connect(account1).mint(to1e18(1)))
        transactions.push(await application.connect(account1).mint(to1e18(9)))
      })

      after(async () => {
        await restoreSnapshot()
      })

      it("should transfer balance to the application", async () => {
        expect(await bank.balanceOf(application.address)).to.equal(amount)
        expect(await bank.balanceOf(account1.address)).to.equal(
          initialBalance.sub(amount)
        )
      })

      it("should mint TBTC", async () => {
        expect(await tbtc.balanceOf(account1.address)).to.equal(amount)
        expect(await tbtc.totalSupply()).to.equal(amount)
      })

      it("should emit Minted event", async () => {
        await expect(transactions[0])
          .to.emit(application, "Minted")
          .withArgs(account1.address, to1e18(3))
        await expect(transactions[1])
          .to.emit(application, "Minted")
          .withArgs(account1.address, to1e18(1))
        await expect(transactions[2])
          .to.emit(application, "Minted")
          .withArgs(account1.address, to1e18(9))
      })
    })

    context("when there are multiple minters", async () => {
      const amount1 = to1e18(13) // 3 + 1 + 9 = 13
      const amount2 = to1e18(3) // 1 + 2 = 3

      const transactions: ContractTransaction[] = []

      before(async () => {
        await createSnapshot()

        transactions.push(await application.connect(account1).mint(to1e18(3)))
        transactions.push(await application.connect(account2).mint(to1e18(1)))
        transactions.push(await application.connect(account1).mint(to1e18(1)))
        transactions.push(await application.connect(account1).mint(to1e18(9)))
        transactions.push(await application.connect(account2).mint(to1e18(2)))
      })

      after(async () => {
        await restoreSnapshot()
      })

      it("should transfer balances to the application", async () => {
        expect(await bank.balanceOf(application.address)).to.equal(
          amount1.add(amount2)
        )
        expect(await bank.balanceOf(account1.address)).to.equal(
          initialBalance.sub(amount1)
        )
        expect(await bank.balanceOf(account2.address)).to.equal(
          initialBalance.sub(amount2)
        )
      })

      it("should mint TBTC", async () => {
        expect(await tbtc.balanceOf(account1.address)).to.equal(amount1)
        expect(await tbtc.balanceOf(account2.address)).to.equal(amount2)
        expect(await tbtc.totalSupply()).to.equal(amount1.add(amount2))
      })

      it("should emit Minted event", async () => {
        await expect(transactions[0])
          .to.emit(application, "Minted")
          .withArgs(account1.address, to1e18(3))
        await expect(transactions[1])
          .to.emit(application, "Minted")
          .withArgs(account2.address, to1e18(1))
        await expect(transactions[2])
          .to.emit(application, "Minted")
          .withArgs(account1.address, to1e18(1))
        await expect(transactions[3])
          .to.emit(application, "Minted")
          .withArgs(account1.address, to1e18(9))
        await expect(transactions[4])
          .to.emit(application, "Minted")
          .withArgs(account2.address, to1e18(2))
      })
    })
  })

  describe("redeem", () => {
    context("when the redeemer has no TBTC", () => {
      const amount = to1e18(1)
      before(async () => {
        await createSnapshot()

        await tbtc.connect(account1).approve(application.address, amount)
      })

      after(async () => {
        await restoreSnapshot()
      })

      it("should revert", async () => {
        await expect(
          application.connect(account1).redeem(to1e18(1))
        ).to.be.revertedWith("Burn amount exceeds balance")
      })
    })

    context("when the redeemer has not enough TBTC", () => {
      const mintedAmount = to1e18(1)
      const redeemedAmount = mintedAmount.add(1)

      before(async () => {
        await createSnapshot()

        await application.connect(account1).mint(mintedAmount)
        await tbtc
          .connect(account1)
          .approve(application.address, redeemedAmount)
      })

      after(async () => {
        await restoreSnapshot()
      })

      it("should revert", async () => {
        await expect(
          application.connect(account1).redeem(redeemedAmount)
        ).to.be.revertedWith("Burn amount exceeds balance")
      })
    })

    context("when there is a single redeemer", () => {
      const mintedAmount = to1e18(20)
      const redeemedAmount = to1e18(12) // 1 + 3 + 8 = 12
      const notRedeemedAmount = mintedAmount.sub(redeemedAmount)

      const transactions: ContractTransaction[] = []

      before(async () => {
        await createSnapshot()

        await application.connect(account1).mint(mintedAmount)
        await tbtc
          .connect(account1)
          .approve(application.address, redeemedAmount)
        transactions.push(await application.connect(account1).redeem(to1e18(1)))
        transactions.push(await application.connect(account1).redeem(to1e18(3)))
        transactions.push(await application.connect(account1).redeem(to1e18(8)))
      })

      after(async () => {
        await restoreSnapshot()
      })

      it("should transfer balance to the redeemer", async () => {
        expect(await bank.balanceOf(application.address)).to.equal(
          notRedeemedAmount
        )
        expect(await bank.balanceOf(account1.address)).to.equal(
          initialBalance.sub(notRedeemedAmount)
        )
      })

      it("should burn TBTC", async () => {
        expect(await tbtc.balanceOf(account1.address)).to.equal(
          notRedeemedAmount
        )
        expect(await tbtc.totalSupply()).to.be.equal(notRedeemedAmount)
      })

      it("should emit Redeemed events", async () => {
        await expect(transactions[0])
          .to.emit(application, "Redeemed")
          .withArgs(account1.address, to1e18(1))
        await expect(transactions[1])
          .to.emit(application, "Redeemed")
          .withArgs(account1.address, to1e18(3))
        await expect(transactions[2])
          .to.emit(application, "Redeemed")
          .withArgs(account1.address, to1e18(8))
      })
    })

    context("when there are multiple redeemers", () => {
      const mintedAmount1 = to1e18(20)
      const redeemedAmount1 = to1e18(12) // 1 + 3 + 8 = 12
      const notRedeemedAmount1 = mintedAmount1.sub(redeemedAmount1)

      const mintedAmount2 = to1e18(41)
      const redeemedAmount2 = to1e18(30) // 20 + 10 = 30
      const notRedeemedAmount2 = mintedAmount2.sub(redeemedAmount2)

      const transactions: ContractTransaction[] = []

      before(async () => {
        await createSnapshot()

        await application.connect(account1).mint(mintedAmount1)
        await application.connect(account2).mint(mintedAmount2)
        await tbtc
          .connect(account1)
          .approve(application.address, redeemedAmount1)
        await tbtc
          .connect(account2)
          .approve(application.address, redeemedAmount2)
        transactions.push(await application.connect(account1).redeem(to1e18(1)))
        transactions.push(
          await application.connect(account2).redeem(to1e18(20))
        )
        transactions.push(await application.connect(account1).redeem(to1e18(3)))
        transactions.push(await application.connect(account1).redeem(to1e18(8)))
        transactions.push(
          await application.connect(account2).redeem(to1e18(10))
        )
      })

      after(async () => {
        await restoreSnapshot()
      })

      it("should transfer balances to redeemers", async () => {
        expect(await bank.balanceOf(application.address)).to.equal(
          notRedeemedAmount1.add(notRedeemedAmount2)
        )
        expect(await bank.balanceOf(account1.address)).to.equal(
          initialBalance.sub(notRedeemedAmount1)
        )
        expect(await bank.balanceOf(account2.address)).to.equal(
          initialBalance.sub(notRedeemedAmount2)
        )
      })

      it("should burn TBTC", async () => {
        expect(await tbtc.balanceOf(account1.address)).to.equal(
          notRedeemedAmount1
        )
        expect(await tbtc.balanceOf(account2.address)).to.equal(
          notRedeemedAmount2
        )
        expect(await tbtc.totalSupply()).to.be.equal(
          notRedeemedAmount1.add(notRedeemedAmount2)
        )
      })

      it("should emit Redeemed events", async () => {
        await expect(transactions[0])
          .to.emit(application, "Redeemed")
          .withArgs(account1.address, to1e18(1))
        await expect(transactions[1])
          .to.emit(application, "Redeemed")
          .withArgs(account2.address, to1e18(20))
        await expect(transactions[2])
          .to.emit(application, "Redeemed")
          .withArgs(account1.address, to1e18(3))
        await expect(transactions[3])
          .to.emit(application, "Redeemed")
          .withArgs(account1.address, to1e18(8))
        await expect(transactions[4])
          .to.emit(application, "Redeemed")
          .withArgs(account2.address, to1e18(10))
      })
    })
  })

  describe("receiveApproval", () => {
    context("when called not for TBTC token", () => {
      it("should revert", async () => {
        await expect(
          application
            .connect(account1)
            .receiveApproval(account1.address, to1e18(1), account1.address, [])
        ).to.be.revertedWith("Token is not TBTC")
      })
    })

    context("when called directly", () => {
      it("should revert", async () => {
        await expect(
          application
            .connect(account1)
            .receiveApproval(account1.address, to1e18(1), tbtc.address, [])
        ).to.be.revertedWith("Only TBTC caller allowed")
      })
    })

    context("when called via approveAndCall", () => {
      const mintedAmount = to1e18(10)
      const redeemedAmount = to1e18(4)
      const notRedeemedAmount = mintedAmount.sub(redeemedAmount)

      let tx

      before(async () => {
        await createSnapshot()

        await application.connect(account1).mint(mintedAmount)
        await tbtc
          .connect(account1)
          .approve(application.address, redeemedAmount)
        tx = await tbtc
          .connect(account1)
          .approveAndCall(application.address, redeemedAmount, [])
      })

      after(async () => {
        await restoreSnapshot()
      })

      it("should transfer balance to the redeemer", async () => {
        expect(await bank.balanceOf(application.address)).to.equal(
          notRedeemedAmount
        )
        expect(await bank.balanceOf(account1.address)).to.equal(
          initialBalance.sub(notRedeemedAmount)
        )
      })

      it("should burn TBTC", async () => {
        expect(await tbtc.balanceOf(account1.address)).to.equal(
          notRedeemedAmount
        )
        expect(await tbtc.totalSupply()).to.be.equal(notRedeemedAmount)
      })

      it("should emit Redeemed event", async () => {
        await expect(tx)
          .to.emit(application, "Redeemed")
          .withArgs(account1.address, redeemedAmount)
      })
    })
  })
})
