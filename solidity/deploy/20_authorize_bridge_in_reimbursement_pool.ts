import { HardhatRuntimeEnvironment } from "hardhat/types"
import { DeployFunction } from "hardhat-deploy/types"

const func: DeployFunction = async function (hre: HardhatRuntimeEnvironment) {
  const { getNamedAccounts, deployments } = hre
  const { execute } = deployments
  const { deployer } = await getNamedAccounts()

  const Bridge = await deployments.get("Bridge")

  await execute(
    "ReimbursementPool",
    { from: deployer },
    "authorize",
    Bridge.address
  )
}

export default func

func.tags = ["AuthorizeBridgeInReimbursementPool"]
func.dependencies = ["ReimbursementPool", "Bridge"]
