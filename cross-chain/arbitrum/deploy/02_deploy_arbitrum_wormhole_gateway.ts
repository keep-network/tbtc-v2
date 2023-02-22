import { HardhatRuntimeEnvironment } from "hardhat/types"
import { DeployFunction } from "hardhat-deploy/types"

const func: DeployFunction = async function (hre: HardhatRuntimeEnvironment) {
  const { deployments, getNamedAccounts, helpers } = hre
  const { deploy } = deployments
  const { deployer } = await getNamedAccounts()

  const arbitrumWormholeGateway = await deploy("ArbitrumWormholeGateway", {
    from: deployer,
    log: true,
  })

  if (hre.network.tags.etherscan) {
    await helpers.etherscan.verify(arbitrumWormholeGateway)
  }

  if (hre.network.tags.tenderly) {
    await hre.tenderly.verify({
      name: "ArbitrumWormholeGateway",
      address: arbitrumWormholeGateway.address,
    })
  }
}

export default func

func.tags = ["ArbitrumWormholeGateway"]
