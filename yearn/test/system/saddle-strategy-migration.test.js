const { expect } = require("chai")
const {
  resetFork,
  to1e18,
  impersonateAccount,
} = require("../helpers/contract-test-helpers.js")
const { BigNumber } = ethers
const { yearn, tbtc, forkBlockNumber } = require("./constants.js")
const { deployYearnVault } = require("./functions.js")
const { saddleStrategyFixture } = require("./fixtures.js")

const describeFn =
  process.env.NODE_ENV === "system-test" ? describe : describe.skip

describeFn("System -- saddle strategy migrate", () => {
  let vaultGovernance
  let vaultDepositor
  let saddleLPRewardsGovernance
  let rewardDistribution
  let keepToken
  let saddleLPRewards
  let tbtcSaddlePoolLPToken
  let vault
  let oldStrategy
  let newStrategy

  before(async () => {
    await resetFork(forkBlockNumber)

    // Setup roles.
    vaultGovernance = await ethers.getSigner(0)

    vaultDepositor = await impersonateAccount(
      tbtc.saddlePoolLPTokenHolderAddress,
      vaultGovernance
    )

    saddleLPRewardsGovernance = await impersonateAccount(
      tbtc.saddleLPRewardsOwner,
      vaultGovernance
    )

    rewardDistribution = await impersonateAccount(
      tbtc.keepTokenHolderAddress,
      vaultGovernance
    )

    // Get tBTC v2 Saddle LP Rewards handle
    saddleLPRewards = await ethers.getContractAt(
      "ILPRewards",
      tbtc.saddleLPRewards
    )

    // Set `gated` to false to allow non-externally-owned accounts to perform
    // staking
    await saddleLPRewards.connect(saddleLPRewardsGovernance).setGated(false)

    // Set reward distribution account that will deposit KEEP tokens
    await saddleLPRewards
      .connect(saddleLPRewardsGovernance)
      .setRewardDistribution(rewardDistribution.address)

    // Get KEEP token handle.
    keepToken = await ethers.getContractAt("IERC20", tbtc.keepTokenAddress)

    // Deposit 100 KEEP tokens as reward
    const amountReward = to1e18(100)
    await keepToken
      .connect(rewardDistribution)
      .approve(saddleLPRewards.address, amountReward)
    await saddleLPRewards
      .connect(rewardDistribution)
      .notifyRewardAmount(amountReward)

    // Get tBTC v2 Saddle pool LP token handle.
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
    oldStrategy = await SaddleStrategy.deploy(
      vault.address,
      tbtc.saddlePoolSwapAddress,
      tbtc.saddleLPRewards
    )
    await oldStrategy.deployed()

    newStrategy = await SaddleStrategy.deploy(
      vault.address,
      tbtc.saddlePoolSwapAddress,
      tbtc.saddleLPRewards
    )
    await newStrategy.deployed()

    // Add SaddleStrategy to the vault.
    await vault.addStrategy(
      oldStrategy.address,
      saddleStrategyFixture.strategyDebtRatio,
      saddleStrategyFixture.strategyMinDebtPerHarvest,
      saddleStrategyFixture.strategyMaxDebtPerHarvest,
      saddleStrategyFixture.strategyPerformanceFee
    )

    // deposit to the vault
    await tbtcSaddlePoolLPToken
      .connect(vaultDepositor)
      .approve(vault.address, saddleStrategyFixture.vaultDepositAmount)
    await vault
      .connect(vaultDepositor)
      .deposit(saddleStrategyFixture.vaultDepositAmount)

    // Harvest just allocates funds for the first time.
    await oldStrategy.harvest()
  })

  describe("initial checks", () => {
    it("should correctly handle the deposit", async () => {
      expect(await vault.totalAssets()).to.be.equal(
        saddleStrategyFixture.vaultDepositAmount
      )
    })

    it("the new strategy should not have any LP tokens or rewards", async () => {
      expect(await keepToken.balanceOf(newStrategy.address)).to.be.equal(0)
      expect(
        await tbtcSaddlePoolLPToken.balanceOf(newStrategy.address)
      ).to.be.equal(0)
    })
  })

  describe("when migration occurs", () => {
    before(async () => {
      await vault
        .connect(vaultGovernance)
        .migrateStrategy(oldStrategy.address, newStrategy.address)
    })

    it("should move LP tokens to the new strategy", async () => {
      expect(
        await tbtcSaddlePoolLPToken.balanceOf(oldStrategy.address)
      ).to.be.equal(0)
      expect(
        await tbtcSaddlePoolLPToken.balanceOf(newStrategy.address)
      ).to.be.equal(saddleStrategyFixture.vaultDepositAmount)
    })

    it("should move reward tokens to the new strategy", async () => {
      expect(await keepToken.balanceOf(oldStrategy.address)).to.be.equal(0)
      expect(await keepToken.balanceOf(newStrategy.address)).to.be.equal(
        BigNumber.from("27247566300912")
      )
    })
  })
})
