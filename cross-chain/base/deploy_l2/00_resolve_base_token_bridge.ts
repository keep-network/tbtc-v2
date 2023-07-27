import type { HardhatRuntimeEnvironment } from "hardhat/types"
import type { DeployFunction } from "hardhat-deploy/types"

const func: DeployFunction = async function (hre: HardhatRuntimeEnvironment) {
  const { helpers, deployments } = hre
  const { log } = deployments

  const BaseTokenBridge = await deployments.getOrNull("BaseTokenBridge")

  if (BaseTokenBridge && helpers.address.isValid(BaseTokenBridge.address)) {
    log(`using existing Base TokenBridge at ${BaseTokenBridge.address}`)
  } else if (hre.network.name === "hardhat") {
    log("using fake Base TokenBridge for hardhat network")
  } else {
    throw new Error("deployed Base TokenBridge contract not found")
  }
}

export default func

func.tags = ["BaseTokenBridge"]
