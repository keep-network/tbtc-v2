const { expect } = require("chai")
const {
  resetFork,
  to1ePrecision,
  impersonateAccount,
  increaseTime,
  to1e18,
} = require("../helpers/contract-test-helpers.js")
const { yearn, convex, tbtc, forkBlockNumber } = require("./constants.js")
const { allocateSynthetixRewards, deployYearnVault } = require("./functions.js")
const { curveStrategyFixture } = require("./fixtures.js")

const describeFn =
  process.env.NODE_ENV === "system-test" ? describe : describe.skip

describeFn("System -- convex strategy", () => {
  let vaultGovernance
  let vaultDepositor
  let tbtcCurvePoolLPToken
  let booster
  let vault
  let strategy

  before(async () => {
    await resetFork(forkBlockNumber)

    // Setup roles.
    vaultGovernance = await ethers.getSigner(0)
    vaultDepositor = await impersonateAccount(
      tbtc.curvePoolLPTokenHolderAddress,
      vaultGovernance
    )

    // Allocate Synthetix rewards to obtain extra rewards (KEEP tokens)
    // from the Convex reward pool.
    await allocateSynthetixRewards(
      tbtc,
      curveStrategyFixture.synthetixRewardsAllocation
    )

    // Get tBTC v2 Curve pool LP token handle.
    tbtcCurvePoolLPToken = await ethers.getContractAt(
      "IERC20",
      tbtc.curvePoolLPTokenAddress
    )

    // Get Convex booster handle.
    booster = await ethers.getContractAt(
      "IConvexBooster",
      convex.boosterAddress
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

    // Deploy the ConvexStrategy contract.
    const ConvexStrategy = await ethers.getContractFactory("ConvexStrategy")
    strategy = await ConvexStrategy.deploy(
      vault.address,
      tbtc.curvePoolDepositorAddress,
      tbtc.convexRewardPoolId
    )
    await strategy.deployed()

    // Add ConvexStrategy to the vault.
    await vault.addStrategy(
      strategy.address,
      curveStrategyFixture.strategyDebtRatio,
      curveStrategyFixture.strategyMinDebtPerHarvest,
      curveStrategyFixture.strategyMaxDebtPerHarvest,
      curveStrategyFixture.strategyPerformanceFee
    )
  })

  describe("when depositor deposits to the vault", () => {
    before(async () => {
      await tbtcCurvePoolLPToken
        .connect(vaultDepositor)
        .approve(vault.address, curveStrategyFixture.vaultDepositAmount)
      await vault
        .connect(vaultDepositor)
        .deposit(curveStrategyFixture.vaultDepositAmount)
    })

    it("should correctly handle the deposit", async () => {
      expect(await vault.totalAssets()).to.be.equal(
        curveStrategyFixture.vaultDepositAmount
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
        // Move accumulated rewards from Curve gauge to Convex reward pool.
        // This is done after harvest in order to avoid very small extra
        // reward amounts in the first day.
        await booster.earmarkRewards(tbtc.convexRewardPoolId)
      }
    })

    it("should make a profit", async () => {
      // Vault has 0.3 * 1e18 = 300000000000000000 of LP tokens under its
      // management. The strategy borrows all the vault assets because it has
      // 100% of debt ratio and deposits them to the Convex reward pool.
      // All LP tokens deposited in the Convex reward pool generate extra
      // KEEP rewards because the underlying Curve gauge stakes its deposits
      // into the Synthetix Curve rewards contract. 90% of CRV, 100% of CVX,
      // and 100% of KEEP tokens are used to buy wBTC. Acquired wBTC
      // are deposited back to the Curve pool in order to earn new LP tokens.
      // All numbers are presented in the 18 digits format.
      //
      // Day 1:
      // CRV earned: 573813072734246542
      // CVX earned: 257068256584942450
      // KEEP earned: 0
      // wBTC bought: 5367
      // LP tokens profit: 53170551603260
      //
      // Day 2:
      // CRV earned: 573819714012388395
      // CVX earned: 257071231877550000
      // KEEP earned: 445015623167430843
      // wBTC bought: 5773
      // LP tokens profit: 57192769573609
      //
      // Day 3:
      // CRV earned: 573921256349125686
      // CVX earned: 257116722844408307
      // KEEP earned: 826571505558228821
      // wBTC bought: 6121
      // LP tokens profit: 60640384970271
      //
      // Day 4:
      // CRV earned: 574030480044548280
      // CVX earned: 257165655059957629
      // KEEP earned: 1153770282997704636
      // wBTC bought: 6422
      // LP tokens profit: 63622374143187
      //
      // Day 5:
      // CRV earned: 574146287740676497
      // CVX earned: 257217536907823070
      // KEEP earned: 1434379897134231536
      // wBTC bought: 6679
      // LP tokens profit: 66168457915443
      //
      // Day 6:
      // CRV earned: 574267790198385184
      // CVX earned: 257271970008876562
      // KEEP earned: 1675056507580662807
      // wBTC bought: 6900
      // LP tokens profit: 68357891814333
      //
      // Day 7:
      // CRV earned: 297521307494722242
      // CVX earned: 133289545757635564
      // KEEP earned: 1881503817764847901
      // wBTC bought: 4501
      // LP tokens profit: 44591140717357
      //
      // Sum of LP tokens profits: 413743570737460 (15 digits)
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
      // Initially, the depositor deposited 300000000000000000 of LP tokens
      // into the vault and received the same amount of vault shares because
      // it was the first depositor. The strategy just yielded another
      // 413743570737460 LP tokens. It also created 197730151096097 of
      // additional shares (see IYearnVault's totalSupply() method) which
      // represent the management and performance fees taken by the protocol.
      // In result, the vault has 300413743570737460 of LP tokens (totalAssets)
      // and 300197730151096097 (totalSupply) of shares. The price per share is
      // calculated as (totalAssets - lockedProfit) / totalSupply. In this case,
      // the price is 1.000655520230357642 (see IYearnVault's pricePerShare()).
      // During the withdrawal, the withdrawing depositor passes an amount
      // of vault shares it wants to withdraw. For each share, it receives
      // an amount of LP tokens, according to the current price per share.
      // In this case, the depositor withdraws all of its 300000000000000000
      // shares so in return it should receive 300000000000000000 * 1.000655520230357642 =
      // ~300196600000000000 of LP tokens.

      expect(amountWithdrawn).to.be.closeTo(
        to1ePrecision(3001966, 11),
        to1ePrecision(1, 11) // 0.0000001 precision
      )
      expect(amountWithdrawn.gt(curveStrategyFixture.vaultDepositAmount)).to.be
        .true
    })

    describe("eth to LP token (want) conversion", () => {
      // At block 12786839 (Jul-08-2021) the exchange rate between wBTC/ETH was
      // ~1/15.65 Swapping 1000ETH on Uniswap gave ~63.9wBTC. It means that by
      // depositing 63.9wBTC to Curve.fi LP Pool a depositor would get
      // ~63,3018 LP tokens.
      //
      // TODO: When the new curve pool with tBTC v2 is deployed, the fork block
      // number would need be adjusted acoordingly. In consequnce, the rates of
      // tokens will be different and will need be adjusted as well.
      it("should calculate LP tokens in exchange for ETH ", async () => {
        const lpTokens = await strategy.ethToWant(to1e18(1000))

        expect(lpTokens).to.be.closeTo(
          to1ePrecision(633018, 14),
          to1ePrecision(1, 14) // 0.0000001 precision
        )
      })
    })
  })
})
