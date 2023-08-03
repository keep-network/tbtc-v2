import type { HardhatRuntimeEnvironment } from "hardhat/types"
import type { DeployFunction } from "hardhat-deploy/types"

const func: DeployFunction = async function (hre: HardhatRuntimeEnvironment) {
  const { helpers, deployments } = hre
  const { log } = deployments

  const BaseWormholeTBTC = await deployments.getOrNull("BaseWormholeTBTC")

  if (BaseWormholeTBTC && helpers.address.isValid(BaseWormholeTBTC.address)) {
    log(`using existing Base WormholeTBTC at ${BaseWormholeTBTC.address}`)
  } else if (hre.network.name === "hardhat") {
    log("using fake Base WormholeTBTC for hardhat network")
  } else {
    throw new Error("deployed Base WormholeTBTC contract not found")
  }
}

export default func

func.tags = ["BaseWormholeTBTC"]
