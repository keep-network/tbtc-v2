import { HardhatRuntimeEnvironment } from "hardhat/types"
import { DeployFunction } from "hardhat-deploy/types"

const func: DeployFunction = async function (hre: HardhatRuntimeEnvironment) {
  const { deployments, getNamedAccounts } = hre
  const { deploy } = deployments
  const { deployer } = await getNamedAccounts()

  const TBTCToken = await deployments.get("TBTCToken")
  const TBTC = await deployments.get("TBTC") // tBTC v2

  const unmintFee = 1000000000000000 // 0.001 of the amount being unminted

  await deploy("VendingMachine", {
    from: deployer,
    args: [TBTCToken.address, TBTC.address, unmintFee],
    log: true,
  })
}

export default func

func.tags = ["VendingMachine"]
func.dependencies = ["TBTCToken", "TBTC"]
