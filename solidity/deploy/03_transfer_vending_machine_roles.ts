import { HardhatRuntimeEnvironment } from "hardhat/types"
import { DeployFunction } from "hardhat-deploy/types"

const func: DeployFunction = async function (hre: HardhatRuntimeEnvironment) {
  const { getNamedAccounts, helpers, deployments } = hre
  const { execute, read, log } = deployments
  const { deployer, keepTechnicalWalletTeam, keepCommunityMultiSig } =
    await getNamedAccounts()

  const vendingMachineOwner: string = await read("VendingMachine", "owner")
  if (vendingMachineOwner === keepTechnicalWalletTeam) {
    log(
      `transferring vendingMachineUpgradeInitiator role to ${keepTechnicalWalletTeam}`
    )

    await execute(
      "VendingMachine",
      { from: deployer, log: true, waitConfirmations: 1 },
      "transferVendingMachineUpgradeInitiatorRole",
      keepTechnicalWalletTeam
    )
  }

  const unmintFeeUpdateInitiator: string = await read(
    "VendingMachine",
    "unmintFeeUpdateInitiator"
  )
  if (unmintFeeUpdateInitiator === keepTechnicalWalletTeam) {
    log(
      `transferring unmintFeeUpdateInitiator role to ${keepTechnicalWalletTeam}`
    )

    await execute(
      "VendingMachine",
      { from: deployer, log: true, waitConfirmations: 1 },
      "transferUnmintFeeUpdateInitiatorRole",
      keepTechnicalWalletTeam
    )
  }

  await helpers.ownable.transferOwnership(
    "VendingMachine",
    keepCommunityMultiSig,
    deployer
  )
}

export default func

func.tags = ["TransferVendingMachineRoles"]
func.dependencies = ["TBTC", "VendingMachine"]
func.runAtTheEnd = true
