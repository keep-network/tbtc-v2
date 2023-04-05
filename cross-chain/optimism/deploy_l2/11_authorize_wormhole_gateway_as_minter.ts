import type { HardhatRuntimeEnvironment } from "hardhat/types"
import type { DeployFunction } from "hardhat-deploy/types"

const func: DeployFunction = async function (hre: HardhatRuntimeEnvironment) {
  const { deployments, getNamedAccounts } = hre
  const { execute } = deployments
  const { deployer } = await getNamedAccounts()

  const optimisticWormholeGateway = await deployments.get(
    "OptimisticWormholeGateway"
  )

  await execute(
    "OptimisticTBTC",
    { from: deployer, log: true, waitConfirmations: 1 },
    "addMinter",
    optimisticWormholeGateway.address
  )
}

export default func

func.tags = ["AuthorizeWormholeGateway"]
func.dependencies = ["OptimisticTBTC", "OptimisticWormholeGateway"]
