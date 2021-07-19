const { impersonateAccount } = require("../helpers/contract-test-helpers.js")

// Allocates Synthetix staking rewards to provide Curve pool's gauge additional
// rewards.
async function allocateSynthetixRewards(tbtc, rewardsAllocation) {
  const tbtcCurvePoolGaugeRewardDistributor = await impersonateAccount(
    tbtc.curvePoolGaugeRewardDistributorAddress,
    await ethers.getSigner(0)
  )

  const synthetixCurveRewardsOwner = await impersonateAccount(
    tbtc.synthetixCurveRewardsOwnerAddress,
    await ethers.getSigner(0)
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

// Deploys a new experimental Yearn vault for given parameters.
async function deployYearnVault(
  yearn,
  name,
  symbol,
  token,
  governance,
  depositLimit
) {
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

  // Deploy a new experimental vault accepting the given token.
  const tx = await registry.newExperimentalVault(
    token.address,
    governance.address,
    governance.address, // set governance to be the guardian as well
    governance.address, // set governance to be the rewards target as well
    name,
    symbol,
    releaseDelta
  )

  // Get a handle to the experimental Yearn vault.
  const vault = await ethers.getContractAt(
    "IYearnVault",
    extractVaultAddress(await tx.wait())
  )

  // Just make sure the vault has been created properly.
  if ((await vault.name()) !== name) {
    throw new Error("Invalid vault name")
  }

  // Set the deposit limit.
  await vault.setDepositLimit(depositLimit)

  return vault
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

module.exports.allocateSynthetixRewards = allocateSynthetixRewards
module.exports.deployYearnVault = deployYearnVault
