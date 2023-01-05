import { HardhatRuntimeEnvironment } from "hardhat/types"
import { DeployFunction } from "hardhat-deploy/types"

const func: DeployFunction = async function (hre: HardhatRuntimeEnvironment) {
  const { getNamedAccounts, deployments, helpers } = hre
  const { deployer } = await getNamedAccounts()

  // LightRelay is deployed only for mainnet. For all other networks (Hardhat,
  // Goerli) we use TestRelay contract. LightRelay will work properly only with
  // Bitcoin Mainnet headers.
  const lightRelay = await deployments.deploy("LightRelay", {
    contract: hre.network.name === "mainnet" ? "LightRelay" : "TestRelay",
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
