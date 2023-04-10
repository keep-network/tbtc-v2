import type { HardhatRuntimeEnvironment } from "hardhat/types"
import type { DeployFunction } from "hardhat-deploy/types"

const func: DeployFunction = async function (hre: HardhatRuntimeEnvironment) {
  const { helpers, deployments } = hre
  const { log } = deployments

  const PolygonWormholeTBTC = await deployments.getOrNull("PolygonWormholeTBTC")

  if (
    PolygonWormholeTBTC &&
    helpers.address.isValid(PolygonWormholeTBTC.address)
  ) {
    log(`using existing Polygon WormholeTBTC at ${PolygonWormholeTBTC.address}`)
  } else if (hre.network.name === "hardhat") {
    log("using fake Polygon WormholeTBTC for hardhat network")
  } else {
    throw new Error("deployed Polygon WormholeTBTC contract not found")
  }
}

export default func

func.tags = ["PolygonWormholeTBTC"]
