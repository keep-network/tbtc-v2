import { HardhatRuntimeEnvironment } from "hardhat/types"
import { DeployFunction } from "hardhat-deploy/types"

const func: DeployFunction = async function (hre: HardhatRuntimeEnvironment) {
  const { getNamedAccounts, deployments } = hre
  const { execute } = deployments
  const { deployer } = await getNamedAccounts()

  await execute(
    "LightRelay",
    { from: deployer, log: true, waitConfirmations: 1 },
    "setAuthorizationStatus",
    true
  )

  await execute(
    "LightRelay",
    { from: deployer, log: true, waitConfirmations: 1 },
    "authorize",
    deployer
  )
}

export default func

func.tags = ["AuthorizeLightRelayMaintainer"]
func.dependencies = ["LightRelay"]
