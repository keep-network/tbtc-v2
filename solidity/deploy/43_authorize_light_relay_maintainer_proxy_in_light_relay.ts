import { HardhatRuntimeEnvironment } from "hardhat/types"
import { DeployFunction } from "hardhat-deploy/types"

const func: DeployFunction = async function (hre: HardhatRuntimeEnvironment) {
  const { getNamedAccounts, deployments } = hre
  const { execute } = deployments
  const { deployer } = await getNamedAccounts()

  const LightRelayMaintainerProxy = await deployments.get(
    "LightRelayMaintainerProxy"
  )

  // TODO: Find who should call this step
  await execute(
    "LightRelay",
    { from: deployer, log: true, waitConfirmations: 1 },
    "authorize",
    LightRelayMaintainerProxy.address
  )
}

export default func

func.tags = ["AuthorizeLightRelayMaintainerProxyInLightRelay"]
func.dependencies = ["LightRelay", "LightRelayMaintainerProxy"]

// TODO: Check if it should be done in mainnet
func.skip = async (hre: HardhatRuntimeEnvironment): Promise<boolean> =>
  hre.network.name === "mainnet"
