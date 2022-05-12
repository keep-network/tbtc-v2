import type { HardhatRuntimeEnvironment } from "hardhat/types"
import type { DeployFunction } from "hardhat-deploy/types"

const func: DeployFunction = async (hre: HardhatRuntimeEnvironment) => {
  const { ethers, getNamedAccounts, upgrades, deployments } = hre
  const { esdm } = await getNamedAccounts()
  const { deployer } = await ethers.getNamedSigners()

  // TODO: Once a DAO is established we want to switch to ProxyAdminWithDeputy and
  // use the DAO as the proxy admin owner and ESDM as the deputy. Until then we
  // use governance as the owner of ProxyAdmin contract.
  const newProxyAdminOwner = esdm

  deployments.log(`transferring ProxyAdmin ownership to ${newProxyAdminOwner}`)

  const proxyAdmin = await upgrades.admin.getInstance()
  await proxyAdmin.connect(deployer).transferOwnership(newProxyAdminOwner)
}

export default func

func.tags = ["TransferProxyAdminOwnership"]
func.dependencies = ["Bridge"]
