import { HardhatRuntimeEnvironment } from "hardhat/types"
import { DeployFunction } from "hardhat-deploy/types"

const func: DeployFunction = async function (hre: HardhatRuntimeEnvironment) {
  const { getNamedAccounts, helpers } = hre
  const { deployer, governance } = await getNamedAccounts()

  await helpers.ownable.transferOwnership("Bank", governance, deployer)

  await helpers.ownable.transferOwnership("Bridge", governance, deployer)
}

export default func

func.tags = ["TransferOwnership"]
func.dependencies = ["Bank", "Bridge"]
func.runAtTheEnd = true
