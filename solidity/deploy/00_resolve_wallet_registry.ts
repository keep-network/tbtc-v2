import { HardhatRuntimeEnvironment } from "hardhat/types"

import { DeployFunction } from "hardhat-deploy/types"

import deploySortitionPool from "@keep-network/ecdsa/export/deploy/01_deploy_sortition_pool"
import deployReimbursementPool from "@keep-network/ecdsa/export/deploy/02_deploy_reimbursement_pool"
import deployDkgValidator from "@keep-network/ecdsa/export/deploy/03_deploy_dkg_validator"

const func: DeployFunction = async function (hre: HardhatRuntimeEnvironment) {
  const { getNamedAccounts, deployments, helpers } = hre
  const { log } = deployments
  const { deployer } = await getNamedAccounts()

  const WalletRegistry = await deployments.getOrNull("WalletRegistry")

  if (WalletRegistry && helpers.address.isValid(WalletRegistry.address)) {
    log(`using external WalletRegistry at ${WalletRegistry.address}`)
  } else if (hre.network.name !== "hardhat") {
    throw new Error("deployed WalletRegistry contract not found")
  } else {
    // FIXME: This is a workaround deployment. We expect that the `WalletRegistry`
    // contract deployment will be imported from `@keep-network/ecdsa` deployment
    // scripts. But due to some bug or incompatibility of the plugins we use
    // the deployment fails. We need to investigate it further nad get working
    // properly.
    // https://github.com/keep-network/tbtc-v2/issues/267
    log("deploying WalletRegistry")

    await deploySortitionPool(hre)
    await deployReimbursementPool(hre)
    await deployDkgValidator(hre)

    const SortitionPool = await deployments.get("SortitionPool")
    const TokenStaking = await deployments.get("TokenStaking")
    const ReimbursementPool = await deployments.get("ReimbursementPool")
    const EcdsaDkgValidator = await deployments.get("EcdsaDkgValidator")

    // TODO: RandomBeaconStub contract should be replaced by actual implementation of
    // RandomBeacon contract, once @keep-network/random-beacon hardhat deployments
    // scripts are implemented.
    log("deploying RandomBeaconStub contract instead of RandomBeacon")
    const RandomBeacon = await deployments.deploy("RandomBeaconStub", {
      from: deployer,
      log: true,
    })

    const EcdsaInactivity = await deployments.deploy("EcdsaInactivity", {
      from: deployer,
      log: true,
    })

    await deployments.deploy("WalletRegistry", {
      from: deployer,
      args: [SortitionPool.address, TokenStaking.address],
      libraries: {
        EcdsaInactivity: EcdsaInactivity.address,
      },
      proxy: {
        proxyContract: "TransparentUpgradeableProxy",
        viaAdminContract: "DefaultProxyAdmin",
        owner: deployer,
        execute: {
          init: {
            methodName: "initialize",
            args: [
              EcdsaDkgValidator.address,
              RandomBeacon.address,
              ReimbursementPool.address,
            ],
          },
        },
      },
      log: true,
    })
  }
}

export default func

func.tags = ["WalletRegistry"]
