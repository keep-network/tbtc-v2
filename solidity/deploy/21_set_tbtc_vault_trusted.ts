import { HardhatRuntimeEnvironment } from "hardhat/types"
import { DeployFunction } from "hardhat-deploy/types"

const func: DeployFunction = async function (hre: HardhatRuntimeEnvironment) {
  const { deployments, getNamedAccounts } = hre
  const { execute, read } = deployments
  const { governance } = await getNamedAccounts()

  const TBTCVault = await deployments.get("TBTCVault")

  const isVaultTrusted: boolean = await read(
    "Bridge",
    "isVaultTrusted",
    TBTCVault.address
  )

  if (!isVaultTrusted) {
    await execute(
      "BridgeGovernance",
      { from: governance, log: true, waitConfirmations: 1 },
      "setVaultStatus",
      TBTCVault.address,
      true
    )
  }
}

export default func

func.tags = ["SetVaultTrusted"]
func.dependencies = [
  "BridgeGovernance",
  "BridgeGovernanceOwnership",
  "TBTCVault",
]
func.runAtTheEnd = true

// Skip for mainnet.
func.skip = async (hre: HardhatRuntimeEnvironment): Promise<boolean> =>
  hre.network.name === "mainnet"
