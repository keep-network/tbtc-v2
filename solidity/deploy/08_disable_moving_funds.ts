import type { HardhatRuntimeEnvironment } from "hardhat/types"
import type { DeployFunction } from "hardhat-deploy/types"

const func: DeployFunction = async (hre: HardhatRuntimeEnvironment) => {
  const { deployments, ethers, getNamedAccounts } = hre
  const { execute, read } = deployments
  const { deployer } = await getNamedAccounts()

  deployments.log("disabling moving funds in the Bridge")

  // To disable moving funds mechanism, we need to prevent wallets entering
  // into the `MOVING_FUNDS` state. A wallet can enter this state in three ways:
  // 1. Wallet does not handle a redemption request on time
  // 2. Wallet submits a valid heartbeat failure claim
  // 3. Wallet is no longer an active wallet and becomes "closeable" i.e.
  //    fulfills all conditions necessary to begin the closing process
  //
  // The first way is covered as redemptions are disabled for the initial
  // launch (see 07_disable_redemptions.ts).
  //
  // The second way requires that a majority of the wallet signing group signs
  // the claim. However, the claim feature is not yet implemented in the
  // official off-chain software so the only option is a malicious majority
  // that cooperates to produce a claim against the protocol. That case has a
  // very low probability.
  //
  // The third case is the only one relevant for this script. A wallet cannot
  // become "closeable" if both of the following is true:
  // - walletMaxAge is set to the maximum value allowed for uint32 type (2^32-1 = 4294967295)
  // - walletClosureMinBtcBalance is zero
  //
  // In practice, walletClosureMinBtcBalance's minimum value enforced by the
  // contract is 1. That should do the trick because only non-active wallets
  // with 0 BTC (no funds to move) can become "closeable" in that case.
  const walletMaxAge = ethers.BigNumber.from("4294967295")
  const walletClosureMinBtcBalance = ethers.BigNumber.from("1")

  // Fetch the current values of other wallet parameters to keep them unchanged.
  const walletParameters = await read("Bridge", "walletParameters")

  await execute(
    "Bridge",
    { from: deployer, log: true, waitConfirmations: 1 },
    "updateWalletParameters",
    walletParameters.walletCreationPeriod,
    walletParameters.walletCreationMinBtcBalance,
    walletParameters.walletCreationMaxBtcBalance,
    walletClosureMinBtcBalance,
    walletMaxAge,
    walletParameters.walletMaxBtcTransfer,
    walletParameters.walletClosingPeriod
  )

  // To emphasize the fact that moving funds is disabled, we set the
  // movingFundsTimeout to uint32 max value (2^32-1 = 4294967295) and
  // movingFundsTimeoutSlashingAmount to zero.
  const movingFundsTimeout = ethers.BigNumber.from("4294967295")
  const movingFundsTimeoutSlashingAmount = ethers.BigNumber.from("0")

  // Fetch the current values of other moving funds parameters to keep them unchanged.
  const movingFundsParameters = await read("Bridge", "movingFundsParameters")

  await execute(
    "Bridge",
    { from: deployer, log: true, waitConfirmations: 1 },
    "updateMovingFundsParameters",
    movingFundsParameters.movingFundsTxMaxTotalFee,
    movingFundsParameters.movingFundsDustThreshold,
    movingFundsParameters.movingFundsTimeoutResetDelay,
    movingFundsTimeout,
    movingFundsTimeoutSlashingAmount,
    movingFundsParameters.movingFundsTimeoutNotifierRewardMultiplier,
    movingFundsParameters.movingFundsCommitmentGasOffset,
    movingFundsParameters.movedFundsSweepTxMaxTotalFee,
    movingFundsParameters.movedFundsSweepTimeout,
    movingFundsParameters.movedFundsSweepTimeoutSlashingAmount,
    movingFundsParameters.movedFundsSweepTimeoutNotifierRewardMultiplier
  )
}

export default func

func.tags = ["DisableMovingFunds"]
func.dependencies = ["Bridge"]

func.skip = async (hre: HardhatRuntimeEnvironment): Promise<boolean> =>
  hre.network.name !== "mainnet"
