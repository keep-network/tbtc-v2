import type { HardhatRuntimeEnvironment } from "hardhat/types"
import type { DeployFunction } from "hardhat-deploy/types"

const func: DeployFunction = async function (hre: HardhatRuntimeEnvironment) {
  const { deployments, getNamedAccounts } = hre
  const { execute } = deployments
  const { deployer } = await getNamedAccounts()

  const polygonWormholeGateway = await deployments.get("PolygonWormholeGateway")

  await execute(
    "PolygonTBTC",
    { from: deployer, log: true, waitConfirmations: 1 },
    "addMinter",
    polygonWormholeGateway.address
  )
}

export default func

func.tags = ["AuthorizeWormholeGateway"]
func.dependencies = ["PolygonTBTC", "PolygonWormholeGateway"]
