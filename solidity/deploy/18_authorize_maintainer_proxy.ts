import { HardhatRuntimeEnvironment } from "hardhat/types"
import { DeployFunction } from "hardhat-deploy/types"

const func: DeployFunction = async function (hre: HardhatRuntimeEnvironment) {
  const { getNamedAccounts, deployments } = hre
  const { execute, log } = deployments
  const { deployer } = await getNamedAccounts()

  const MaintainerProxy = await deployments.get("MaintainerProxy")

  log(
    `authorizing MaintainerProxy (${MaintainerProxy.address}) in ReimbursementPool`
  )

  await execute(
    "ReimbursementPool",
    { from: deployer },
    "authorize",
    MaintainerProxy.address
  )

  log(
    `setting MaintainerProxy (${MaintainerProxy.address}) as trusted SPV Maintainer in Bridge`
  )

  await execute(
    "Bridge",
    { from: deployer },
    "setSpvMaintainerStatus",
    MaintainerProxy.address,
    true
  )
}

export default func

func.tags = ["AuthorizeMaintainerProxy"]
func.dependencies = ["ReimbursementPool", "MaintainerProxy"]
