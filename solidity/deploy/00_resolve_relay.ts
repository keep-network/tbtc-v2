import { HardhatRuntimeEnvironment, HardhatNetworkConfig } from "hardhat/types"
import { DeployFunction } from "hardhat-deploy/types"

const func: DeployFunction = async function (hre: HardhatRuntimeEnvironment) {
  const { getNamedAccounts, deployments, helpers } = hre
  const { log } = deployments
  const { deployer } = await getNamedAccounts()

  const LightRelay = await deployments.getOrNull("LightRelay")

  if (LightRelay && helpers.address.isValid(LightRelay.address)) {
    log(`using external LightRelay at ${LightRelay.address}`)
  } else if (
    // TODO: Temporarily deploy a stub for Goerli network.
    hre.network.name !== "goerli" &&
    (!hre.network.tags.allowStubs ||
      (hre.network.config as HardhatNetworkConfig)?.forking?.enabled)
  ) {
    throw new Error("deployed LightRelay contract not found")
  } else {
    log("deploying LightRelay stub")

    await deployments.deploy("LightRelay", {
      contract: "TestRelay",
      from: deployer,
      log: true,
      waitConfirmations: 1,
    })
  }
}

export default func

func.tags = ["LightRelay"]
