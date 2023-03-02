import { deployments, ethers, upgrades } from "hardhat"

import type { FactoryOptions } from "hardhat/types"
import type { Contract } from "ethers"
import type { UpgradeProxyOptions } from "@openzeppelin/hardhat-upgrades/src/utils/options"

export interface UpgradesUpgradeOptions {
  contractName?: string
  initializerArgs?: unknown[]
  factoryOpts?: FactoryOptions
  proxyOpts?: UpgradeProxyOptions
}

export async function upgradeProxy(
  currentContractName: string,
  newContractName: string,
  opts?: UpgradesUpgradeOptions
): Promise<Contract> {
  const currentContract = await deployments.get(currentContractName)

  const newContract = await ethers.getContractFactory(
    opts?.contractName || newContractName,
    opts?.factoryOpts
  )

  return upgrades.upgradeProxy(
    currentContract.address,
    newContract,
    opts?.proxyOpts
  )
}
