import type { HardhatRuntimeEnvironment } from "hardhat/types"
import type { DeployFunction } from "hardhat-deploy/types"

const func: DeployFunction = async function (hre: HardhatRuntimeEnvironment) {
  const { helpers, deployments } = hre
  const { log } = deployments

  const ArbitrumWormholeGateway = await deployments.getOrNull(
    "ArbitrumWormholeGateway"
  )

  if (
    ArbitrumWormholeGateway &&
    helpers.address.isValid(ArbitrumWormholeGateway.address)
  ) {
    log(
      `using existing ArbitrumWormholeGateway at ${ArbitrumWormholeGateway.address}`
    )
  } else if (hre.network.name === "hardhat") {
    log("using fake ArbitrumWormholeGateway for hardhat network")
  } else {
    throw new Error("deployed ArbitrumWormholeGateway contract not found")
  }
}

export default func

func.tags = ["ArbitrumWormholeGateway"]
