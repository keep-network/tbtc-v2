import { Deployment } from "hardhat-deploy/types"
import { helpers } from "hardhat"

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
): Promise<[Contract, Deployment]> {
  return helpers.upgrades.upgradeProxy(
    currentContractName,
    newContractName,
    opts
  )
}
