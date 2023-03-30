import type { HardhatRuntimeEnvironment } from "hardhat/types"
import type { DeployFunction } from "hardhat-deploy/types"

const func: DeployFunction = async function (hre: HardhatRuntimeEnvironment) {
  const { helpers, deployments } = hre
  const { log } = deployments

  const L2TokenBridge = await deployments.getOrNull("TokenBridge") // L2

  if (L2TokenBridge && helpers.address.isValid(L2TokenBridge.address)) {
    log(`using existing L2 TokenBridge at ${L2TokenBridge.address}`)
  } else if (hre.network.name === "hardhat") {
    log("using fake L2 TokenBridge for hardhat network")
  } else {
    throw new Error("deployed L2 TokenBridge contract not found")
  }
}

export default func

func.tags = ["L2TokenBridge"]
