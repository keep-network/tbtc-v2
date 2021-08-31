import { HardhatRuntimeEnvironment } from "hardhat/types"
import { DeployFunction } from "hardhat-deploy/types"

const func: DeployFunction = async function (hre: HardhatRuntimeEnvironment) {
  const { getNamedAccounts, helpers, deployments } = hre
  const { execute, log } = deployments
  const { deployer, keepTechnicalWalletTeam, keepCommunityMultiSig } =
    await getNamedAccounts()

  log(
    `transferring vendingMachineUpgradeInitiator role to ${keepTechnicalWalletTeam}`
  )

  await execute(
    "VendingMachine",
    { from: deployer },
    "transferVendingMachineUpgradeInitiatorRole",
    keepTechnicalWalletTeam
  )

  log(
    `transferring unmintFeeUpdateInitiator role to ${keepTechnicalWalletTeam}`
  )

  await execute(
    "VendingMachine",
    { from: deployer },
    "transferUnmintFeeUpdateInitiatorRole",
    keepTechnicalWalletTeam
  )

  await helpers.ownable.transferOwnership(
    "VendingMachine",
    keepCommunityMultiSig,
    deployer
  )
}

export default func

func.tags = ["TransferRoles"]
func.dependencies = ["TBTC", "VendingMachine"]
func.runAtTheEnd = true
func.skip = async function (hre: HardhatRuntimeEnvironment): Promise<boolean> {
  return hre.network.name !== "mainnet"
}
