const { to1e18, to1ePrecision } = require("../helpers/contract-test-helpers.js")
const { BigNumber } = ethers

module.exports.curveStrategyFixture = {
  // Name of the vault for tBTCv2 Curve pool.
  vaultName: "Curve tBTCv2 Pool yVault",
  // Symbol of the vault for tBTCv2 Curve pool.
  vaultSymbol: "yvCurve-tBTCv2",
  // Total deposit limit of the vault for tBTCv2 Curve pool.
  vaultDepositLimit: to1ePrecision(300, 15), // 0.3
  // Amount of the deposit made by the depositor.
  vaultDepositAmount: to1ePrecision(300, 15), // 0.3
  // Amount of Synthetix staking rewards which should be allocated.
  synthetixRewardsAllocation: to1e18(100000), // 100k
  // The share of the total assets in the vault that the strategy has access to.
  strategyDebtRatio: 10000, // 100%
  // Lower limit on the increase of debt since last harvest.
  strategyMinDebtPerHarvest: 0,
  // Upper limit on the increase of debt since last harvest.
  strategyMaxDebtPerHarvest: BigNumber.from(2).pow(256).sub(1), // infinite
  // The fee the strategist will receive based on this Vault's performance.
  strategyPerformanceFee: 1000, // 10%
}

module.exports.saddleStrategyFixture = {
  // Name of the vault for tBTCv2 Curve pool.
  vaultName: "Curve tBTCv2 Pool yVault",
  // Symbol of the vault for tBTCv2 Curve pool.
  vaultSymbol: "yvCurve-tBTCv2",
  // Total deposit limit of the vault for tBTCv2 Curve pool.
  vaultDepositLimit: to1ePrecision(300, 15), // 0.3
  // Amount of the deposit made by the depositor.
  vaultDepositAmount: to1ePrecision(300, 15), // 0.3
  // Amount of Synthetix staking rewards which should be allocated.
  synthetixRewardsAllocation: to1e18(100000), // 100k
  // The share of the total assets in the vault that the strategy has access to.
  strategyDebtRatio: 10000, // 100%
  // Lower limit on the increase of debt since last harvest.
  strategyMinDebtPerHarvest: 0,
  // Upper limit on the increase of debt since last harvest.
  strategyMaxDebtPerHarvest: BigNumber.from(2).pow(256).sub(1), // infinite
  // The fee the strategist will receive based on this Vault's performance.
  strategyPerformanceFee: 1000, // 10%
}
