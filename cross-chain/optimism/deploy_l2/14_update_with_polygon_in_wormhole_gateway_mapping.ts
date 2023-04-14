import type { HardhatRuntimeEnvironment } from "hardhat/types"
import type { DeployFunction } from "hardhat-deploy/types"

const func: DeployFunction = async function (hre: HardhatRuntimeEnvironment) {
  const { deployments, getNamedAccounts, ethers } = hre
  const { execute, log } = deployments
  const { governace } = await getNamedAccounts()

  // Fake PolygonWormholeGateway for local development purposes only.
  const fakePolygonWormholeGateway =
    "0x1af5DC16568EFF2d480a43A77E6C409e497FcFb9"

  // See https://book.wormhole.com/reference/contracts.html
  // This ID is valid for both Polygon Testnet (Mumbai) and Mainnet
  const polygonWormholeChainID = 5

  const polygonWormholeGateway = await deployments.getOrNull(
    "PolygonWormholeGateway"
  )

  let polygonWormholeGatewayAddress = polygonWormholeGateway?.address
  if (!polygonWormholeGatewayAddress && hre.network.name === "hardhat") {
    polygonWormholeGatewayAddress = fakePolygonWormholeGateway
    log(`fake PolygonWormholeGateway address ${polygonWormholeGatewayAddress}`)
  }

  await execute(
    "OptimismWormholeGateway",
    { from: governace, log: true, waitConfirmations: 1 },
    "updateGatewayAddress",
    polygonWormholeChainID,
    ethers.utils.hexZeroPad(polygonWormholeGatewayAddress, 32)
  )
}

export default func

func.tags = ["SetPolygonGatewayAddress"]
func.dependencies = ["OptimismWormholeGateway"]
