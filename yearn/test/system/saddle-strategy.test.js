const { expect } = require("chai")
const {
  resetFork,
  to1ePrecision,
  impersonateAccount,
  increaseTime,
} = require("../helpers/contract-test-helpers.js")
const { yearn, tbtc, forkBlockNumber } = require("./constants.js")
const { deployYearnVault } = require("./functions.js")
const { saddleStrategyFixture } = require("./fixtures.js")

const describeFn =
  process.env.NODE_ENV === "system-test" ? describe : describe.skip

describeFn("System -- saddle strategy", () => {
  let vaultGovernance
  let vaultDepositor
  let saddlePoolGovernance
  let saddlePool
  let tbtcSaddlePoolLPToken
  let vault
  let strategy

  before(async () => {
    await resetFork(forkBlockNumber)

    // Setup roles.
    vaultGovernance = await ethers.getSigner(0)

    vaultDepositor = await impersonateAccount(
      tbtc.saddlePoolLPTokenHolderAddress,
      vaultGovernance
    )

    saddlePoolGovernance = await impersonateAccount(
      tbtc.saddlePoolOwner,
      vaultGovernance
    )

    // Get tBTC v2 Saddle pool handle and set `gated` to false to allow
    // non-externally-owned accounts to perform staking
    saddlePool = await ethers.getContractAt(
      "ILPRewards",
      tbtc.saddlePoolAddress
    )
    await saddlePool.connect(saddlePoolGovernance).setGated(false)

    // Get tBTC v2 Saddle rewards pool LP token handle.
    tbtcSaddlePoolLPToken = await ethers.getContractAt(
      "IERC20",
      tbtc.saddlePoolLPTokenAddress
    )

    // Deploy a new experimental vault accepting tBTC v2 Saddle pool LP tokens.
    vault = await deployYearnVault(
      yearn,
      saddleStrategyFixture.vaultName,
      saddleStrategyFixture.vaultSymbol,
      tbtcSaddlePoolLPToken,
      vaultGovernance,
      saddleStrategyFixture.vaultDepositLimit
    )

    // Deploy the SaddleStrategy contract.
    const SaddleStrategy = await ethers.getContractFactory("SaddleStrategy")
    strategy = await SaddleStrategy.deploy(
      vault.address,
      tbtc.saddlePoolSwapAddress,
      tbtc.saddlePoolAddress
    )
    await strategy.deployed()

    // Add SaddleStrategy to the vault.
    await vault.addStrategy(
      strategy.address,
      saddleStrategyFixture.strategyDebtRatio,
      saddleStrategyFixture.strategyMinDebtPerHarvest,
      saddleStrategyFixture.strategyMaxDebtPerHarvest,
      saddleStrategyFixture.strategyPerformanceFee
    )
  })

  describe("when depositor deposits to the vault", () => {
    before(async () => {
      await tbtcSaddlePoolLPToken
        .connect(vaultDepositor)
        .approve(vault.address, saddleStrategyFixture.vaultDepositAmount)
      await vault
        .connect(vaultDepositor)
        .deposit(saddleStrategyFixture.vaultDepositAmount)
    })

    it("should correctly handle the deposit", async () => {
      expect(await vault.totalAssets()).to.be.equal(
        saddleStrategyFixture.vaultDepositAmount
      )
    })
  })

  describe("when harvesting occurs", () => {
    before(async () => {
      // First harvest just allocates funds for the first time.
      await strategy.harvest()

      // Simulate 7 harvests occurring each day.
      for (let i = 0; i < 7; i++) {
        await increaseTime(86400) // ~1 day
        await strategy.harvest()
        // TODO: Check if anything needs to happen at this moment
      }
    })

    it("should make a profit", async () => {
      // Vault has 0.3 * 1e18 = 300000000000000000 of LP tokens under its
      // management. The strategy borrows all the vault assets because it has
      // 100% of debt ratio and deposits them to the Saddle reward pool.

      // All LP tokens deposited in the Saddle reward pool generate extra
      // KEEP rewards which are used to buy wBTC. Acquired wBTC are deposited
      // back to the Saddle pool in order to earn new LP tokens.
      // All numbers are presented in the 18 digits format.
      //
      // TODO: Fill the calculations below, find the expected gain
      //
      // Day 1:
      // KEEP earned:
      // wBTC bought:
      // LP tokens profit:
      //
      // Day 2:
      // KEEP earned:
      // wBTC bought:
      // LP tokens profit:
      //
      // Day 3:
      // KEEP earned:
      // wBTC bought:
      // LP tokens profit:
      //
      // Day 4:
      // KEEP earned:
      // wBTC bought:
      // LP tokens profit:
      //
      // Day 5:
      // KEEP earned:
      // wBTC bought:
      // LP tokens profit:
      //
      // Day 6:
      // KEEP earned:
      // wBTC bought:
      // LP tokens profit:
      //
      // Day 7:
      // KEEP earned:
      // wBTC bought:
      // LP tokens profit:
      //
      // Sum of LP tokens profits: (15 digits)
      expect(
        (await vault.strategies(strategy.address)).totalGain
      ).to.be.closeTo(
        to1ePrecision(4137, 11),
        to1ePrecision(1, 11) // 0.0001 precision because there are 15 digits.
      )
    })
  })

  describe("when depositor withdraws from the vault", () => {
    let amountWithdrawn

    before(async () => {
      const initialBalance = await tbtcSaddlePoolLPToken.balanceOf(
        vaultDepositor.address
      )
      await vault.connect(vaultDepositor).withdraw() // withdraw all shares
      const currentBalance = await tbtcSaddlePoolLPToken.balanceOf(
        vaultDepositor.address
      )
      amountWithdrawn = currentBalance.sub(initialBalance)
    })

    it("should correctly handle the withdrawal", async () => {
      // TODO: Add calculation for the `amountWithdrawn` here

      expect(amountWithdrawn).to.be.closeTo(
        to1ePrecision(3001966, 11),
        to1ePrecision(1, 11) // 0.0000001 precision
      )
      expect(amountWithdrawn.gt(saddleStrategyFixture.vaultDepositAmount)).to.be
        .true
    })
  })
})
