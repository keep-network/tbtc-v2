import type { HardhatRuntimeEnvironment } from "hardhat/types"
import type { DeployFunction } from "hardhat-deploy/types"

const func: DeployFunction = async function (hre: HardhatRuntimeEnvironment) {
  const { helpers, deployments } = hre
  const { log } = deployments

  const OptimisticWormholeTBTC = await deployments.getOrNull(
    "OptimisticWormholeTBTC"
  )

  if (
    OptimisticWormholeTBTC &&
    helpers.address.isValid(OptimisticWormholeTBTC.address)
  ) {
    log(
      `using existing Optimistic WormholeTBTC at ${OptimisticWormholeTBTC.address}`
    )
  } else if (hre.network.name === "hardhat") {
    log("using fake Optimistic WormholeTBTC for hardhat network")
  } else {
    throw new Error("deployed Optimistic WormholeTBTC contract not found")
  }
}

export default func

func.tags = ["OptimisticWormholeTBTC"]
