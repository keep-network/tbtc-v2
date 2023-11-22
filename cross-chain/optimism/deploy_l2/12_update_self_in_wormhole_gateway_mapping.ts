import type { HardhatRuntimeEnvironment } from "hardhat/types"
import type { DeployFunction } from "hardhat-deploy/types"

const func: DeployFunction = async function (hre: HardhatRuntimeEnvironment) {
  const { deployments, getNamedAccounts, ethers } = hre
  const { execute } = deployments
  const { deployer } = await getNamedAccounts()

  // See https://book.wormhole.com/reference/contracts.html
  // This ID is valid for both Optimism Goerli and Mainnet
  // TODO: check if id is correct for Optimism Sepolia as well (once Wormhole
  // supports that testnet)
  const wormholeChainID = 24

  const optimismWormholeGateway = await deployments.get(
    "OptimismWormholeGateway"
  )

  await execute(
    "OptimismWormholeGateway",
    { from: deployer, log: true, waitConfirmations: 1 },
    "updateGatewayAddress",
    wormholeChainID,
    ethers.utils.hexZeroPad(optimismWormholeGateway.address, 32)
  )
}

export default func

func.tags = ["SetOptimismGatewayAddress"]
func.dependencies = ["OptimismWormholeGateway"]
