import type { HardhatRuntimeEnvironment } from "hardhat/types"
import type { DeployFunction } from "hardhat-deploy/types"

const func: DeployFunction = async function (hre: HardhatRuntimeEnvironment) {
  const { helpers, deployments } = hre
  const { log } = deployments

  const OptimismWormholeTBTC = await deployments.getOrNull(
    "OptimismWormholeTBTC"
  )

  if (
    OptimismWormholeTBTC &&
    helpers.address.isValid(OptimismWormholeTBTC.address)
  ) {
    log(
      `using existing Optimism WormholeTBTC at ${OptimismWormholeTBTC.address}`
    )
  } else if (hre.network.name === "hardhat") {
    log("using fake Optimism WormholeTBTC for hardhat network")
  } else {
    throw new Error("deployed Optimism WormholeTBTC contract not found")
  }
}

export default func

func.tags = ["OptimismWormholeTBTC"]
