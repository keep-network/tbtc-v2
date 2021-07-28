const { expect } = require("chai")
const {
  resetFork,
  impersonateAccount,
} = require("../helpers/contract-test-helpers.js")
const { yearn, tbtc, forkBlockNumber } = require("./constants.js")
const { allocateSynthetixRewards, deployYearnVault } = require("./functions.js")
const { curveStrategyFixture } = require("./fixtures.js")

const describeFn =
  process.env.NODE_ENV === "system-test" ? describe : describe.skip

describeFn("System -- curve voter proxy strategy migration", () => {
  let vaultGovernance
  let tbtcCurvePoolLPToken
  let vaultDepositor
  let strategyProxyGovernance
  let vault
  let oldStrategy
  let newStrategy

  before(async () => {
    await resetFork(forkBlockNumber)

    // Setup roles.
    vaultGovernance = await ethers.getSigner(0)
    vaultDepositor = await impersonateAccount(
      tbtc.curvePoolLPTokenHolderAddress,
      vaultGovernance
    )
    strategyProxyGovernance = await impersonateAccount(
      yearn.strategyProxyGovernanceAddress
    )

    // Allocate Synthetix rewards to obtain additional rewards (KEEP tokens)
    // from the Curve pool's gauge.
    await allocateSynthetixRewards(
      tbtc,
      curveStrategyFixture.synthetixRewardsAllocation
    )

    // Get tBTC v2 Curve pool LP token handle.
    tbtcCurvePoolLPToken = await ethers.getContractAt(
      "IERC20",
      tbtc.curvePoolLPTokenAddress
    )

    // Deploy a new experimental vault accepting tBTC v2 Curve pool LP tokens.
    vault = await deployYearnVault(
      yearn,
      curveStrategyFixture.vaultName,
      curveStrategyFixture.vaultSymbol,
      tbtcCurvePoolLPToken,
      vaultGovernance,
      curveStrategyFixture.vaultDepositLimit
    )

    // Deploy the CurveVoterProxyStrategy contract.
    const CurveVoterProxyStrategy = await ethers.getContractFactory(
      "CurveVoterProxyStrategy"
    )
    oldStrategy = await CurveVoterProxyStrategy.deploy(
      vault.address,
      tbtc.curvePoolDepositorAddress,
      tbtc.curvePoolGaugeAddress,
      tbtc.curvePoolGaugeRewardAddress
    )
    await oldStrategy.deployed()

    newStrategy = await CurveVoterProxyStrategy.deploy(
      vault.address,
      tbtc.curvePoolDepositorAddress,
      tbtc.curvePoolGaugeAddress,
      tbtc.curvePoolGaugeRewardAddress
    )
    await newStrategy.deployed()

    // Approve the strategy for the gauge in the StrategyProxy contract.
    const strategyProxy = await ethers.getContractAt(
      "IStrategyProxy",
      await oldStrategy.strategyProxy()
    )

    await strategyProxy
      .connect(strategyProxyGovernance)
      .approveStrategy(tbtc.curvePoolGaugeAddress, oldStrategy.address)

    // Add CurveVoterProxyStrategy to the vault.
    await vault.addStrategy(
      oldStrategy.address,
      curveStrategyFixture.strategyDebtRatio,
      curveStrategyFixture.strategyMinDebtPerHarvest,
      curveStrategyFixture.strategyMaxDebtPerHarvest,
      curveStrategyFixture.strategyPerformanceFee
    )

    // Deposit to the vault
    await tbtcCurvePoolLPToken
      .connect(vaultDepositor)
      .approve(vault.address, curveStrategyFixture.vaultDepositAmount)
    await vault
      .connect(vaultDepositor)
      .deposit(curveStrategyFixture.vaultDepositAmount)

    // Harvest just allocates funds for the first time.
    await oldStrategy.harvest()
  })

  describe("initial checks", () => {
    it("should correctly handle the deposit", async () => {
      expect(await vault.totalAssets()).to.be.equal(
        curveStrategyFixture.vaultDepositAmount
      )
    })

    it("should return zero LP tokens and rewards for the new strategy", async () => {
      expect(
        await tbtcCurvePoolLPToken.balanceOf(newStrategy.address)
      ).to.be.equal(0)
    })

    it("should return true for is active call for the old strategy", async () => {
      expect(await oldStrategy.isActive()).to.be.true
    })

    it("should return false for is active call for the new strategy", async () => {
      expect(await newStrategy.isActive()).to.be.false
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
        await tbtcCurvePoolLPToken.balanceOf(oldStrategy.address)
      ).to.be.equal(0)
      expect(
        await tbtcCurvePoolLPToken.balanceOf(newStrategy.address)
      ).to.be.equal(curveStrategyFixture.vaultDepositAmount)
    })

    // TODO: should reward tokens (CRV) also be migrated to a new
    // strategy? If so, add checks for their balance change.

    it("should deactivate the old strategy", async () => {
      expect(await oldStrategy.isActive()).to.be.false
    })

    it("should activate the new strategy", async () => {
      expect(await newStrategy.isActive()).to.be.true
    })
  })

  describe("when withdrawal occurs after migration", async () => {
    let amountWithdrawn

    before(async () => {
      const initialBalance = await tbtcCurvePoolLPToken.balanceOf(
        vaultDepositor.address
      )
      await vault.connect(vaultDepositor).withdraw() // withdraw all shares
      const currentBalance = await tbtcCurvePoolLPToken.balanceOf(
        vaultDepositor.address
      )
      amountWithdrawn = currentBalance.sub(initialBalance)
    })

    it("should correctly handle the withdrawal", async () => {
      expect(amountWithdrawn).to.be.equal(
        curveStrategyFixture.vaultDepositAmount
      )
    })
  })
})
