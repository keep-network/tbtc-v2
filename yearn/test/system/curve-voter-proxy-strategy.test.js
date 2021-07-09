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
  // Total deposit limit of the vault for tBTCv2 Curve pool.
  const vaultDepositLimit = to1ePrecision(300, 15)
  // Amount of the deposit made by the depositor.
  const vaultDepositAmount = to1ePrecision(300, 15)

  let vaultGovernance
  let tbtcCurvePoolLPToken
  let vaultDepositor
  let strategyProxyGovernance
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
      // Simulate 4 harvests, one every week. Note that the DEX pool used to
      // swap CRV and rewards for wBTC is not balanced by opposite swaps. Hence,
      // the price of wBTC increases during the test and the acquired wBTC
      // amount drops on each iteration causing a drop of the iteration
      // profit too. In real world, such a situation is very unlikely.
      for (let i = 0; i < 4; i++) {
        await strategy.harvest()
        await increaseTime(604800) // ~1 week
      }
    })

    it("should make a profit", async () => {
      // Currently, make just a simple check.
      // TODO: Check the numbers (additional Synthethix rewards too).
      expect((await vault.strategies(strategy.address)).totalGain.gt(0)).to.be
        .true
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
      // Currently, make just a simple check and assert the depositor received
      // its deposited amount with a portion of the profit earned by the vault.
      // TODO: Check the numbers
      expect(amountWithdrawn.gt(vaultDepositAmount)).to.be.true
    })
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
