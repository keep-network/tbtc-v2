import { HardhatRuntimeEnvironment, HardhatNetworkConfig } from "hardhat/types"
import { DeployFunction } from "hardhat-deploy/types"

const func: DeployFunction = async function (hre: HardhatRuntimeEnvironment) {
  const { getNamedAccounts, deployments, helpers } = hre
  const { log } = deployments
  const { deployer } = await getNamedAccounts()

  const BitcoinRelay = await deployments.getOrNull("BitcoinRelay")

  if (BitcoinRelay && helpers.address.isValid(BitcoinRelay.address)) {
    log(`using external BitcoinRelay at ${BitcoinRelay.address}`)
  } else if (
    !hre.network.tags.allowStubs ||
    (hre.network.config as HardhatNetworkConfig)?.forking?.enabled
  ) {
    throw new Error("deployed BitcoinRelay contract not found")
  } else {
    log("deploying BitcoinRelay stub")

    await deployments.deploy("BitcoinRelay", {
      contract: "TestRelay",
      from: deployer,
      log: true,
      waitConfirmations: 1,
    })
  }
}

export default func

func.tags = ["BitcoinRelay"]
