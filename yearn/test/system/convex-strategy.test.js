const { expect } = require("chai")
const { BigNumber } = ethers
const {
  resetFork,
  to1ePrecision,
  impersonateAccount,
  increaseTime,
  to1e18,
} = require("../helpers/contract-test-helpers.js")
const { yearn, convex, tbtc } = require("./constants.js")

const describeFn =
  process.env.NODE_ENV === "system-test" ? describe : describe.skip

describeFn("System -- convex strategy", () => {
  // Name of the vault for tBTCv2 Curve pool.
  const vaultName = "Curve tBTCv2 Pool yVault"
  // Symbol of the vault for tBTCv2 Curve pool.
  const vaultSymbol = "yvCurve-tBTCv2"
  // Total deposit limit of the vault for tBTCv2 Curve pool.
  const vaultDepositLimit = to1ePrecision(300, 15)
  // Amount of the deposit made by the depositor.
  const vaultDepositAmount = to1ePrecision(300, 15)

  let vaultGovernance
  let tbtcCurvePoolLPToken
  let vaultDepositor
  let tbtcCurvePoolGaugeReward
  let tbtcCurvePoolGaugeRewardDistributor
  let synthetixCurveRewards
  let synthetixCurveRewardsOwner
  let booster
  let vault
  let strategy

  before(async () => {
    await resetFork(12786839)

    // Setup roles.
    vaultGovernance = await ethers.getSigner(0)
    vaultDepositor = await impersonateAccount(
      tbtc.curvePoolLPTokenHolderAddress,
      vaultGovernance
    )
    tbtcCurvePoolGaugeRewardDistributor = await impersonateAccount(
      tbtc.curvePoolGaugeRewardDistributorAddress,
      vaultGovernance
    )
    synthetixCurveRewardsOwner = await impersonateAccount(
      tbtc.synthetixCurveRewardsOwnerAddress,
      vaultGovernance
    )

    // Get tBTC v2 Curve pool LP token handle.
    tbtcCurvePoolLPToken = await ethers.getContractAt(
      "IERC20",
      tbtc.curvePoolLPTokenAddress
    )

    // Setup Synthetix staking rewards to provide Curve pool's gauge additional
    // rewards.
    await setupSynthetixRewards()

    // Get Convex booster handle.
    booster = await ethers.getContractAt(
      "IConvexBooster",
      convex.boosterAddress
    )

    // Get a handle to the Yearn registry.
    const registry = await ethers.getContractAt(
      "IYearnRegistry",
      yearn.registryAddress
    )

    // Always use the same vault release to avoid test failures in the future.
    // Target release index is taken from the deployed Yearn registry contract.
    // We aim for version 0.4.2 (see BaseStrategy.apiVersion()) whose index is 9.
    const targetReleaseIndex = 9
    const releaseDelta = (await registry.numReleases()) - 1 - targetReleaseIndex

    // Deploy a new experimental vault accepting tBTC v2 Curve pool LP tokens.
    const tx = await registry.newExperimentalVault(
      tbtcCurvePoolLPToken.address,
      vaultGovernance.address,
      vaultGovernance.address, // set governance to be the guardian as well
      vaultGovernance.address, // set governance to be the rewards target as well
      vaultName,
      vaultSymbol,
      releaseDelta
    )

    // Get a handle to the experimental Yearn vault.
    vault = await ethers.getContractAt(
      "IYearnVault",
      extractVaultAddress(await tx.wait())
    )

    // Just make sure the vault has been created properly.
    expect(await vault.name()).to.be.equal(vaultName)

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
      10000, // 100% debt ratio
      0, // zero min debt per harvest
      BigNumber.from(2).pow(256).sub(1), // infinite max debt per harvest
      1000 // 10% performance fee
    )

    // Set a deposit limit.
    await vault.setDepositLimit(vaultDepositLimit)
  })

  describe("when depositor deposits to the vault", () => {
    before(async () => {
      await tbtcCurvePoolLPToken
        .connect(vaultDepositor)
        .approve(vault.address, vaultDepositAmount)
      await vault.connect(vaultDepositor).deposit(vaultDepositAmount)
    })

    it("should correctly handle the deposit", async () => {
      expect(await vault.totalAssets()).to.be.equal(vaultDepositAmount)
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
      // Sum of LP tokens profits: 413743570737460
      expect((await vault.strategies(strategy.address)).totalGain).to.be.equal(
        413743570737460
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
      expect(amountWithdrawn.gt(vaultDepositAmount)).to.be.true
    })
  })
  async function setupSynthetixRewards() {
    // Get a handle to the tBTC v2 Curve pool gauge additional reward token.
    tbtcCurvePoolGaugeReward = await ethers.getContractAt(
      "IERC20",
      tbtc.curvePoolGaugeRewardAddress
    )

    // Get a handle to the Synthetix Curve rewards contract used by the
    // tBTC v2 Curve pool gauge.
    synthetixCurveRewards = await ethers.getContractAt(
      "ICurveRewards",
      tbtc.synthetixCurveRewardsAddress
    )

    // Allocate 100k.
    const rewardsAllocation = to1e18(100000)

    // Set a new reward distributor. It's just a holder of the reward tokens.
    await synthetixCurveRewards
      .connect(synthetixCurveRewardsOwner)
      .setRewardDistribution(tbtcCurvePoolGaugeRewardDistributor.address)

    // Allow distributor's tokens to be taken by the Curve rewards contract.
    await tbtcCurvePoolGaugeReward
      .connect(tbtcCurvePoolGaugeRewardDistributor)
      .approve(synthetixCurveRewards.address, rewardsAllocation)

    // Deposit reward tokens.
    await synthetixCurveRewards
      .connect(tbtcCurvePoolGaugeRewardDistributor)
      .notifyRewardAmount(rewardsAllocation)
  }

  function extractVaultAddress(receipt) {
    // Find the NewExperimentalVaultEvent using their hex.
    // See: https://etherscan.io/address/0x50c1a2eA0a861A967D9d0FFE2AE4012c2E053804#events
    const newExperimentalVaultEvent = receipt.events.find(
      (e) =>
        e.topics[0] ===
        "0x57a9cdc2a05e05f66e76769bdbe88e21ec45d9ee0f97d4cb60395d4c75dcbcda"
    )
    // Event data consist of vault address and API version string.
    return ethers.utils.defaultAbiCoder.decode(
      ["address", "string"],
      newExperimentalVaultEvent.data
    )[0]
  }
})
