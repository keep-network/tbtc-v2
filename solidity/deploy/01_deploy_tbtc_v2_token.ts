import { HardhatRuntimeEnvironment } from "hardhat/types"
import { DeployFunction } from "hardhat-deploy/types"

const func: DeployFunction = async function (hre: HardhatRuntimeEnvironment) {
  const { deployments, getNamedAccounts } = hre
  const { deploy } = deployments
  const { deployer } = await getNamedAccounts()

  // This deployment is named TBTCTokenV2 to avoid conflict with TBTCToken
  // deployment which represents the tBTC v1 token shipped via an external
  // dependency.
  await deploy("TBTCTokenV2", {
    contract: "TBTCToken",
    from: deployer,
    log: true
  })
}

export default func

func.tags = ["TBTCTokenV2"]