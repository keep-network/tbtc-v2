// Constants related with Yearn.
module.exports.yearn = {
  // Address of the Yearn registry contract.
  registryAddress: "0x50c1a2eA0a861A967D9d0FFE2AE4012c2E053804",
  // Address of the governance managing the StrategyProxy contract.
  strategyProxyGovernanceAddress: "0xFEB4acf3df3cDEA7399794D0869ef76A6EfAff52",
}

// Constants related with Convex.
module.exports.convex = {
  // Address of the Convex booster contract.
  boosterAddress: "0xF403C135812408BFbE8713b5A23a04b3D48AAE31",
}

// Constants related with tBTC token and liquidity pools (Curve, Saddle, etc.).
// TODO: The tBTC v2 token and their liquidity pools are not deployed yet. Those
//       addresses are related with tBTC v1 token and liquidity pool temporarily.
//       Once the new token and pools land, those addresses must be changed.
module.exports.tbtc = {
  // Address of the tBTC v2 Curve pool LP token.
  curvePoolLPTokenAddress: "0x64eda51d3Ad40D56b9dFc5554E06F94e1Dd786Fd",
  // Example address which holds an amount of the tBTC v2 Curve pool LP token.
  curvePoolLPTokenHolderAddress: "0x26fcbd3afebbe28d0a8684f790c48368d21665b5",
  // Address of the tBTC v2 Curve pool depositor contract.
  curvePoolDepositorAddress: "0xaa82ca713D94bBA7A89CEAB55314F9EfFEdDc78c",
  // Address of the tBTC v2 Curve pool gauge contract.
  curvePoolGaugeAddress: "0x6828bcF74279eE32f2723eC536c22c51Eed383C6",
  // Address of the tBTC v2 Curve pool gauge additional reward token.
  curvePoolGaugeRewardAddress: "0x85Eee30c52B0b379b046Fb0F85F4f3Dc3009aFEC",
  // Example address which holds an amount of the tBTC v2 Curve pool gauge
  // additional reward token and can act as its distributor.
  curvePoolGaugeRewardDistributorAddress:
    "0x5203aeaaee721195707b01e613b6c3259b3a5cf6",
  // ID of the Convex reward pool paired with the tBTC v2 Curve pool.
  convexRewardPoolId: 16,
  // Address of the Synthetix Curve rewards contract used by the tBTC v2 Curve
  // pool gauge.
  synthetixCurveRewardsAddress: "0xAF379f0228ad0d46bB7B4f38f9dc9bCC1ad0360c",
  // Address of the Synthetix Curve rewards contract owner.
  synthetixCurveRewardsOwnerAddress:
    "0xb3726e69da808a689f2607939a2d9e958724fc2a",
}
