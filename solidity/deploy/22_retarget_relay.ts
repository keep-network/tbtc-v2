import { HardhatRuntimeEnvironment } from "hardhat/types"
import { DeployFunction } from "hardhat-deploy/types"

const func: DeployFunction = async function (hre: HardhatRuntimeEnvironment) {
  const { getNamedAccounts, deployments } = hre
  const { execute } = deployments
  const { deployer } = await getNamedAccounts()

  // TODO: Fill with proper value
  const headers = "0x000000000000000000000000000000000000000000000000"

  await execute(
    "LightRelay",
    { from: deployer, log: true, waitConfirmations: 1 },
    "retarget",
    headers
  )
}

export default func

func.tags = ["RetargetLightRelay"]
func.dependencies = ["LightRelay"]
