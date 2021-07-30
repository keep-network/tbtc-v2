import { HardhatRuntimeEnvironment } from "hardhat/types"
import { DeployFunction } from "hardhat-deploy/types"

const func: DeployFunction = async function (hre: HardhatRuntimeEnvironment) {
  const { deployments, getNamedAccounts, helpers } = hre
  const { deploy, log } = deployments
  const { deployer } = await getNamedAccounts()

  const TBTCCurveVault = await deployments.get("TBTCCurveVault")
  if (!helpers.address.isValid(TBTCCurveVault.address)) {
    throw new Error(`Invalid TBTCCurveVault address: ${TBTCCurveVault.address}`)
  }

  const TBTCCurvePoolDepositor = await deployments.get("TBTCCurvePoolDepositor")
  if (!helpers.address.isValid(TBTCCurvePoolDepositor.address)) {
    throw new Error(
      `Invalid TBTCCurvePoolDepositor address: ${TBTCCurvePoolDepositor.address}`
    )
  }

  const TBTCConvexRewardPool = await deployments.get("TBTCConvexRewardPool")
  if (!TBTCConvexRewardPool.linkedData.id) {
    throw new Error("ID of TBTCConvexRewardPool must be set")
  }

  log(`tbtcCurveVault: ${TBTCCurveVault.address}`)
  log(`tbtcCurvePoolDepositor: ${TBTCCurvePoolDepositor.address}`)
  log(`tbtcConvexRewardPoolId: ${TBTCConvexRewardPool.linkedData.id}`)

  await deploy("ConvexStrategy", {
    from: deployer,
    args: [
      TBTCCurveVault.address,
      TBTCCurvePoolDepositor.address,
      TBTCConvexRewardPool.linkedData.id,
    ],
    log: true,
    gasLimit: parseInt(process.env.GAS_LIMIT) || undefined,
  })
}

export default func

func.tags = ["ConvexStrategy"]
