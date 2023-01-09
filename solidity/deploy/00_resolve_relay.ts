import { HardhatRuntimeEnvironment, HardhatNetworkConfig } from "hardhat/types"
import { DeployFunction } from "hardhat-deploy/types"

const func: DeployFunction = async function (hre: HardhatRuntimeEnvironment) {
  const { getNamedAccounts, deployments, helpers } = hre
  const { log } = deployments
  const { deployer } = await getNamedAccounts()

  const LightRelay = await deployments.getOrNull("LightRelay")

  // We expect the `LightRelay` contract to be deployed just once and reused
  // for future deployments.The artifact of the contract to use should be committed to
  // the `deployments/<network>/LightRelay.json` file.
  // If the existing deployment artifact is not found, the script will deploy
  // the contract.
  if (LightRelay && helpers.address.isValid(LightRelay.address)) {
    log(`using external LightRelay at ${LightRelay.address}`)
  } else {
    // Temporarily for goerli we deploy `TestRelay` contract, until the relay
    // maintainer is ready.
    // Temporarily for system tests, that run on `localhost` network we deploy
    // a `TestRelay` contract, until the relay maintainer is ready.
    await deployments.deploy("LightRelay", {
      contract: hre.network.name !== "mainnet" ? "TestRelay" : "LightRelay",
      from: deployer,
      log: true,
      waitConfirmations: 1,
    })
  }
}

export default func

func.tags = ["LightRelay"]
