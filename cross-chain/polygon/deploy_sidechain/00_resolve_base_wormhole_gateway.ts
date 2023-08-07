import type { HardhatRuntimeEnvironment } from "hardhat/types"
import type { DeployFunction } from "hardhat-deploy/types"

const func: DeployFunction = async function (hre: HardhatRuntimeEnvironment) {
  const { helpers, deployments } = hre
  const { log } = deployments

  const BaseWormholeGateway = await deployments.getOrNull(
    "BaseWormholeGateway"
  )

  if (
    BaseWormholeGateway &&
    helpers.address.isValid(BaseWormholeGateway.address)
  ) {
    log(
      `using existing BaseWormholeGateway at ${BaseWormholeGateway.address}`
    )
  } else if (hre.network.name === "hardhat") {
    log("using fake BaseWormholeGateway for hardhat network")
  } else {
    throw new Error("deployed BaseWormholeGateway contract not found")
  }
}

export default func

func.tags = ["BaseWormholeGateway"]
