import { HardhatRuntimeEnvironment } from "hardhat/types"
import { DeployFunction } from "hardhat-deploy/types"

const func: DeployFunction = async function (hre: HardhatRuntimeEnvironment) {
  const { getNamedAccounts, deployments } = hre
  const { deployer, governance } = await getNamedAccounts()

  await deployments.execute(
    "Bridge",
    { from: deployer },
    "transferGovernance",
    governance
  )
}

export default func

func.tags = ["TransferGovernance"]
func.dependencies = ["Bridge"]
func.runAtTheEnd = true
