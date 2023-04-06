import type { HardhatRuntimeEnvironment } from "hardhat/types"
import type { DeployFunction } from "hardhat-deploy/types"

const func: DeployFunction = async function (hre: HardhatRuntimeEnvironment) {
  const { getNamedAccounts, helpers } = hre
  const { deployer, governance } = await getNamedAccounts()

  await helpers.ownable.transferOwnership("OptimismTBTC", governance, deployer)
}

export default func

func.tags = ["TransferOptimismTBTCOwnership"]
func.dependencies = ["OptimismTBTC", "AuthorizeWormholeGateway"]
func.runAtTheEnd = true
