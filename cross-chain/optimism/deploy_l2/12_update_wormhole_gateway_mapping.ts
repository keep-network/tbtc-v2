import type { HardhatRuntimeEnvironment } from "hardhat/types"
import type { DeployFunction } from "hardhat-deploy/types"

const func: DeployFunction = async function (hre: HardhatRuntimeEnvironment) {
  const { deployments, getNamedAccounts, ethers } = hre
  const { execute } = deployments
  const { deployer } = await getNamedAccounts()

  // See https://book.wormhole.com/reference/contracts.html
  // This ID is valid for both Optimism Goerli and Mainnet
  const wormholeChainID = 24

  const optimisticWormholeGateway = await deployments.get(
    "OptimisticWormholeGateway"
  )

  await execute(
    "OptimisticWormholeGateway",
    { from: deployer, log: true, waitConfirmations: 1 },
    "updateGatewayAddress",
    wormholeChainID,
    ethers.utils.hexZeroPad(optimisticWormholeGateway.address, 32)
  )
}

export default func

func.tags = ["SetGatewayAddress"]
func.dependencies = ["OptimisticWormholeGateway"]
