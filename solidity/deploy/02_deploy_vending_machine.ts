import { HardhatRuntimeEnvironment } from "hardhat/types"
import { DeployFunction } from "hardhat-deploy/types"

const func: DeployFunction = async function (hre: HardhatRuntimeEnvironment) {
  const { deployments, helpers, getNamedAccounts } = hre
  const { deploy } = deployments
  const { deployer } = await getNamedAccounts()

  const TBTCToken = await deployments.get("TBTCToken")
  const TBTC = await deployments.get("TBTC") // tBTC v2

  const unmintFee = 0

  const VendingMachine = await deploy("VendingMachine", {
    from: deployer,
    args: [TBTCToken.address, TBTC.address, unmintFee],
    log: true,
  })

  if (hre.network.tags.tenderly) {
    await hre.tenderly.verify({
      name: "VendingMachine",
      address: VendingMachine.address,
    })
  }

  await helpers.ownable.transferOwnership(
    "TBTC",
    VendingMachine.address,
    deployer
  )
}

export default func

func.tags = ["VendingMachine"]
func.dependencies = ["TBTCToken", "TBTC"]
