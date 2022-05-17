import { HardhatRuntimeEnvironment } from "hardhat/types"
import { DeployFunction } from "hardhat-deploy/types"

const func: DeployFunction = async function (hre: HardhatRuntimeEnvironment) {
  const { deployments, getNamedAccounts } = hre
  const { deploy } = deployments
  const { deployer } = await getNamedAccounts()

  const Bank = await deployments.get("Bank")
  const TBTC = await deployments.get("TBTC")

  const TBTCVault = await deploy("TBTCVault", {
    contract: "TBTCVault",
    from: deployer,
    args: [Bank.address, TBTC.address],
    log: true,
  })

  if (hre.network.tags.tenderly) {
    await hre.tenderly.verify({
      name: "TBTCVault",
      address: TBTCVault.address,
    })
  }
}

export default func

func.tags = ["TBTCVault"]
