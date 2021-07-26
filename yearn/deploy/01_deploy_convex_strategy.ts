import { HardhatRuntimeEnvironment } from "hardhat/types"
import { DeployFunction } from "hardhat-deploy/types"

const func: DeployFunction = async function (hre: HardhatRuntimeEnvironment) {
  const { deployments, getNamedAccounts, helpers } = hre
  const { deploy, log } = deployments
  const { deployer } = await getNamedAccounts()

  const TBTCCurveVault = await deployments.getOrNull("TBTCCurveVault")
  if (!TBTCCurveVault || !helpers.address.isValid(TBTCCurveVault.address)) {
    throw new Error("Address of TBTCCurveVault must be set")
  }

  const TBTCCurvePoolDepositor = await deployments.getOrNull("TBTCCurvePoolDepositor")
  if (!TBTCCurvePoolDepositor || !helpers.address.isValid(TBTCCurvePoolDepositor.address)) {
    throw new Error("Address of TBTCCurvePoolDepositor must be set")
  }

  const TBTCConvexRewardPool = await deployments.getOrNull("TBTCConvexRewardPool")
  if (!TBTCConvexRewardPool || !TBTCConvexRewardPool.linkedData.id) {
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
      TBTCConvexRewardPool.linkedData.id
    ],
    log: true,
    gasLimit: parseInt(process.env.GAS_LIMIT) || undefined
  })
}

export default func

func.tags = ["ConvexStrategy"]