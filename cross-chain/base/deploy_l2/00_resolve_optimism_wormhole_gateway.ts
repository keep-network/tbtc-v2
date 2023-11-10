import type { HardhatRuntimeEnvironment } from "hardhat/types"
import type { DeployFunction } from "hardhat-deploy/types"

const func: DeployFunction = async function (hre: HardhatRuntimeEnvironment) {
  const { helpers, deployments } = hre
  const { log } = deployments

  const OptimismWormholeGateway = await deployments.getOrNull(
    "OptimismWormholeGateway"
  )

  if (
    OptimismWormholeGateway &&
    helpers.address.isValid(OptimismWormholeGateway.address)
  ) {
    log(
      `using existing OptimismWormholeGateway at ${OptimismWormholeGateway.address}`
    )
  } else if (hre.network.name === "hardhat") {
    log("using fake OptimismWormholeGateway for hardhat network")
  } else {
    throw new Error("deployed OptimismWormholeGateway contract not found")
  }
}

export default func

func.tags = ["OptimismWormholeGateway"]
