import { SignerWithAddress } from "@nomiclabs/hardhat-ethers/signers"
import { ethers, getUnnamedAccounts, helpers, waffle } from "hardhat"
import { expect } from "chai"

import { ContractTransaction } from "ethers"
import type { Bank, TBTC, Vault } from "../../typechain"

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

  const Vault = await ethers.getContractFactory("Vault")
  const vault = await Vault.deploy(bank.address, tbtc.address)
  await vault.deployed()

  await tbtc.connect(deployer).transferOwnership(vault.address)

  return {
    bridge,
    bank,
    vault,
    tbtc,
  }
}

describe("Vault", () => {
  let bridge: SignerWithAddress
  let bank: Bank
  let vault: Vault
  let tbtc: TBTC

  const initialBalance = to1e18(100)

  let account1: SignerWithAddress
  let account2: SignerWithAddress

  before(async () => {
    // eslint-disable-next-line @typescript-eslint/no-extra-semi
    ;({ bridge, bank, vault, tbtc } = await waffle.loadFixture(fixture))

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
        await expect(
          Vault.deploy(ZERO_ADDRESS, tbtc.address)
        ).to.be.revertedWith("Bank can not be the zero address")
      })
    })

    context("when called with a 0-address TBTC token", () => {
      it("should revert", async () => {
        const Vault = await ethers.getContractFactory("Vault")
        await expect(
          Vault.deploy(bank.address, ZERO_ADDRESS)
        ).to.be.revertedWith("TBTC token can not be the zero address")
      })
    })

    context("when called with correct parameters", () => {
      it("should set the Bank field", async () => {
        expect(await vault.bank()).to.equal(bank.address)
      })

      it("should set the TBTC token field", async () => {
        expect(await vault.tbtcToken()).to.equal(tbtc.address)
      })
    })
  })

  describe("mint", () => {
    context("when minter has not enough balance in the bank", () => {
      const amount = initialBalance.add(1)

      before(async () => {
        await createSnapshot()
        await bank.connect(account1).approveBalance(vault.address, amount)
      })

      after(async () => {
        await restoreSnapshot()
      })

      it("should revert", async () => {
        await expect(vault.connect(account1).mint(amount)).to.be.revertedWith(
          "Amount exceeds balance in the bank"
        )
      })
    })

    context("when there is a single minter", async () => {
      const amount = to1e18(13) // 3 + 1 + 9 = 13

      const transactions: ContractTransaction[] = []

      before(async () => {
        await createSnapshot()

        transactions.push(await vault.connect(account1).mint(to1e18(3)))
        transactions.push(await vault.connect(account1).mint(to1e18(1)))
        transactions.push(await vault.connect(account1).mint(to1e18(9)))
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

      it("should mint TBTC", async () => {
        expect(await tbtc.balanceOf(account1.address)).to.equal(amount)
        expect(await tbtc.totalSupply()).to.equal(amount)
      })

      it("should emit Minted event", async () => {
        await expect(transactions[0])
          .to.emit(vault, "Minted")
          .withArgs(account1.address, to1e18(3))
        await expect(transactions[1])
          .to.emit(vault, "Minted")
          .withArgs(account1.address, to1e18(1))
        await expect(transactions[2])
          .to.emit(vault, "Minted")
          .withArgs(account1.address, to1e18(9))
      })
    })

    context("when there are multiple minters", async () => {
      const amount1 = to1e18(13) // 3 + 1 + 9 = 13
      const amount2 = to1e18(3) // 1 + 2 = 3

      const transactions: ContractTransaction[] = []

      before(async () => {
        await createSnapshot()

        transactions.push(await vault.connect(account1).mint(to1e18(3)))
        transactions.push(await vault.connect(account2).mint(to1e18(1)))
        transactions.push(await vault.connect(account1).mint(to1e18(1)))
        transactions.push(await vault.connect(account1).mint(to1e18(9)))
        transactions.push(await vault.connect(account2).mint(to1e18(2)))
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

      it("should mint TBTC", async () => {
        expect(await tbtc.balanceOf(account1.address)).to.equal(amount1)
        expect(await tbtc.balanceOf(account2.address)).to.equal(amount2)
        expect(await tbtc.totalSupply()).to.equal(amount1.add(amount2))
      })

      it("should emit Minted event", async () => {
        await expect(transactions[0])
          .to.emit(vault, "Minted")
          .withArgs(account1.address, to1e18(3))
        await expect(transactions[1])
          .to.emit(vault, "Minted")
          .withArgs(account2.address, to1e18(1))
        await expect(transactions[2])
          .to.emit(vault, "Minted")
          .withArgs(account1.address, to1e18(1))
        await expect(transactions[3])
          .to.emit(vault, "Minted")
          .withArgs(account1.address, to1e18(9))
        await expect(transactions[4])
          .to.emit(vault, "Minted")
          .withArgs(account2.address, to1e18(2))
      })
    })
  })

  describe("redeem", () => {
    context("when the redeemer has no TBTC", () => {
      const amount = to1e18(1)
      before(async () => {
        await createSnapshot()

        await tbtc.connect(account1).approve(vault.address, amount)
      })

      after(async () => {
        await restoreSnapshot()
      })

      it("should revert", async () => {
        await expect(
          vault.connect(account1).redeem(to1e18(1))
        ).to.be.revertedWith("Burn amount exceeds balance")
      })
    })

    context("when the redeemer has not enough TBTC", () => {
      const mintedAmount = to1e18(1)
      const redeemedAmount = mintedAmount.add(1)

      before(async () => {
        await createSnapshot()

        await vault.connect(account1).mint(mintedAmount)
        await tbtc.connect(account1).approve(vault.address, redeemedAmount)
      })

      after(async () => {
        await restoreSnapshot()
      })

      it("should revert", async () => {
        await expect(
          vault.connect(account1).redeem(redeemedAmount)
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

        await vault.connect(account1).mint(mintedAmount)
        await tbtc.connect(account1).approve(vault.address, redeemedAmount)
        transactions.push(await vault.connect(account1).redeem(to1e18(1)))
        transactions.push(await vault.connect(account1).redeem(to1e18(3)))
        transactions.push(await vault.connect(account1).redeem(to1e18(8)))
      })

      after(async () => {
        await restoreSnapshot()
      })

      it("should transfer balance to the redeemer", async () => {
        expect(await bank.balanceOf(vault.address)).to.equal(notRedeemedAmount)
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
          .to.emit(vault, "Redeemed")
          .withArgs(account1.address, to1e18(1))
        await expect(transactions[1])
          .to.emit(vault, "Redeemed")
          .withArgs(account1.address, to1e18(3))
        await expect(transactions[2])
          .to.emit(vault, "Redeemed")
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

        await vault.connect(account1).mint(mintedAmount1)
        await vault.connect(account2).mint(mintedAmount2)
        await tbtc.connect(account1).approve(vault.address, redeemedAmount1)
        await tbtc.connect(account2).approve(vault.address, redeemedAmount2)
        transactions.push(await vault.connect(account1).redeem(to1e18(1)))
        transactions.push(await vault.connect(account2).redeem(to1e18(20)))
        transactions.push(await vault.connect(account1).redeem(to1e18(3)))
        transactions.push(await vault.connect(account1).redeem(to1e18(8)))
        transactions.push(await vault.connect(account2).redeem(to1e18(10)))
      })

      after(async () => {
        await restoreSnapshot()
      })

      it("should transfer balances to redeemers", async () => {
        expect(await bank.balanceOf(vault.address)).to.equal(
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
          .to.emit(vault, "Redeemed")
          .withArgs(account1.address, to1e18(1))
        await expect(transactions[1])
          .to.emit(vault, "Redeemed")
          .withArgs(account2.address, to1e18(20))
        await expect(transactions[2])
          .to.emit(vault, "Redeemed")
          .withArgs(account1.address, to1e18(3))
        await expect(transactions[3])
          .to.emit(vault, "Redeemed")
          .withArgs(account1.address, to1e18(8))
        await expect(transactions[4])
          .to.emit(vault, "Redeemed")
          .withArgs(account2.address, to1e18(10))
      })
    })
  })

  describe("receiveApproval", () => {
    context("when called not for TBTC token", () => {
      it("should revert", async () => {
        await expect(
          vault
            .connect(account1)
            .receiveApproval(account1.address, to1e18(1), account1.address, [])
        ).to.be.revertedWith("Token is not TBTC")
      })
    })

    context("when called directly", () => {
      it("should revert", async () => {
        await expect(
          vault
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

        await vault.connect(account1).mint(mintedAmount)
        await tbtc.connect(account1).approve(vault.address, redeemedAmount)
        tx = await tbtc
          .connect(account1)
          .approveAndCall(vault.address, redeemedAmount, [])
      })

      after(async () => {
        await restoreSnapshot()
      })

      it("should transfer balance to the redeemer", async () => {
        expect(await bank.balanceOf(vault.address)).to.equal(notRedeemedAmount)
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
          .to.emit(vault, "Redeemed")
          .withArgs(account1.address, redeemedAmount)
      })
    })
  })

  describe("onBalanceIncreased", () => {
    const depositor1 = "0x30c371E0651B2Ff6062158ca1D95b07C7531c719"
    const depositor2 = "0xb3464806d680722dBc678996F1670D19A42eA3e9"
    const depositor3 = "0x6B9925e04bc46569d1F7362eD7f11539234f0aEc"

    const depositedAmount1 = to1e18(19)
    const depositedAmount2 = to1e18(11)
    const depositedAmount3 = to1e18(301)

    const totalDepositedAmount = to1e18(331) // 19 + 11 + 301

    before(async () => {
      await createSnapshot()
    })

    after(async () => {
      await restoreSnapshot()
    })

    context("when called not by the Bank", () => {
      it("should revert", async () => {
        await expect(
          application
            .connect(bridge)
            .onBalanceIncreased([depositor1], [depositedAmount1])
        ).to.be.revertedWith("Caller is not the Bank")
      })
    })

    context("when called with no depositors", () => {
      it("should revert", async () => {
        await expect(
          bank
            .connect(bridge)
            .increaseBalanceAndCall(
              application.address,
              totalDepositedAmount,
              [],
              []
            )
        ).to.be.revertedWith("No depositors specified")
      })
    })

    context(
      "when depositors array has different length than amounts array",
      () => {
        it("should revert", async () => {
          await expect(
            bank
              .connect(bridge)
              .increaseBalanceAndCall(
                application.address,
                depositedAmount1,
                [depositor1, depositor2],
                [depositedAmount1]
              )
          ).to.be.reverted
        })
      }
    )

    context("with single depositor", () => {
      let tx: ContractTransaction

      before(async () => {
        await createSnapshot()

        tx = await bank
          .connect(bridge)
          .increaseBalanceAndCall(
            application.address,
            depositedAmount1,
            [depositor1],
            [depositedAmount1]
          )
      })

      after(async () => {
        await restoreSnapshot()
      })

      it("should mint TBTC", async () => {
        expect(await tbtc.balanceOf(depositor1)).to.equal(depositedAmount1)
        expect(await tbtc.totalSupply()).to.equal(depositedAmount1)
      })

      it("should emit Minted event", async () => {
        await expect(tx)
          .to.emit(application, "Minted")
          .withArgs(depositor1, depositedAmount1)
      })
    })

    context("with multiple depositors", () => {
      let tx: ContractTransaction

      before(async () => {
        await createSnapshot()

        tx = await bank
          .connect(bridge)
          .increaseBalanceAndCall(
            application.address,
            totalDepositedAmount,
            [depositor1, depositor2, depositor3],
            [depositedAmount1, depositedAmount2, depositedAmount3]
          )
      })

      after(async () => {
        await restoreSnapshot()
      })

      it("should mint TBTC", async () => {
        expect(await tbtc.balanceOf(depositor1)).to.equal(depositedAmount1)
        expect(await tbtc.balanceOf(depositor2)).to.equal(depositedAmount2)
        expect(await tbtc.balanceOf(depositor3)).to.equal(depositedAmount3)
        expect(await tbtc.totalSupply()).to.equal(totalDepositedAmount)
      })

      it("should emit Minted events", async () => {
        await expect(tx)
          .to.emit(application, "Minted")
          .withArgs(depositor1, depositedAmount1)
        await expect(tx)
          .to.emit(application, "Minted")
          .withArgs(depositor2, depositedAmount2)
        await expect(tx)
          .to.emit(application, "Minted")
          .withArgs(depositor3, depositedAmount3)
      })
    })
  })
})
