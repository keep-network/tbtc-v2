import type { HardhatRuntimeEnvironment } from "hardhat/types"
import type { DeployFunction } from "hardhat-deploy/types"

const func: DeployFunction = async function (hre: HardhatRuntimeEnvironment) {
  const { helpers, deployments } = hre
  const { log } = deployments

  const PolygonWormholeGateway = await deployments.getOrNull(
    "PolygonWormholeGateway"
  )

  if (
    PolygonWormholeGateway &&
    helpers.address.isValid(PolygonWormholeGateway.address)
  ) {
    log(
      `using existing PolygonWormholeGateway at ${PolygonWormholeGateway.address}`
    )
  } else if (hre.network.name === "hardhat") {
    log("using fake PolygonWormholeGateway for hardhat network")
  } else {
    throw new Error("deployed PolygonWormholeGateway contract not found")
  }
}

export default func

func.tags = ["PolygonWormholeGateway"]
