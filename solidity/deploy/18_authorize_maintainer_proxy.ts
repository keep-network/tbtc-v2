import { HardhatRuntimeEnvironment } from "hardhat/types"
import { DeployFunction } from "hardhat-deploy/types"

const func: DeployFunction = async function (hre: HardhatRuntimeEnvironment) {
  const { getNamedAccounts, deployments } = hre
  const { execute } = deployments
  const { deployer } = await getNamedAccounts()

  const MaintainerProxy = await deployments.get("MaintainerProxy")

  await execute(
    "ReimbursementPool",
    { from: deployer, log: true, waitConfirmations: 1 },
    "authorize",
    MaintainerProxy.address
  )

  await execute(
    "Bridge",
    { from: deployer, log: true, waitConfirmations: 1 },
    "setSpvMaintainerStatus",
    MaintainerProxy.address,
    true
  )
}

export default func

func.tags = ["AuthorizeMaintainerProxy"]
func.dependencies = ["ReimbursementPool", "MaintainerProxy"]
