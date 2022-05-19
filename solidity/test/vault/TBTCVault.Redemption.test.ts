import { SignerWithAddress } from "@nomiclabs/hardhat-ethers/signers"
import { ethers, getUnnamedAccounts, helpers, waffle } from "hardhat"
import { expect } from "chai"
import { ContractTransaction } from "ethers"
import { BytesLike } from "@ethersproject/bytes"

import { walletState } from "../fixtures"
import bridgeFixture from "../fixtures/bridge"

import type {
  Bank,
  BankStub,
  Bridge,
  BridgeStub,
  TBTC,
  TBTCVault,
  VendingMachine,
} from "../../typechain"

const { to1e18 } = helpers.number
const { createSnapshot, restoreSnapshot } = helpers.snapshot
const { increaseTime, lastBlockTime } = helpers.time
const { defaultAbiCoder } = ethers.utils

describe("TBTCVault - Redemption", () => {
  const walletPubKeyHash = "0x8db50eb52063ea9d98b3eac91489a90f738986f6"
  const mainUtxo = {
    txHash:
      "0x3835ecdee2daa83c9a19b5012104ace55ecab197b5e16489c26d372e475f5d2a",
    txOutputIndex: 0,
    txOutputValue: 10000000,
  }

  let bridge: Bridge & BridgeStub
  let bank: Bank & BankStub
  let tbtc: TBTC
  let vendingMachine: VendingMachine
  let tbtcVault: TBTCVault

  let deployer: SignerWithAddress
  let account1: SignerWithAddress
  let account2: SignerWithAddress

  before(async () => {
    // eslint-disable-next-line @typescript-eslint/no-extra-semi
    ;({ deployer } = await helpers.signers.getNamedSigners())

    // eslint-disable-next-line @typescript-eslint/no-extra-semi
    ;({ bridge, bank, tbtcVault, tbtc, vendingMachine } =
      await waffle.loadFixture(bridgeFixture))

    // Deployment scripts deploy both `VendingMachine` and `TBTCVault` but they
    // do not transfer the ownership of `TBTC` token to `TBTCVault`.
    // We need to do it manually in tests covering `TBTCVault` behavior.
    // Also, please note that `03_transfer_roles.ts` assigning `VendingMachine`
    // upgrade initiator role to Keep Technical Wallet is skipped for Hardhat
    // env deployment. That's why the upgrade initiator and `VendingMachine`
    // owner is the deployer.
    await vendingMachine
      .connect(deployer)
      .initiateVendingMachineUpgrade(tbtcVault.address)
    await increaseTime(await vendingMachine.GOVERNANCE_DELAY())
    await vendingMachine.connect(deployer).finalizeVendingMachineUpgrade()

    const accounts = await getUnnamedAccounts()
    account1 = await ethers.getSigner(accounts[0])
    account2 = await ethers.getSigner(accounts[1])

    const initialBankBalance = to1e18(100)
    await bank.setBalance(account1.address, initialBankBalance)
    await bank.setBalance(account2.address, initialBankBalance)
    await bank
      .connect(account1)
      .approveBalance(tbtcVault.address, initialBankBalance)
    await bank
      .connect(account2)
      .approveBalance(tbtcVault.address, initialBankBalance)

    await bridge.setWallet(walletPubKeyHash, {
      ecdsaWalletID: ethers.constants.HashZero,
      mainUtxoHash: ethers.constants.HashZero,
      pendingRedemptionsValue: 0,
      createdAt: await lastBlockTime(),
      movingFundsRequestedAt: 0,
      closingStartedAt: 0,
      pendingMovedFundsSweepRequestsCount: 0,
      state: walletState.Live,
      movingFundsTargetWalletsCommitmentHash: ethers.constants.HashZero,
    })
    await bridge.setWalletMainUtxo(walletPubKeyHash, mainUtxo)
  })

  describe("unmintAndRedeem", () => {
    const requestRedemption = async (
      redeemer: SignerWithAddress,
      redeemerOutputScript: string,
      amount: number
    ): Promise<ContractTransaction> => {
      const data = defaultAbiCoder.encode(
        ["address", "bytes20", "bytes32", "uint32", "uint64", "bytes"],
        [
          redeemer.address,
          walletPubKeyHash,
          mainUtxo.txHash,
          mainUtxo.txOutputIndex,
          mainUtxo.txOutputValue,
          redeemerOutputScript,
        ]
      )

      return tbtcVault.connect(redeemer).unmintAndRedeem(amount, data)
    }

    context("when the redeemer has no TBTC", () => {
      const amount = to1e18(1)
      before(async () => {
        await createSnapshot()

        await tbtc.connect(account1).approve(tbtcVault.address, amount)
      })

      after(async () => {
        await restoreSnapshot()
      })

      it("should revert", async () => {
        await expect(
          tbtcVault.connect(account1).unmintAndRedeem(to1e18(1), [])
        ).to.be.revertedWith("Burn amount exceeds balance")
      })
    })

    context("when the redeemer has not enough TBTC", () => {
      const mintedAmount = to1e18(1)
      const redeemedAmount = mintedAmount.add(1)

      before(async () => {
        await createSnapshot()

        await tbtcVault.connect(account1).mint(mintedAmount)
        await tbtc.connect(account1).approve(tbtcVault.address, redeemedAmount)
      })

      after(async () => {
        await restoreSnapshot()
      })

      it("should revert", async () => {
        await expect(
          tbtcVault.connect(account1).unmintAndRedeem(redeemedAmount, [])
        ).to.be.revertedWith("Burn amount exceeds balance")
      })
    })

    context("when there is a single redeemer", () => {
      const redeemerOutputScriptP2WPKH =
        "0x160014f4eedc8f40d4b8e30771f792b065ebec0abaddef"
      const redeemerOutputScriptP2WSH =
        "0x220020ef0b4d985752aa5ef6243e4c6f6bebc2a007e7d671ef27d4b1d0db8dcc93bc1c"
      const redeemerOutputScriptP2PKH =
        "0x1976a914f4eedc8f40d4b8e30771f792b065ebec0abaddef88ac"
      const redeemerOutputScriptP2SH =
        "0x17a914f4eedc8f40d4b8e30771f792b065ebec0abaddef87"

      const mintedAmount = 10000000
      const redeemedAmount1 = 1000000
      const redeemedAmount2 = 2000000
      const redeemedAmount3 = 3000000
      const redeemedAmount4 = 1500000
      const totalRedeemedAmount =
        redeemedAmount1 + redeemedAmount2 + redeemedAmount3 + redeemedAmount4
      const notRedeemedAmount = mintedAmount - totalRedeemedAmount

      const transactions: ContractTransaction[] = []

      before(async () => {
        await createSnapshot()

        await tbtcVault.connect(account1).mint(mintedAmount)
        await tbtc.connect(account1).approve(tbtcVault.address, mintedAmount)

        transactions.push(
          await requestRedemption(
            account1,
            redeemerOutputScriptP2WPKH,
            redeemedAmount1
          )
        )
        transactions.push(
          await requestRedemption(
            account1,
            redeemerOutputScriptP2WSH,
            redeemedAmount2
          )
        )
        transactions.push(
          await requestRedemption(
            account1,
            redeemerOutputScriptP2PKH,
            redeemedAmount3
          )
        )
        transactions.push(
          await requestRedemption(
            account1,
            redeemerOutputScriptP2SH,
            redeemedAmount4
          )
        )
      })

      after(async () => {
        await restoreSnapshot()
      })

      it("should transfer balances to Bridge", async () => {
        expect(await bank.balanceOf(tbtcVault.address)).to.equal(
          notRedeemedAmount
        )
        expect(await bank.balanceOf(bridge.address)).to.equal(
          totalRedeemedAmount
        )
      })

      it("should request redemptions in Bridge", async () => {
        const redemptionRequest1 = await bridge.pendingRedemptions(
          buildRedemptionKey(walletPubKeyHash, redeemerOutputScriptP2WPKH)
        )
        expect(redemptionRequest1.redeemer).to.be.equal(account1.address)
        expect(redemptionRequest1.requestedAmount).to.be.equal(redeemedAmount1)

        const redemptionRequest2 = await bridge.pendingRedemptions(
          buildRedemptionKey(walletPubKeyHash, redeemerOutputScriptP2WSH)
        )
        expect(redemptionRequest2.redeemer).to.be.equal(account1.address)
        expect(redemptionRequest2.requestedAmount).to.be.equal(redeemedAmount2)

        const redemptionRequest3 = await bridge.pendingRedemptions(
          buildRedemptionKey(walletPubKeyHash, redeemerOutputScriptP2PKH)
        )
        expect(redemptionRequest3.redeemer).to.be.equal(account1.address)
        expect(redemptionRequest3.requestedAmount).to.be.equal(redeemedAmount3)

        const redemptionRequest4 = await bridge.pendingRedemptions(
          buildRedemptionKey(walletPubKeyHash, redeemerOutputScriptP2SH)
        )
        expect(redemptionRequest4.redeemer).to.be.equal(account1.address)
        expect(redemptionRequest4.requestedAmount).to.be.equal(redeemedAmount4)
      })

      it("should burn TBTC", async () => {
        expect(await tbtc.balanceOf(account1.address)).to.equal(
          notRedeemedAmount
        )
        expect(await tbtc.totalSupply()).to.be.equal(notRedeemedAmount)
      })

      it("should emit Unminted events", async () => {
        await expect(transactions[0])
          .to.emit(tbtcVault, "Unminted")
          .withArgs(account1.address, redeemedAmount1)
        await expect(transactions[1])
          .to.emit(tbtcVault, "Unminted")
          .withArgs(account1.address, redeemedAmount2)
        await expect(transactions[2])
          .to.emit(tbtcVault, "Unminted")
          .withArgs(account1.address, redeemedAmount3)
        await expect(transactions[3])
          .to.emit(tbtcVault, "Unminted")
          .withArgs(account1.address, redeemedAmount4)
      })
    })

    context("when there are multiple redeemers", () => {
      const redeemerOutputScriptP2WPKH =
        "0x160014f4eedc8f40d4b8e30771f792b065ebec0abaddef"
      const redeemerOutputScriptP2WSH =
        "0x220020ef0b4d985752aa5ef6243e4c6f6bebc2a007e7d671ef27d4b1d0db8dcc93bc1c"

      const mintedAmount1 = 10000000
      const mintedAmount2 = 20000000
      const redeemedAmount1 = 1000000
      const redeemedAmount2 = 2000000

      const totalMintedAmount = mintedAmount1 + mintedAmount2
      const totalRedeemedAmount = redeemedAmount1 + redeemedAmount2
      const totalNotRedeemedAmount = totalMintedAmount - totalRedeemedAmount

      const transactions: ContractTransaction[] = []

      before(async () => {
        await createSnapshot()

        await tbtcVault.connect(account1).mint(mintedAmount1)
        await tbtc.connect(account1).approve(tbtcVault.address, mintedAmount1)

        await tbtcVault.connect(account2).mint(mintedAmount2)
        await tbtc.connect(account2).approve(tbtcVault.address, mintedAmount2)

        transactions.push(
          await requestRedemption(
            account1,
            redeemerOutputScriptP2WPKH,
            redeemedAmount1
          )
        )
        transactions.push(
          await requestRedemption(
            account2,
            redeemerOutputScriptP2WSH,
            redeemedAmount2
          )
        )
      })

      after(async () => {
        await restoreSnapshot()
      })

      it("should transfer balances to Bridge", async () => {
        expect(await bank.balanceOf(tbtcVault.address)).to.equal(
          totalNotRedeemedAmount
        )
        expect(await bank.balanceOf(bridge.address)).to.equal(
          totalRedeemedAmount
        )
      })

      it("should request redemptions in Bridge", async () => {
        const redemptionRequest1 = await bridge.pendingRedemptions(
          buildRedemptionKey(walletPubKeyHash, redeemerOutputScriptP2WPKH)
        )
        expect(redemptionRequest1.redeemer).to.be.equal(account1.address)
        expect(redemptionRequest1.requestedAmount).to.be.equal(redeemedAmount1)

        const redemptionRequest2 = await bridge.pendingRedemptions(
          buildRedemptionKey(walletPubKeyHash, redeemerOutputScriptP2WSH)
        )
        expect(redemptionRequest2.redeemer).to.be.equal(account2.address)
        expect(redemptionRequest2.requestedAmount).to.be.equal(redeemedAmount2)
      })

      it("should burn TBTC", async () => {
        expect(await tbtc.balanceOf(account1.address)).to.equal(
          mintedAmount1 - redeemedAmount1
        )
        expect(await tbtc.balanceOf(account2.address)).to.equal(
          mintedAmount2 - redeemedAmount2
        )
        expect(await tbtc.totalSupply()).to.be.equal(totalNotRedeemedAmount)
      })

      it("should emit Unminted events", async () => {
        await expect(transactions[0])
          .to.emit(tbtcVault, "Unminted")
          .withArgs(account1.address, redeemedAmount1)
        await expect(transactions[1])
          .to.emit(tbtcVault, "Unminted")
          .withArgs(account2.address, redeemedAmount2)
      })
    })
  })

  describe("receiveApproval", () => {
    const requestRedemption = async (
      redeemer: SignerWithAddress,
      redeemerOutputScript: string,
      amount: number
    ): Promise<ContractTransaction> => {
      const data = defaultAbiCoder.encode(
        ["address", "bytes20", "bytes32", "uint32", "uint64", "bytes"],
        [
          redeemer.address,
          walletPubKeyHash,
          mainUtxo.txHash,
          mainUtxo.txOutputIndex,
          mainUtxo.txOutputValue,
          redeemerOutputScript,
        ]
      )

      return tbtc
        .connect(redeemer)
        .approveAndCall(tbtcVault.address, amount, data)
    }

    context("when called via approveAndCall", () => {
      context("when called with non-empty extraData", () => {
        context("when there is a single redeemer", () => {
          const redeemerOutputScriptP2WPKH =
            "0x160014f4eedc8f40d4b8e30771f792b065ebec0abaddef"
          const redeemerOutputScriptP2WSH =
            "0x220020ef0b4d985752aa5ef6243e4c6f6bebc2a007e7d671ef27d4b1d0db8dcc93bc1c"
          const redeemerOutputScriptP2PKH =
            "0x1976a914f4eedc8f40d4b8e30771f792b065ebec0abaddef88ac"
          const redeemerOutputScriptP2SH =
            "0x17a914f4eedc8f40d4b8e30771f792b065ebec0abaddef87"

          const mintedAmount = 10000000
          const redeemedAmount1 = 1000000
          const redeemedAmount2 = 2000000
          const redeemedAmount3 = 3000000
          const redeemedAmount4 = 1500000
          const totalRedeemedAmount =
            redeemedAmount1 +
            redeemedAmount2 +
            redeemedAmount3 +
            redeemedAmount4
          const notRedeemedAmount = mintedAmount - totalRedeemedAmount

          const transactions: ContractTransaction[] = []

          before(async () => {
            await createSnapshot()

            await tbtcVault.connect(account1).mint(mintedAmount)

            transactions.push(
              await requestRedemption(
                account1,
                redeemerOutputScriptP2WPKH,
                redeemedAmount1
              )
            )
            transactions.push(
              await requestRedemption(
                account1,
                redeemerOutputScriptP2WSH,
                redeemedAmount2
              )
            )
            transactions.push(
              await requestRedemption(
                account1,
                redeemerOutputScriptP2PKH,
                redeemedAmount3
              )
            )
            transactions.push(
              await requestRedemption(
                account1,
                redeemerOutputScriptP2SH,
                redeemedAmount4
              )
            )
          })

          after(async () => {
            await restoreSnapshot()
          })

          it("should transfer balances to Bridge", async () => {
            expect(await bank.balanceOf(tbtcVault.address)).to.equal(
              notRedeemedAmount
            )
            expect(await bank.balanceOf(bridge.address)).to.equal(
              totalRedeemedAmount
            )
          })

          it("should request redemptions in Bridge", async () => {
            const redemptionRequest1 = await bridge.pendingRedemptions(
              buildRedemptionKey(walletPubKeyHash, redeemerOutputScriptP2WPKH)
            )
            expect(redemptionRequest1.redeemer).to.be.equal(account1.address)
            expect(redemptionRequest1.requestedAmount).to.be.equal(
              redeemedAmount1
            )

            const redemptionRequest2 = await bridge.pendingRedemptions(
              buildRedemptionKey(walletPubKeyHash, redeemerOutputScriptP2WSH)
            )
            expect(redemptionRequest2.redeemer).to.be.equal(account1.address)
            expect(redemptionRequest2.requestedAmount).to.be.equal(
              redeemedAmount2
            )

            const redemptionRequest3 = await bridge.pendingRedemptions(
              buildRedemptionKey(walletPubKeyHash, redeemerOutputScriptP2PKH)
            )
            expect(redemptionRequest3.redeemer).to.be.equal(account1.address)
            expect(redemptionRequest3.requestedAmount).to.be.equal(
              redeemedAmount3
            )

            const redemptionRequest4 = await bridge.pendingRedemptions(
              buildRedemptionKey(walletPubKeyHash, redeemerOutputScriptP2SH)
            )
            expect(redemptionRequest4.redeemer).to.be.equal(account1.address)
            expect(redemptionRequest4.requestedAmount).to.be.equal(
              redeemedAmount4
            )
          })

          it("should burn TBTC", async () => {
            expect(await tbtc.balanceOf(account1.address)).to.equal(
              notRedeemedAmount
            )
            expect(await tbtc.totalSupply()).to.be.equal(notRedeemedAmount)
          })

          it("should emit Unminted events", async () => {
            await expect(transactions[0])
              .to.emit(tbtcVault, "Unminted")
              .withArgs(account1.address, redeemedAmount1)
            await expect(transactions[1])
              .to.emit(tbtcVault, "Unminted")
              .withArgs(account1.address, redeemedAmount2)
            await expect(transactions[2])
              .to.emit(tbtcVault, "Unminted")
              .withArgs(account1.address, redeemedAmount3)
            await expect(transactions[3])
              .to.emit(tbtcVault, "Unminted")
              .withArgs(account1.address, redeemedAmount4)
          })
        })

        context("when there are multiple redeemers", () => {
          const redeemerOutputScriptP2WPKH =
            "0x160014f4eedc8f40d4b8e30771f792b065ebec0abaddef"
          const redeemerOutputScriptP2WSH =
            "0x220020ef0b4d985752aa5ef6243e4c6f6bebc2a007e7d671ef27d4b1d0db8dcc93bc1c"

          const mintedAmount1 = 10000000
          const mintedAmount2 = 20000000
          const redeemedAmount1 = 1000000
          const redeemedAmount2 = 2000000

          const totalMintedAmount = mintedAmount1 + mintedAmount2
          const totalRedeemedAmount = redeemedAmount1 + redeemedAmount2
          const totalNotRedeemedAmount = totalMintedAmount - totalRedeemedAmount

          const transactions: ContractTransaction[] = []

          before(async () => {
            await createSnapshot()

            await tbtcVault.connect(account1).mint(mintedAmount1)
            await tbtcVault.connect(account2).mint(mintedAmount2)

            transactions.push(
              await requestRedemption(
                account1,
                redeemerOutputScriptP2WPKH,
                redeemedAmount1
              )
            )
            transactions.push(
              await requestRedemption(
                account2,
                redeemerOutputScriptP2WSH,
                redeemedAmount2
              )
            )
          })

          after(async () => {
            await restoreSnapshot()
          })

          it("should transfer balances to Bridge", async () => {
            expect(await bank.balanceOf(tbtcVault.address)).to.equal(
              totalNotRedeemedAmount
            )
            expect(await bank.balanceOf(bridge.address)).to.equal(
              totalRedeemedAmount
            )
          })

          it("should request redemptions in Bridge", async () => {
            const redemptionRequest1 = await bridge.pendingRedemptions(
              buildRedemptionKey(walletPubKeyHash, redeemerOutputScriptP2WPKH)
            )
            expect(redemptionRequest1.redeemer).to.be.equal(account1.address)
            expect(redemptionRequest1.requestedAmount).to.be.equal(
              redeemedAmount1
            )

            const redemptionRequest2 = await bridge.pendingRedemptions(
              buildRedemptionKey(walletPubKeyHash, redeemerOutputScriptP2WSH)
            )
            expect(redemptionRequest2.redeemer).to.be.equal(account2.address)
            expect(redemptionRequest2.requestedAmount).to.be.equal(
              redeemedAmount2
            )
          })

          it("should burn TBTC", async () => {
            expect(await tbtc.balanceOf(account1.address)).to.equal(
              mintedAmount1 - redeemedAmount1
            )
            expect(await tbtc.balanceOf(account2.address)).to.equal(
              mintedAmount2 - redeemedAmount2
            )
            expect(await tbtc.totalSupply()).to.be.equal(totalNotRedeemedAmount)
          })

          it("should emit Unminted events", async () => {
            await expect(transactions[0])
              .to.emit(tbtcVault, "Unminted")
              .withArgs(account1.address, redeemedAmount1)
            await expect(transactions[1])
              .to.emit(tbtcVault, "Unminted")
              .withArgs(account2.address, redeemedAmount2)
          })
        })
      })
    })
  })
})

function buildRedemptionKey(
  walletPubKeyHash: BytesLike,
  redeemerOutputScript: BytesLike
): string {
  return ethers.utils.solidityKeccak256(
    ["bytes20", "bytes"],
    [walletPubKeyHash, redeemerOutputScript]
  )
}
