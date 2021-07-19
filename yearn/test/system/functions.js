const { impersonateAccount } = require("../helpers/contract-test-helpers.js")

// Allocates Synthetix staking rewards to provide Curve pool's gauge additional
// rewards.
async function allocateSynthetixRewards(tbtc, rewardsAllocation, purseSigner) {
  const tbtcCurvePoolGaugeRewardDistributor = await impersonateAccount(
    tbtc.curvePoolGaugeRewardDistributorAddress,
    purseSigner
  )

  const synthetixCurveRewardsOwner = await impersonateAccount(
    tbtc.synthetixCurveRewardsOwnerAddress,
    purseSigner
  )

  // Get a handle to the tBTC v2 Curve pool gauge additional reward token.
  const tbtcCurvePoolGaugeReward = await ethers.getContractAt(
    "IERC20",
    tbtc.curvePoolGaugeRewardAddress
  )

  // Get a handle to the Synthetix Curve rewards contract used by the
  // tBTC v2 Curve pool gauge.
  const synthetixCurveRewards = await ethers.getContractAt(
    "ICurveRewards",
    tbtc.synthetixCurveRewardsAddress
  )

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

module.exports.allocateSynthetixRewards = allocateSynthetixRewards
