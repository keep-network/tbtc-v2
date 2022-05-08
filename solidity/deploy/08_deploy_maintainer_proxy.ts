import { HardhatRuntimeEnvironment } from "hardhat/types"
import { DeployFunction } from "hardhat-deploy/types"

const func: DeployFunction = async function (hre: HardhatRuntimeEnvironment) {
  const { deployments, getNamedAccounts } = hre
  const { deploy } = deployments
  const { deployer } = await getNamedAccounts()

  const Bridge = await deployments.get("Bridge")
  const ReimbursementPool = await deployments.get("ReimbursementPool")

  const MaintainerProxy = await deploy("MaintainerProxy", {
    contract:
      deployments.getNetworkName() === "hardhat"
        ? "MaintainerProxy"
        : undefined,
    from: deployer,
    args: [Bridge.address, ReimbursementPool.address],
    log: true,
  })

  if (hre.network.tags.tenderly) {
    await hre.tenderly.verify({
      name: "MaintainerProxy",
      address: MaintainerProxy.address,
    })
  }
}

export default func

func.tags = ["MaintainerProxy"]
func.dependencies = ["Bridge", "ReimbursementPool"]
