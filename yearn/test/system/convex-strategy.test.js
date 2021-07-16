const { expect } = require("chai")
const { BigNumber } = ethers
const {
  resetFork,
  to1ePrecision,
  impersonateAccount,
  increaseTime,
  to1e18,
} = require("../helpers/contract-test-helpers.js")

const describeFn =
  process.env.NODE_ENV === "system-test" ? describe : describe.skip

// TODO: The tBTC v2 token and their Curve pool are not deployed yet.
//       This test uses tBTC v1 token and Curve pool temporarily.
//       Once the new token and pool land, those addresses must be changed.
// TODO: Refactor this test and extract common parts shared with other tests.
describeFn("System -- convex strategy", () => {
  // Address of the Yearn registry contract.
  const registryAddress = "0x50c1a2eA0a861A967D9d0FFE2AE4012c2E053804"
  // Address of the tBTC v2 Curve pool LP token.
  const tbtcCurvePoolLPTokenAddress =
    "0x64eda51d3Ad40D56b9dFc5554E06F94e1Dd786Fd"
  // Example address which holds an amount of the tBTC v2 Curve pool LP token.
  const tbtcCurvePoolLPTokenHolderAddress =
    "0x26fcbd3afebbe28d0a8684f790c48368d21665b5"
  // Address of the tBTC v2 Curve pool depositor contract.
  const tbtcCurvePoolDepositorAddress =
    "0xaa82ca713D94bBA7A89CEAB55314F9EfFEdDc78c"
  // ID of the Convex reward pool paired with the tBTC v2 Curve pool.
  const tbtcConvexRewardPoolId = 16
  // Address of the tBTC v2 Curve pool gauge additional reward token.
  const tbtcCurvePoolGaugeRewardAddress =
    "0x85Eee30c52B0b379b046Fb0F85F4f3Dc3009aFEC"
  // Example address which holds an amount of the tBTC v2 Curve pool gauge
  // additional reward token and can act as its distributor.
  const tbtcCurvePoolGaugeRewardDistributorAddress =
    "0x5203aeaaee721195707b01e613b6c3259b3a5cf6"
  // Address of the Synthetix Curve rewards contract used by the tBTC v2 Curve
  // pool gauge.
  const synthetixCurveRewardsAddress =
    "0xAF379f0228ad0d46bB7B4f38f9dc9bCC1ad0360c"
  // Address of the Synthetix Curve rewards contract owner.
  const synthetixCurveRewardsOwnerAddress =
    "0xb3726e69da808a689f2607939a2d9e958724fc2a"
  // Address of the Convex booster contract.
  const boosterAddress = "0xF403C135812408BFbE8713b5A23a04b3D48AAE31"

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
      tbtcCurvePoolLPTokenHolderAddress,
      vaultGovernance
    )
    tbtcCurvePoolGaugeRewardDistributor = await impersonateAccount(
      tbtcCurvePoolGaugeRewardDistributorAddress,
      vaultGovernance
    )
    synthetixCurveRewardsOwner = await impersonateAccount(
      synthetixCurveRewardsOwnerAddress,
      vaultGovernance
    )

    // Get tBTC v2 Curve pool LP token handle.
    tbtcCurvePoolLPToken = await ethers.getContractAt(
      "IERC20",
      tbtcCurvePoolLPTokenAddress
    )

    // Setup Synthetix staking rewards to provide Curve pool's gauge additional
    // rewards.
    await setupSynthetixRewards()

    // Get Convex booster handle.
    booster = await ethers.getContractAt("IConvexBooster", boosterAddress)

    // Get a handle to the Yearn registry.
    const registry = await ethers.getContractAt(
      "IYearnRegistry",
      registryAddress
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
      tbtcCurvePoolDepositorAddress,
      tbtcConvexRewardPoolId
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
        await booster.earmarkRewards(tbtcConvexRewardPoolId)
      }
    })

    it("should make a profit", async () => {
      // TODO: Implementation.
      expect(
        (await vault.strategies(strategy.address)).totalGain
      ).to.be.greaterThan(0)
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
      // TODO: Implementation.
      expect(amountWithdrawn.gt(vaultDepositAmount)).to.be.true
    })
  })
  async function setupSynthetixRewards() {
    // Get a handle to the tBTC v2 Curve pool gauge additional reward token.
    tbtcCurvePoolGaugeReward = await ethers.getContractAt(
      "IERC20",
      tbtcCurvePoolGaugeRewardAddress
    )

    // Get a handle to the Synthetix Curve rewards contract used by the
    // tBTC v2 Curve pool gauge.
    synthetixCurveRewards = await ethers.getContractAt(
      "ICurveRewards",
      synthetixCurveRewardsAddress
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
