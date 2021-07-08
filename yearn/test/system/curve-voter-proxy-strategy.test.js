const { expect } = require("chai")
const { BigNumber } = ethers
const {
  resetFork,
  to1ePrecision,
  impersonateAccount,
  increaseTime,
} = require("../helpers/contract-test-helpers.js")

const describeFn =
  process.env.NODE_ENV === "system-test" ? describe : describe.skip

// TODO: The tBTC v2 token and their Curve pool are not deployed yet.
//       This test uses tBTC v1 token and Curve pool temporarily.
//       Once the new token and pool land, those addresses must be changed:
//       - tbtcCurvePoolLPTokenAddress
//       - tbtcCurvePoolLPTokenHolderAddress
//       - tbtcCurvePoolDepositorAddress
//       - tbtcCurvePoolGaugeAddress
//       - tbtcCurvePoolGaugeRewardAddress
describeFn("System -- curve voter proxy strategy", () => {
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
  // Address of the tBTC v2 Curve pool gauge contract.
  const tbtcCurvePoolGaugeAddress = "0x6828bcF74279eE32f2723eC536c22c51Eed383C6"
  // Address of the tBTC v2 Curve pool additional gauge reward token.
  const tbtcCurvePoolGaugeRewardAddress =
    "0x85Eee30c52B0b379b046Fb0F85F4f3Dc3009aFEC"
  // Address of the governance managing the StrategyProxy contract.
  const strategyProxyGovernanceAddress =
    "0xFEB4acf3df3cDEA7399794D0869ef76A6EfAff52"

  // Name of the vault for tBTCv2 Curve pool.
  const vaultName = "Curve tBTCv2 Pool yVault"
  // Symbol of the vault for tBTCv2 Curve pool.
  const vaultSymbol = "yvCurve-tBTCv2"

  let vaultGovernance
  let tbtcCurvePoolLPToken
  let vaultDepositor
  let strategyProxyGovernance

  before(async () => {
    await resetFork(12786839)

    // Setup roles.
    vaultGovernance = await ethers.getSigner(0)
    vaultDepositor = await impersonateAccount(
      tbtcCurvePoolLPTokenHolderAddress,
      vaultGovernance
    )
    strategyProxyGovernance = await impersonateAccount(
      strategyProxyGovernanceAddress
    )

    // Get tBTC v2 Curve pool LP token handle.
    tbtcCurvePoolLPToken = await ethers.getContractAt(
      "IERC20",
      tbtcCurvePoolLPTokenAddress
    )

    // Get a handle to the Yearn registry.
    const registry = await ethers.getContractAt(
      "IYearnRegistry",
      registryAddress
    )

    // Deploy a new experimental vault accepting tBTC v2 Curve pool LP tokens.
    const tx = await registry.newExperimentalVault(
      tbtcCurvePoolLPToken.address,
      vaultGovernance.address,
      vaultGovernance.address, // set governance to be the guardian as well
      vaultGovernance.address, // set governance to be the rewards target as well
      vaultName,
      vaultSymbol
    )

    // Get a handle to the experimental Yearn vault.
    const vault = await ethers.getContractAt(
      "IYearnVault",
      extractVaultAddress(await tx.wait())
    )

    // Just check the vault has been created properly.
    expect(await vault.name()).to.be.equal(vaultName)

    // Deploy the CurveVoterProxyStrategy contract.
    const CurveVoterProxyStrategy = await ethers.getContractFactory(
      "CurveVoterProxyStrategy"
    )
    const strategy = await CurveVoterProxyStrategy.deploy(
      vault.address,
      tbtcCurvePoolDepositorAddress,
      tbtcCurvePoolGaugeAddress,
      tbtcCurvePoolGaugeRewardAddress
    )
    await strategy.deployed()

    // Approve the strategy for the gauge in the StrategyProxy contract.
    const strategyProxy = await ethers.getContractAt(
      "IStrategyProxy",
      await strategy.strategyProxy()
    )
    await strategyProxy
      .connect(strategyProxyGovernance)
      .approveStrategy(tbtcCurvePoolGaugeAddress, strategy.address)

    // Add CurveVoterProxyStrategy to the vault.
    await vault.addStrategy(
      strategy.address,
      10000, // 100% debt ratio
      0, // zero min debt per harvest
      BigNumber.from(2).pow(256).sub(1), // infinite max debt per harvest
      1000 // 10% performance fee
    )

    // Set a deposit limit.
    await vault.setDepositLimit(to1ePrecision(300, 15))

    // Deposit some tokens into the vault.
    const depositAmount = to1ePrecision(300, 15)
    await tbtcCurvePoolLPToken
      .connect(vaultDepositor)
      .approve(vault.address, depositAmount)
    await vault.connect(vaultDepositor).deposit(depositAmount)

    // TODO: Just a temporary check whether the strategy performs well.
    //       Move this to separate `it` sections.
    for (let i = 0; i < 8; i++) {
      await strategy.harvest()
      await increaseTime(604800) // ~1 week
      console.log(`result ${await vault.strategies(strategy.address)}`)
    }
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
