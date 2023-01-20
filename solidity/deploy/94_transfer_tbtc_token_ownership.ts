import { HardhatRuntimeEnvironment } from "hardhat/types"
import { DeployFunction } from "hardhat-deploy/types"

const func: DeployFunction = async function (hre: HardhatRuntimeEnvironment) {
  const { deployments, helpers, getNamedAccounts } = hre
  const { execute } = deployments
  const { deployer } = await getNamedAccounts()

  const TBTCVault = await deployments.get("TBTCVault")

  await execute(
    "VendingMachine",
    { from: deployer, log: true, waitConfirmations: 1 },
    "initiateVendingMachineUpgrade",
    TBTCVault.address
  )

  await execute(
    "VendingMachine",
    { from: deployer, log: true, waitConfirmations: 1 },
    "finalizeVendingMachineUpgrade"
  )
}

export default func

func.tags = ["TransferTBTCOwnership"]
func.dependencies = ["TBTC", "VendingMachine", "TBTCVault"]
