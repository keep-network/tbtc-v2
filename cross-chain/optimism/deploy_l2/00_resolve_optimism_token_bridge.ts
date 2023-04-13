import type { HardhatRuntimeEnvironment } from "hardhat/types"
import type { DeployFunction } from "hardhat-deploy/types"

const func: DeployFunction = async function (hre: HardhatRuntimeEnvironment) {
  const { helpers, deployments } = hre
  const { log } = deployments

  const OptimismTokenBridge = await deployments.getOrNull("OptimismTokenBridge")

  if (
    OptimismTokenBridge &&
    helpers.address.isValid(OptimismTokenBridge.address)
  ) {
    log(`using existing Optimism TokenBridge at ${OptimismTokenBridge.address}`)
  } else if (hre.network.name === "hardhat") {
    log("using fake Optimism TokenBridge for hardhat network")
  } else {
    throw new Error("deployed Optimism TokenBridge contract not found")
  }
}

export default func

func.tags = ["OptimismTokenBridge"]
