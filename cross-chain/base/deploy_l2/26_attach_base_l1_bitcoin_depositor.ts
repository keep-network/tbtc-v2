import type { HardhatRuntimeEnvironment } from "hardhat/types"
import type { DeployFunction } from "hardhat-deploy/types"

const func: DeployFunction = async (hre: HardhatRuntimeEnvironment) => {
  const { deployments, getNamedAccounts } = hre
  const { deployer } = await getNamedAccounts()
  const { execute } = deployments
  const l1Deployments = hre.companionNetworks.l1.deployments

  const baseL1BitcoinDepositor = await l1Deployments.get(
    "BaseL1BitcoinDepositor"
  )

  await execute(
    "BaseL2BitcoinDepositor",
    { from: deployer, log: true, waitConfirmations: 1 },
    "attachL1BitcoinDepositor",
    baseL1BitcoinDepositor.address
  )
}

export default func

func.tags = ["AttachBaseL1BitcoinDepositor"]
func.dependencies = ["BaseL2BitcoinDepositor"]
