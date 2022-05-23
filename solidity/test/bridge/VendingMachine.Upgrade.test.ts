import { SignerWithAddress } from "@nomiclabs/hardhat-ethers/signers"
import { ethers, helpers, waffle } from "hardhat"
import { expect } from "chai"
import { FakeContract } from "@defi-wonderland/smock"

import { walletState } from "../fixtures"
import bridgeFixture from "../fixtures/bridge"

import { DepositSweepTestData, SingleP2SHDeposit } from "../data/deposit-sweep"

import type {
  Bank,
  Bridge,
  BridgeStub,
  TBTC,
  TBTCVault,
  TestERC20,
  VendingMachine,
  IRelay,
} from "../../typechain"

const { to1e18 } = helpers.number
const { increaseTime, lastBlockTime } = helpers.time

// Test covering `VendingMachine` -> `TBTCVault` upgrade process.
//
// Step #1 - TBTC v1 transfer
//   TBTC v1 is transferred from `VendingMachine` to `TBTCVault` along with
//   TBTC v2 token ownership.
//
// Step #2 - TBTC v1 withdrawal
//   Governance withdraws TBTC v1 from `VendingMachine` *somewhere*.
//   Governance unmints TBTC v1 to BTC *somehow*.
//
// Step #3 - BTC deposits
//   Governance deposits BTC to `TBTCVault`.
//
// Step #4 - functioning system
//   The system works. Users can mint and unmint TBTC v2.
describe("VendingMachine - Upgrade", () => {
  let deployer: SignerWithAddress
  let governance: SignerWithAddress

  let account1: SignerWithAddress
  let account2: SignerWithAddress

  let tbtcV1: TestERC20
  let tbtc: TBTC
  let tbtcVault: TBTCVault
  let bridge: Bridge & BridgeStub
  let bank: Bank
  let vendingMachine: VendingMachine
  let relay: FakeContract<IRelay>

  before(async () => {
    // eslint-disable-next-line @typescript-eslint/no-extra-semi
    ;({ deployer, governance } = await helpers.signers.getNamedSigners())

    // eslint-disable-next-line @typescript-eslint/no-extra-semi
    ;[account1, account2] = await helpers.signers.getUnnamedSigners()

    // eslint-disable-next-line @typescript-eslint/no-extra-semi
    ;({ tbtcVault, tbtc, vendingMachine, bank, bridge, relay } =
      await waffle.loadFixture(bridgeFixture))

    // Set the deposit dust threshold to 0.0001 BTC, i.e. 100x smaller than
    // the initial value in the Bridge in order to save test Bitcoins.
    await bridge.setDepositDustThreshold(10000)

    await bridge.connect(governance).setVaultStatus(tbtcVault.address, true)

    tbtcV1 = await helpers.contracts.getContract("TBTCToken")
    // Two accounts with 10 TBTC v1 each wrap their holdings to TBTC v2.
    const initialTbtcBalance = to1e18(10)
    await tbtcV1.connect(deployer).mint(account1.address, initialTbtcBalance)
    await tbtcV1.connect(deployer).mint(account2.address, initialTbtcBalance)
    await tbtcV1
      .connect(account1)
      .approveAndCall(vendingMachine.address, initialTbtcBalance, [])
    await tbtcV1
      .connect(account2)
      .approveAndCall(vendingMachine.address, initialTbtcBalance, [])

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
  })

  describe("upgrade process", () => {
    // Two accounts with 10 TBTC v1 each wrap their holdings to TBTC v2.
    // See the main `before`.
    const totalTbtcV1Balance = to1e18(20)

    describe("step#1 - TBTC v1 transfer", () => {
      it("should transfer all TBTC v1 to TBTCVault", async () => {
        expect(await tbtcV1.balanceOf(vendingMachine.address)).to.equal(
          to1e18(0)
        )
        expect(await tbtcV1.balanceOf(tbtcVault.address)).to.equal(
          totalTbtcV1Balance
        )
      })
    })

    describe("step#2 - TBTC v1 withdrawal", () => {
      it("should let the governance withdraw TBTC v1 from TBTCVault", async () => {
        await tbtcVault
          .connect(governance)
          .recoverERC20(tbtcV1.address, governance.address, totalTbtcV1Balance)
        expect(await tbtcV1.balanceOf(tbtcVault.address)).to.equal(0)
        expect(await tbtcV1.balanceOf(governance.address)).to.equal(
          totalTbtcV1Balance
        )
      })
    })

    describe("step#3 - BTC deposit", () => {
      before(async () => {
        const data: DepositSweepTestData = JSON.parse(
          JSON.stringify(SingleP2SHDeposit)
        )
        const { fundingTx, reveal } = data.deposits[0] // it's a single deposit
        reveal.vault = tbtcVault.address

        // Simulate the wallet is a Live one and is known in the system.
        await bridge.setWallet(reveal.walletPubKeyHash, {
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

        await bridge.revealDeposit(fundingTx, reveal)

        relay.getCurrentEpochDifficulty.returns(data.chainDifficulty)
        relay.getPrevEpochDifficulty.returns(data.chainDifficulty)

        await bridge.submitDepositSweepProof(
          data.sweepTx,
          data.sweepProof,
          data.mainUtxo,
          tbtcVault.address
        )
      })

      it("should let the governance donate TBTCVault", async () => {
        // The sum of sweep tx inputs is 20000 satoshi. The output
        // value is 18500 so the transaction fee is 1500. There is
        // only one deposit so it incurs the entire transaction fee.
        // The deposit should also incur the treasury fee whose
        // initial value is 0.05% of the deposited amount so the
        // final depositor balance should be cut by 10 satoshi.
        const totalWalletBtcBalance = 18490

        expect(await bank.balanceOf(tbtcVault.address)).to.equal(
          totalWalletBtcBalance
        )
      })
    })

    describe("step#4 - functioning system", () => {
      it("should let TBTC v2 holders unmint their tokens", async () => {
        const initialWalletBtcBalance = 18490
        const unmintedAmount1 = 7000
        const unmintedAmount2 = 1000

        await tbtc.connect(account1).approve(tbtcVault.address, unmintedAmount1)
        await tbtcVault.connect(account1).unmint(unmintedAmount1)

        await tbtc.connect(account2).approve(tbtcVault.address, unmintedAmount2)
        await tbtcVault.connect(account2).unmint(unmintedAmount2)

        expect(await bank.balanceOf(account1.address)).to.equal(unmintedAmount1)
        expect(await bank.balanceOf(account2.address)).to.equal(unmintedAmount2)
        expect(await bank.balanceOf(tbtcVault.address)).to.equal(
          initialWalletBtcBalance - unmintedAmount1 - unmintedAmount2
        )
      })

      it("should let Bank balance holders mint TBTC v2", async () => {
        const initialWalletBtcBalance = 10490 // 18490 - 7000 - 1000
        const mintedAmount1 = 600
        const mintedAmount2 = 100

        const initialTbtcBalance1 = await tbtc.balanceOf(account1.address)
        const initialTbtcBalance2 = await tbtc.balanceOf(account2.address)

        await bank
          .connect(account1)
          .approveBalance(tbtcVault.address, mintedAmount1)
        await tbtcVault.connect(account1).mint(mintedAmount1)

        await bank
          .connect(account2)
          .approveBalance(tbtcVault.address, mintedAmount2)
        await tbtcVault.connect(account2).mint(mintedAmount2)

        expect(await tbtc.balanceOf(account1.address)).to.equal(
          initialTbtcBalance1.add(mintedAmount1)
        )
        expect(await tbtc.balanceOf(account2.address)).to.equal(
          initialTbtcBalance2.add(mintedAmount2)
        )
        expect(await bank.balanceOf(tbtcVault.address)).to.equal(
          initialWalletBtcBalance + mintedAmount1 + mintedAmount2
        )
      })
    })
  })
})
