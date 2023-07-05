import { Artifact, HardhatRuntimeEnvironment } from "hardhat/types"
import { DeployFunction, Deployment } from "hardhat-deploy/types"
import { ContractFactory } from "ethers"
import { ProxyAdmin, WalletCoordinator } from "../typechain"

const func: DeployFunction = async function (hre: HardhatRuntimeEnvironment) {
  const { ethers, helpers, deployments } = hre

  const { deployer } = await helpers.signers.getNamedSigners()

  const proxyDeployment: Deployment = await deployments.get("WalletCoordinator")
  const implementationContractFactory: ContractFactory =
    await ethers.getContractFactory("WalletCoordinator", {
      signer: deployer,
    })

  // Deploy new implementation contract
  const newImplementationAddress: string = (await hre.upgrades.prepareUpgrade(
    proxyDeployment,
    implementationContractFactory,
    {
      kind: "transparent",
    }
  )) as string

  deployments.log(
    `new implementation contract deployed at: ${newImplementationAddress}`
  )

  // Assemble proxy upgrade transaction.
  const proxyAdmin: ProxyAdmin = await hre.upgrades.admin.getInstance()
  const proxyAdminOwner = await proxyAdmin.owner()

  const upgradeTxData = await proxyAdmin.interface.encodeFunctionData(
    "upgrade",
    [proxyDeployment.address, newImplementationAddress]
  )

  deployments.log(
    `proxy admin owner ${proxyAdminOwner} is required to upgrade proxy implementation with transaction:\n` +
      `\t\tfrom: ${proxyAdminOwner}\n` +
      `\t\tto: ${proxyAdmin.address}\n` +
      `\t\tdata: ${upgradeTxData}`
  )

  // Assemble parameters upgrade transaction.
  const walletCoordinator: WalletCoordinator =
    await helpers.contracts.getContract("WalletCoordinator")

  const walletCoordinatorOwner = await walletCoordinator.owner()

  const updateRedemptionProposalParametersTxData =
    walletCoordinator.interface.encodeFunctionData(
      "updateRedemptionProposalParameters",
      [7200, 600, 7200, 20, 20000]
    )

  deployments.log(
    `WalletCoordinator owner ${walletCoordinatorOwner} is required to update redemption proposal parameters with transaction:\n` +
      `\t\tfrom: ${walletCoordinatorOwner}\n` +
      `\t\tto: ${walletCoordinator.address}\n` +
      `\t\tdata: ${updateRedemptionProposalParametersTxData}`
  )

  // Update Deployment Artifact
  const walletCoordinatorArtifact: Artifact =
    hre.artifacts.readArtifactSync("WalletCoordinator")

  await deployments.save("WalletCoordinator", {
    ...proxyDeployment,
    abi: walletCoordinatorArtifact.abi,
    implementation: newImplementationAddress,
  })

  if (hre.network.tags.etherscan) {
    // We use `verify` instead of `verify:verify` as the `verify` task is defined
    // in "@openzeppelin/hardhat-upgrades" to perform Etherscan verification
    // of Proxy and Implementation contracts.
    await hre.run("verify", {
      address: proxyDeployment.address,
      constructorArgsParams: proxyDeployment.args,
    })
  }

  if (hre.network.tags.tenderly) {
    await hre.tenderly.verify({
      name: "WalletCoordinator",
      address: newImplementationAddress,
    })
  }
}

export default func

func.tags = ["UpgradeWalletCoordinator"]
// When running an upgrade uncomment the skip below and run the command:
// yarn deploy --tags UpgradeWalletCoordinator --network <NETWORK>
func.skip = async () => true
