import { HardhatRuntimeEnvironment } from "hardhat/types"
import { DeployFunction } from "hardhat-deploy/types"

const func: DeployFunction = async function (hre: HardhatRuntimeEnvironment) {
  const { getNamedAccounts, deployments } = hre
  const { execute } = deployments
  const { deployer } = await getNamedAccounts()

  // TODO: Fill with proper values
  const genesisHeader = "0x000000000000000000000000000000000000000000000000"
  const genesisHeight = 1234567
  const genesisProofLength = 20

  await execute(
    "LightRelay",
    { from: deployer, log: true, waitConfirmations: 1 },
    "genesis",
    genesisHeader,
    genesisHeight,
    genesisProofLength
  )
}

export default func

func.tags = ["GenesisLightRelay"]
func.dependencies = ["LightRelay"]
