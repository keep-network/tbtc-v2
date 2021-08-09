import { HardhatRuntimeEnvironment } from "hardhat/types"
import { DeployFunction } from "hardhat-deploy/types"

const func: DeployFunction = async function (hre: HardhatRuntimeEnvironment) {
  const { deployments, getNamedAccounts } = hre
  const { deploy } = deployments
  const { deployer } = await getNamedAccounts()

  const TBTCToken = await deployments.get("TBTCToken")
  const TBTC = await deployments.get("TBTC") // tBTC v2

  const unmintFee = 1000000000000000 // 0.001 of the amount being unminted

  // This deployment is named VendingMachineV2 to avoid conflict with
  // VendingMachine deployment which represents the vending machine for tBTC v1
  // shipped via an external dependency.
  await deploy("VendingMachineV2", {
    contract: "VendingMachine",
    from: deployer,
    args: [TBTCToken.address, TBTC.address, unmintFee],
    log: true,
  })
}

export default func

func.tags = ["VendingMachineV2"]
func.dependencies = ["TBTCToken", "TBTC"]
