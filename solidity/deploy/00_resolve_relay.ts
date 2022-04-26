import { HardhatRuntimeEnvironment } from "hardhat/types"
import { DeployFunction } from "hardhat-deploy/types"

const func: DeployFunction = async function (hre: HardhatRuntimeEnvironment) {
  const { getNamedAccounts, deployments, helpers } = hre
  const { log } = deployments
  const { deployer } = await getNamedAccounts()

  const Relay = await deployments.getOrNull("Relay")

  if (Relay && helpers.address.isValid(Relay.address)) {
    log(`using external Relay at ${Relay.address}`)
  } else if (hre.network.name !== "hardhat") {
    throw new Error("deployed Relay contract not found")
  } else {
    log("deploying Relay stub")

    await deployments.deploy("Relay", {
      contract: "TestRelay",
      from: deployer,
      log: true,
    })
  }
}

export default func

func.tags = ["Relay"]
