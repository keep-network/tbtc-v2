const { expect } = require("chai")
const {
  resetFork,
  to1e18,
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
  let saddleLPRewardsGovernance
  let rewardDistribution
  let keepToken
  let saddleLPRewards
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
    strategy = await SaddleStrategy.deploy(
      vault.address,
      tbtc.saddlePoolSwapAddress,
      tbtc.saddleLPRewards
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
      // KEEP earned: 2354216975965155399
      // wBTC bought: 2149
      // LP tokens profit: 21019199600110
      //
      // Day 2:
      // KEEP earned: 2354216975965155399
      // wBTC bought: 2149
      // LP tokens profit: 21019199592617
      //
      // Day 3:
      // KEEP earned: 2354381859214170296
      // wBTC bought: 2149
      // LP tokens profit: 21019199585122
      //
      // Day 4:
      // KEEP earned: 2354546742454357499
      // wBTC bought: 2150
      // LP tokens profit: 21028980498790
      //
      // Day 5:
      // KEEP earned: 2354711625685716993
      // wBTC bought: 2150
      // LP tokens profit: 21028980491289
      //
      // Day 6:
      // KEEP earned: 2354876585633803994
      // wBTC bought: 2150
      // LP tokens profit: 21028980483789
      //
      // Day 7:
      // KEEP earned: 2354659946035572609
      // wBTC bought: 2150
      // LP tokens profit: 21028980476286
      //
      // Sum of LP tokens profits: 147173520728003 (15 digits)
      expect(
        (await vault.strategies(strategy.address)).totalGain
      ).to.be.closeTo(
        to1ePrecision(1471, 11),
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
      // Initially, the depositor deposited 300000000000000000 of LP tokens
      // into the vault and received the same amount of vault shares because
      // it was the first depositor. The strategy just yielded another
      // 147173520728003 LP tokens. It also created 144444834110257 of
      // additional shares (see IYearnVault's totalSupply() method) which
      // represent the management and performance fees taken by the protocol.
      // In result, the vault has 300147173520728003 of LP tokens (totalAssets)
      // and 300144444834110257 (totalSupply) of shares. The price per share is
      // calculated as (totalAssets - lockedProfit) / totalSupply. In this case,
      // the price is 1.000007792549389153 (see IYearnVault's pricePerShare()).
      // During the withdrawal, the withdrawing depositor passes an amount
      // of vault shares it wants to withdraw. For each share, it receives
      // an amount of LP tokens, according to the current price per share.
      // In this case, the depositor withdraws all of its 300000000000000000
      // shares so in return it should receive 300000000000000000 * 1.000007792549389153  =
      // ~300002337764816746 of LP tokens.

      expect(amountWithdrawn).to.be.closeTo(
        to1ePrecision(3000023377, 8),
        to1ePrecision(1, 8) // 0.0000000001 precision
      )
      expect(amountWithdrawn.gt(saddleStrategyFixture.vaultDepositAmount)).to.be
        .true
    })
  })

  describe("eth to LP token (want) conversion", () => {
    // At block 12786839 (Jul-08-2021) the exchange rate between wBTC/ETH was
    // ~1/15.65. Swapping 1000ETH on Uniswap gave ~63.9wBTC. It means that by
    // depositing 63.9wBTC to Saddle LP Pool a depositor would get
    // ~62.4681 LP tokens.
    //
    // TODO: When the new saddle pool with tBTC v2 is deployed, the fork block
    // number would need to be adjusted accordingly. In consequence, the rates of
    // tokens will be different and they will need to be adjusted as well.
    it("should calculate LP tokens in exchange for ETH ", async () => {
      const lpTokens = await strategy.ethToWant(to1e18(1000))

      expect(lpTokens).to.be.closeTo(
        to1ePrecision(624681, 14),
        to1ePrecision(1, 14) // 0.0001 precision
      )
    })
  })
})
