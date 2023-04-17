import type { HardhatRuntimeEnvironment } from "hardhat/types"
import type { DeployFunction } from "hardhat-deploy/types"

const func: DeployFunction = async function (hre: HardhatRuntimeEnvironment) {
  const { deployments, getNamedAccounts, ethers } = hre
  const { execute, log } = deployments
  const { governance } = await getNamedAccounts()

  // Fake OptimismWormholeGateway for local development purposes only.
  const fakeOptimismWormholeGateway =
    "0x1af5DC16568EFF2d480a43A77E6C409e497FcFb9"

  // See https://book.wormhole.com/reference/contracts.html
  // This ID is valid for both Optimism Goerli and Mainnet
  const optimismWormholeChainID = 24

  const optimismWormholeGateway = await deployments.getOrNull(
    "OptimismWormholeGateway"
  )

  let optimismWormholeGatewayAddress = optimismWormholeGateway?.address
  if (!optimismWormholeGatewayAddress && hre.network.name === "hardhat") {
    optimismWormholeGatewayAddress = fakeOptimismWormholeGateway
    log(
      `fake OptimismWormholeGateway address ${optimismWormholeGatewayAddress}`
    )
  }

  await execute(
    "ArbitrumWormholeGateway",
    { from: governance, log: true, waitConfirmations: 1 },
    "updateGatewayAddress",
    optimismWormholeChainID,
    ethers.utils.hexZeroPad(optimismWormholeGatewayAddress, 32)
  )
}

export default func

func.tags = ["SetOptimismGatewayAddress"]
func.dependencies = ["OptimismWormholeGateway"]
