const { expect } = require("chai")
const { BigNumber } = ethers
const {
  resetFork,
  to1ePrecision,
  impersonateAccount,
  increaseTime,
  to1e18,
} = require("../helpers/contract-test-helpers.js")
const { yearn, tbtc, forkBlockNumber } = require("./constants.js")
const { allocateSynthetixRewards } = require("./functions.js")

const describeFn =
  process.env.NODE_ENV === "system-test" ? describe : describe.skip

describeFn("System -- curve voter proxy strategy", () => {
  // Name of the vault for tBTCv2 Curve pool.
  const vaultName = "Curve tBTCv2 Pool yVault"
  // Symbol of the vault for tBTCv2 Curve pool.
  const vaultSymbol = "yvCurve-tBTCv2"
  // Total deposit limit of the vault for tBTCv2 Curve pool.
  const vaultDepositLimit = to1ePrecision(300, 15)
  // Amount of the deposit made by the depositor.
  const vaultDepositAmount = to1ePrecision(300, 15)
  // Amount of Synthetix staking rewards which should be allocated.
  const synthetixRewardsAllocation = to1e18(100000)

  let vaultGovernance
  let tbtcCurvePoolLPToken
  let vaultDepositor
  let strategyProxyGovernance
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
    strategyProxyGovernance = await impersonateAccount(
      yearn.strategyProxyGovernanceAddress
    )

    await allocateSynthetixRewards(
      tbtc,
      synthetixRewardsAllocation,
      vaultGovernance
    )

    // Get tBTC v2 Curve pool LP token handle.
    tbtcCurvePoolLPToken = await ethers.getContractAt(
      "IERC20",
      tbtc.curvePoolLPTokenAddress
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

    // Deploy the CurveVoterProxyStrategy contract.
    const CurveVoterProxyStrategy = await ethers.getContractFactory(
      "CurveVoterProxyStrategy"
    )
    strategy = await CurveVoterProxyStrategy.deploy(
      vault.address,
      tbtc.curvePoolDepositorAddress,
      tbtc.curvePoolGaugeAddress,
      tbtc.curvePoolGaugeRewardAddress
    )
    await strategy.deployed()

    // Approve the strategy for the gauge in the StrategyProxy contract.
    const strategyProxy = await ethers.getContractAt(
      "IStrategyProxy",
      await strategy.strategyProxy()
    )
    await strategyProxy
      .connect(strategyProxyGovernance)
      .approveStrategy(tbtc.curvePoolGaugeAddress, strategy.address)

    // Add CurveVoterProxyStrategy to the vault.
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
      }
    })

    it("should make a profit", async () => {
      // Vault has 0.3 * 1e18 = 300000000000000000 of LP tokens under its
      // management. The strategy borrows all the vault assets because it has
      // 100% of debt ratio and deposits them to the Curve pool's gauge.
      // All LP tokens deposited in the Curve pool's gauge are staked into the
      // Synthetix Curve rewards contract and yield additional KEEP rewards.
      // 90% of CRV and 100% of KEEP tokens are used to buy wBTC. Acquired wBTC
      // are deposited back to the Curve pool in order to earn new LP tokens.
      // All numbers are presented in the 18 digits format.
      //
      // Day 1:
      // CRV earned: 624977958083682920
      // KEEP earned: 3114785244145110913
      // wBTC bought: 5952
      // LP tokens profit: 58966112006133
      //
      // Day 2:
      // CRV earned: 624977958083682920
      // KEEP earned: 3114785244145110913
      // wBTC bought: 5952
      // LP tokens profit: 58966111984781
      //
      // Day 3:
      // CRV earned: 625100745236306914
      // KEEP earned: 3115397333219764547
      // wBTC bought: 5953
      // LP tokens profit: 58976018904279
      //
      // Day 4:
      // CRV earned: 625223532367443751
      // KEEP earned: 3116009422241734285
      // wBTC bought: 5955
      // LP tokens profit: 58995832764617
      //
      // Day 5:
      // CRV earned: 625346340106646339
      // KEEP earned: 3116621614048544127
      // wBTC bought: 5955
      // LP tokens profit: 58995832743241
      //
      // Day 6:
      // CRV earned: 625469189083453152
      // KEEP earned: 3117234011477682701
      // wBTC bought: 5957
      // LP tokens profit: 59015646603549
      //
      // Day 7:
      // CRV earned: 625175431614379236
      // KEEP earned: 3117305122339659520
      // wBTC bought: 5955
      // LP tokens profit: 58995832700484
      //
      // Sum of LP tokens profits: 412911387707084
      expect((await vault.strategies(strategy.address)).totalGain).to.be.equal(
        412911387707084
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
      // 412911387707084 LP tokens. It also created 197563400756173 of
      // additional shares (see IYearnVault's totalSupply() method) which
      // represent the management and performance fees taken by the protocol.
      // In result, the vault has 300412911387707084 of LP tokens (totalAssets)
      // and 300197563400756173 (totalSupply) of shares. The price per share is
      // calculated as (totalAssets - lockedProfit) / totalSupply. In this case,
      // the price is 1.000614912057350266 (see IYearnVault's pricePerShare()).
      // During the withdrawal, the withdrawing depositor passes an amount
      // of vault shares it wants to withdraw. For each share, it receives
      // an amount of LP tokens, according to the current price per share.
      // In this case, the depositor withdraws all of its 300000000000000000
      // shares so in return it should receive 300000000000000000 * 1.000614912057350266 =
      // ~300184470000000000 of LP tokens.

      expect(amountWithdrawn).to.be.closeTo(
        to1ePrecision(3001844, 11),
        to1ePrecision(1, 11) // 0.0000001 precision
      )
      expect(amountWithdrawn.gt(vaultDepositAmount)).to.be.true
    })
  })

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
