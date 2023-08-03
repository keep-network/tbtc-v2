import type { HardhatRuntimeEnvironment } from "hardhat/types"
import type { DeployFunction } from "hardhat-deploy/types"

const func: DeployFunction = async function (hre: HardhatRuntimeEnvironment) {
  const { deployments, getNamedAccounts } = hre
  const { execute } = deployments
  const { deployer } = await getNamedAccounts()

  const baseWormholeGateway = await deployments.get("BaseWormholeGateway")

  await execute(
    "BaseTBTC",
    { from: deployer, log: true, waitConfirmations: 1 },
    "addMinter",
    baseWormholeGateway.address
  )
}

export default func

func.tags = ["AuthorizeWormholeGateway"]
func.dependencies = ["BaseTBTC", "BaseWormholeGateway"]
