import type { HardhatRuntimeEnvironment } from "hardhat/types"
import type { DeployFunction } from "hardhat-deploy/types"

const func: DeployFunction = async function (hre: HardhatRuntimeEnvironment) {
  const { helpers, deployments } = hre
  const { log } = deployments

  const ArbitrumTokenBridge = await deployments.getOrNull("ArbitrumTokenBridge")

  if (
    ArbitrumTokenBridge &&
    helpers.address.isValid(ArbitrumTokenBridge.address)
  ) {
    log(`using existing Arbitrum TokenBridge at ${ArbitrumTokenBridge.address}`)
  } else if (hre.network.name === "hardhat") {
    log("using fake Arbitrum TokenBridge for hardhat network")
  } else {
    throw new Error("deployed Arbitrum TokenBridge contract not found")
  }
}

export default func

func.tags = ["ArbitrumTokenBridge"]
