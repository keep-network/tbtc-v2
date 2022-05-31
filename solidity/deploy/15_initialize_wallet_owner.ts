import type { HardhatRuntimeEnvironment } from "hardhat/types"
import type { DeployFunction } from "hardhat-deploy/types"

import initializeWalletOwner from "@keep-network/ecdsa/export/tasks/initialize-wallet-owner"

const func: DeployFunction = async (hre: HardhatRuntimeEnvironment) => {
  const Bridge = await hre.deployments.get("Bridge")

  await initializeWalletOwner(hre, Bridge.address)
}

export default func

func.tags = ["InitializeWalletOwner"]
func.dependencies = ["Bridge"]

func.skip = async (hre: HardhatRuntimeEnvironment): Promise<boolean> =>
  hre.network.name === "mainnet"
