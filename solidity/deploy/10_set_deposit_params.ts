import type { HardhatRuntimeEnvironment } from "hardhat/types"
import type { DeployFunction } from "hardhat-deploy/types"

const func: DeployFunction = async (hre: HardhatRuntimeEnvironment) => {
  const { deployments, ethers, getNamedAccounts } = hre
  const { execute, read } = deployments
  const { deployer } = await getNamedAccounts()

  deployments.log("setting initial deposit parameters")

  const depositTreasuryFeeDivisor = ethers.BigNumber.from("0")

  // Fetch the current values of other deposit parameters to keep them unchanged.
  const depositParameters = await read("Bridge", "depositParameters")

  await execute(
    "Bridge",
    { from: deployer, log: true, waitConfirmations: 1 },
    "updateDepositParameters",
    depositParameters.depositDustThreshold,
    depositTreasuryFeeDivisor,
    depositParameters.depositTxMaxFee,
    depositParameters.depositRevealAheadPeriod
  )

  // Set the optimistic minting fee to 0.2% (1/500 = 0.002 = 0.2%)
  const optimisticMintingFeeDivisor = ethers.BigNumber.from("500")

  // Update of the optimistic fee must be finalized through a
  // finalizeOptimisticMintingFeeUpdate call after the governance delay.
  await execute(
    "TBTCVault",
    { from: deployer, log: true, waitConfirmations: 1 },
    "beginOptimisticMintingFeeUpdate",
    optimisticMintingFeeDivisor
  )
}

export default func

func.tags = ["SetDepositParams"]
func.dependencies = ["Bridge", "TBTCVault"]

func.skip = async (hre: HardhatRuntimeEnvironment): Promise<boolean> =>
  hre.network.name !== "mainnet"
