import { HardhatRuntimeEnvironment } from "hardhat/types"
import { DeployFunction } from "hardhat-deploy/types"

const func: DeployFunction = async function (hre: HardhatRuntimeEnvironment) {
  const { getNamedAccounts, deployments } = hre
  const { execute } = deployments
  const { deployer, spvMaintainer } = await getNamedAccounts()

  await execute(
    "Bridge",
    { from: deployer, log: true, waitConfirmations: 1 },
    "setSpvMaintainerStatus",
    spvMaintainer,
    true
  )
}

export default func

func.tags = ["AuthorizeSpvMaintainer"]
func.dependencies = ["Bridge"]
