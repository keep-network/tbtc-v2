import { HardhatRuntimeEnvironment } from "hardhat/types"
import { DeployFunction } from "hardhat-deploy/types"

const func: DeployFunction = async function (hre: HardhatRuntimeEnvironment) {
  const { deployments, getNamedAccounts, helpers } = hre
  const { deploy, execute } = deployments
  const { deployer } = await getNamedAccounts()

  const arbitrumTBTC = await deploy("ArbitrumTBTC", {
    from: deployer,
    log: true,
  })

  await execute(
    "ArbitrumTBTC",
    { from: deployer, log: true, waitConfirmations: 1 },
    "initialize",
  )

  if (hre.network.tags.etherscan) {
    await helpers.etherscan.verify(arbitrumTBTC)
  }

  if (hre.network.tags.tenderly) {
    await hre.tenderly.verify({
      name: "ArbitrumTBTC",
      address: arbitrumTBTC.address,
    })
  }
}

export default func

func.tags = ["ArbitrumTBTC"]
