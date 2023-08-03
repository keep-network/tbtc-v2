import type { HardhatRuntimeEnvironment } from "hardhat/types"
import type { DeployFunction } from "hardhat-deploy/types"

const func: DeployFunction = async function (hre: HardhatRuntimeEnvironment) {
  const { helpers, deployments } = hre
  const { log } = deployments

  const PolygonTokenBridge = await deployments.getOrNull("PolygonTokenBridge")

  if (
    PolygonTokenBridge &&
    helpers.address.isValid(PolygonTokenBridge.address)
  ) {
    log(`using existing Polygon TokenBridge at ${PolygonTokenBridge.address}`)
  } else if (hre.network.name === "hardhat") {
    log("using fake Polygon TokenBridge for hardhat network")
  } else {
    throw new Error("deployed Polygon TokenBridge contract not found")
  }
}

export default func

func.tags = ["PolygonTokenBridge"]
