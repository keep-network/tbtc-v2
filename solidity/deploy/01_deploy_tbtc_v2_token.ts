import { HardhatRuntimeEnvironment } from "hardhat/types"
import { DeployFunction } from "hardhat-deploy/types"

const func: DeployFunction = async function (hre: HardhatRuntimeEnvironment) {
  const { deployments, getNamedAccounts } = hre
  const { deploy } = deployments
  const { deployer } = await getNamedAccounts()

  const TBTC = await deploy("TBTC", {
    from: deployer,
    log: true,
  })

  if (hre.network.tags.tenderly) {
    await hre.tenderly.verify({
      name: "TBTC",
      address: TBTC.address,
    })
  }
}

export default func

func.tags = ["TBTC"]
