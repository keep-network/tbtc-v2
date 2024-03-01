import type { HardhatRuntimeEnvironment } from "hardhat/types"
import type { DeployFunction } from "hardhat-deploy/types"

const func: DeployFunction = async function (hre: HardhatRuntimeEnvironment) {
  const { getNamedAccounts, helpers } = hre
  const { deployer, governance } = await getNamedAccounts()

  await helpers.ownable.transferOwnership(
    "BaseL2BitcoinDepositor",
    governance,
    deployer
  )
}

export default func

func.tags = ["TransferBaseL2BitcoinDepositorOwnership"]
func.dependencies = ["BaseL2BitcoinDepositor"]
func.runAtTheEnd = true
