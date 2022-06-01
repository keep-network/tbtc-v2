import { HardhatRuntimeEnvironment } from "hardhat/types"
import { DeployFunction } from "hardhat-deploy/types"

const func: DeployFunction = async function (hre: HardhatRuntimeEnvironment) {
  const { getNamedAccounts, deployments } = hre
  const { execute } = deployments
  const { deployer } = await getNamedAccounts()

  const MaintainerProxy = await deployments.get("MaintainerProxy")

  await execute(
    "ReimbursementPool",
    { from: deployer },
    "authorize",
    MaintainerProxy.address
  )
}

export default func

func.tags = ["AuthorizeMaintainerProxy"]
func.dependencies = ["ReimbursementPool", "MaintainerProxy"]
