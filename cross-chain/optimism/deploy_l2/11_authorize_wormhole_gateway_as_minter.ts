import type { HardhatRuntimeEnvironment } from "hardhat/types"
import type { DeployFunction } from "hardhat-deploy/types"

const func: DeployFunction = async function (hre: HardhatRuntimeEnvironment) {
  const { deployments, getNamedAccounts } = hre
  const { execute } = deployments
  const { deployer } = await getNamedAccounts()

  const optimismWormholeGateway = await deployments.get(
    "OptimismWormholeGateway"
  )

  await execute(
    "OptimismTBTC",
    { from: deployer, log: true, waitConfirmations: 1 },
    "addMinter",
    optimismWormholeGateway.address
  )
}

export default func

func.tags = ["AuthorizeWormholeGateway"]
func.dependencies = ["OptimismTBTC", "OptimismWormholeGateway"]
