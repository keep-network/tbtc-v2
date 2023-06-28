import { HardhatRuntimeEnvironment } from "hardhat/types"
import { DeployFunction } from "hardhat-deploy/types"

const func: DeployFunction = async function (hre: HardhatRuntimeEnvironment) {
  const { getNamedAccounts, deployments } = hre
  const { execute } = deployments
  const { deployer, coordinator } = await getNamedAccounts()

  await execute(
    "WalletCoordinator",
    { from: deployer, log: true, waitConfirmations: 1 },
    "addCoordinator",
    coordinator
  )
}

export default func

func.tags = ["AddCoordinatorAddress"]
func.dependencies = ["WalletCoordinator"]
