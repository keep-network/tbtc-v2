import type { HardhatRuntimeEnvironment } from "hardhat/types"
import type { DeployFunction } from "hardhat-deploy/types"

const func: DeployFunction = async function (hre: HardhatRuntimeEnvironment) {
  const { deployments, getNamedAccounts } = hre
  const { execute } = deployments
  const { governance } = await getNamedAccounts()

  const ArbitrumWormholeGateway = await deployments.get(
    "ArbitrumWormholeGateway"
  )

  await execute(
    "ArbitrumTBTC",
    { from: governance, log: true, waitConfirmations: 1 },
    "addMinter",
    ArbitrumWormholeGateway.address
  )
}

export default func

func.tags = ["AuthorizeWormholeGateway"]
func.dependencies = ["ArbitrumTBTC", "ArbitrumWormholeGateway"]
func.runAtTheEnd = true
