import type { HardhatRuntimeEnvironment } from "hardhat/types"
import type { DeployFunction } from "hardhat-deploy/types"

const func: DeployFunction = async function (hre: HardhatRuntimeEnvironment) {
  const { deployments, getNamedAccounts, ethers } = hre
  const { execute, log } = deployments
  const { deployer } = await getNamedAccounts()

  // Fake BaseWormholeGateway for local development purposes only.
  const fakeBaseWormholeGateway = "0x1af5DC16568EFF2d480a43A77E6C409e497FcFb9"

  // See https://docs.wormhole.com/wormhole/blockchain-environments/evm#base and
  // https://docs.wormhole.com/wormhole/blockchain-environments/evm#base-sepolia
  // The value `30` is valid for both Base Goerli and Base Mainnet. The value
  // for Base Sepolia is `10004`.
  const baseWormholeChainID =
    hre.network.name === "optimismSepolia" ? 10004 : 30

  const baseWormholeGateway = await deployments.getOrNull("BaseWormholeGateway")

  let baseWormholeGatewayAddress = baseWormholeGateway?.address
  if (!baseWormholeGatewayAddress && hre.network.name === "hardhat") {
    baseWormholeGatewayAddress = fakeBaseWormholeGateway
    log(`fake BaseWormholeGateway address ${baseWormholeGatewayAddress}`)
  }

  await execute(
    "OptimismWormholeGateway",
    { from: deployer, log: true, waitConfirmations: 1 },
    "updateGatewayAddress",
    baseWormholeChainID,
    ethers.utils.hexZeroPad(baseWormholeGatewayAddress, 32)
  )
}

export default func

func.tags = ["SetBaseGatewayAddress"]
func.dependencies = ["BaseWormholeGateway", "OptimismWormholeGateway"]
