import { HardhatRuntimeEnvironment } from "hardhat/types"
import { DeployFunction } from "hardhat-deploy/types"

const func: DeployFunction = async function (hre: HardhatRuntimeEnvironment) {
  const { getNamedAccounts, deployments, helpers } = hre
  const { deployer } = await getNamedAccounts()

  if (hre.network.name === "hardhat") {
    // Unit tests cover the path of the VendingMachine upgrade to TBTCVault.
    // We transfer the ownership of TBTC token to the VendingMachine for Hardhat
    // network used for unit tests to enable this path.
    const VendingMachine = await deployments.get("VendingMachine")
    await helpers.ownable.transferOwnership(
      "TBTC",
      VendingMachine.address,
      deployer
    )
  } else {
    // For all other environments (e.g. local dev, Goerli), we want the
    // TBTCVault to be the owner of TBTC token. This simulates the final
    // 1.0 version mainnet state.
    const TBTCVault = await deployments.get("TBTCVault")
    await helpers.ownable.transferOwnership("TBTC", TBTCVault.address, deployer)
  }
}

export default func

func.tags = ["TransferTBTCOwnership"]
func.dependencies = ["TBTC", "VendingMachine", "TBTCVault"]
func.runAtTheEnd = true
