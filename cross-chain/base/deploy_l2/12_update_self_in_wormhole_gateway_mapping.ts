import type { HardhatRuntimeEnvironment } from "hardhat/types"
import type { DeployFunction } from "hardhat-deploy/types"

const func: DeployFunction = async function (hre: HardhatRuntimeEnvironment) {
  const { deployments, getNamedAccounts, ethers } = hre
  const { execute } = deployments
  const { deployer } = await getNamedAccounts()

  // See https://docs.wormhole.com/wormhole/blockchain-environments/evm#base
  // This ID is valid for both Base Goerli and Base Mainnet
  // TODO: check if id is correct for Base Sepolia as well (once Wormhole
  // supports that testnet)
  const wormholeChainID = 30

  const baseWormholeGateway = await deployments.get("BaseWormholeGateway")

  await execute(
    "BaseWormholeGateway",
    { from: deployer, log: true, waitConfirmations: 1 },
    "updateGatewayAddress",
    wormholeChainID,
    ethers.utils.hexZeroPad(baseWormholeGateway.address, 32)
  )
}

export default func

func.tags = ["SetBaseGatewayAddress"]
func.dependencies = ["BaseWormholeGateway"]
