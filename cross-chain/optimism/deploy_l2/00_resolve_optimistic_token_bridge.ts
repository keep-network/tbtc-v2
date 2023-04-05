import type { HardhatRuntimeEnvironment } from "hardhat/types"
import type { DeployFunction } from "hardhat-deploy/types"

const func: DeployFunction = async function (hre: HardhatRuntimeEnvironment) {
  const { helpers, deployments } = hre
  const { log } = deployments

  const OptimisticTokenBridge = await deployments.getOrNull(
    "OptimisticTokenBridge"
  )

  if (
    OptimisticTokenBridge &&
    helpers.address.isValid(OptimisticTokenBridge.address)
  ) {
    log(
      `using existing Optimistic TokenBridge at ${OptimisticTokenBridge.address}`
    )
  } else if (hre.network.name === "hardhat") {
    log("using fake Optimistic TokenBridge for hardhat network")
  } else {
    throw new Error("deployed Optimistic TokenBridge contract not found")
  }
}

export default func

func.tags = ["OptimisticTokenBridge"]
