import type { HardhatRuntimeEnvironment } from "hardhat/types"
import type { DeployFunction } from "hardhat-deploy/types"

const func: DeployFunction = async function (hre: HardhatRuntimeEnvironment) {
  const { helpers, deployments } = hre
  const { log } = deployments

  const ArbitrumWormholeTBTC = await deployments.getOrNull(
    "ArbitrumWormholeTBTC"
  )

  if (
    ArbitrumWormholeTBTC &&
    helpers.address.isValid(ArbitrumWormholeTBTC.address)
  ) {
    log(
      `using existing Arbitrum WormholeTBTC at ${ArbitrumWormholeTBTC.address}`
    )
  } else if (hre.network.name === "hardhat") {
    log("using fake Arbitrum WormholeTBTC for hardhat network")
  } else {
    throw new Error("deployed Arbitrum WormholeTBTC contract not found")
  }
}

export default func

func.tags = ["ArbitrumWormholeTBTC"]
