import { HardhatRuntimeEnvironment } from "hardhat/types"
import { DeployFunction } from "hardhat-deploy/types"

const func: DeployFunction = async function (hre: HardhatRuntimeEnvironment) {
  const { getNamedAccounts, deployments, helpers } = hre
  const { deployer } = await getNamedAccounts()

  // LightRelay is the real-world relay and is deployed for mainnet.
  // GoerliLightRelay is a stub version with immutable difficulties and is
  // deployed for goerli.
  // TestRelay is a stub version with mutable difficulties and is deployed for
  // hardhat.
  function resolveRelayName() {
    if (hre.network.name === "mainnet") {
      return "LightRelay"
    }
    if (hre.network.name === "goerli") {
      return "GoerliLightRelay"
    }
    return "TestRelay"
  }

  const lightRelay = await deployments.deploy("LightRelay", {
    contract: resolveRelayName(),
    from: deployer,
    log: true,
    waitConfirmations: 1,
  })

  if (hre.network.tags.etherscan) {
    await helpers.etherscan.verify(lightRelay)
  }

  if (hre.network.tags.tenderly) {
    await hre.tenderly.verify({
      name: "LightRelay",
      address: lightRelay.address,
    })
  }
}

export default func

func.tags = ["LightRelay"]
