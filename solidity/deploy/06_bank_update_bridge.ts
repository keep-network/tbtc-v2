import { HardhatRuntimeEnvironment } from "hardhat/types"
import { DeployFunction } from "hardhat-deploy/types"

const func: DeployFunction = async function (hre: HardhatRuntimeEnvironment) {
  const { getNamedAccounts, deployments } = hre
  const { execute, log } = deployments
  const { deployer } = await getNamedAccounts()

  const Bridge = await deployments.get("Bridge")

  log("updating Bridge in Bank")

  await execute("Bank", { from: deployer }, "updateBridge", Bridge.address)
}

export default func

func.tags = ["BankUpdateBridge"]
func.dependencies = ["Bank", "Bridge"]
