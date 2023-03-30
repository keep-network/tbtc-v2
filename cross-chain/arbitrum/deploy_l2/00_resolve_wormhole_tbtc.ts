import type { HardhatRuntimeEnvironment } from "hardhat/types"
import type { DeployFunction } from "hardhat-deploy/types"

const func: DeployFunction = async function (hre: HardhatRuntimeEnvironment) {
  const { helpers, deployments } = hre
  const { log } = deployments

  const WormholeTBTC = await deployments.getOrNull("WormholeTBTC") // L2

  if (WormholeTBTC && helpers.address.isValid(WormholeTBTC.address)) {
    log(`using existing L2 WormholeTBTC at ${WormholeTBTC.address}`)
  } else if (hre.network.name === "hardhat") {
    log('using fake L2 WormholeTBTC for hardhat network')
  } else {
    throw new Error("deployed L2 WormholeTBTC contract not found")
  }

}

export default func

func.tags = ["L2WormholeTBTC"]
