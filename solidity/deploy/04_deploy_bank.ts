import { HardhatRuntimeEnvironment } from "hardhat/types"
import { DeployFunction } from "hardhat-deploy/types"

const func: DeployFunction = async function (hre: HardhatRuntimeEnvironment) {
  const { deployments, getNamedAccounts } = hre
  const { deploy } = deployments
  const { deployer } = await getNamedAccounts()

  const Bank = await deploy("Bank", {
    contract:
      process.env.TEST_USE_STUBS_TBTC === "true" ? "BankStub" : undefined,
    from: deployer,
    args: [],
    log: true,
    waitConfirmations: 1,
  })

  if (hre.network.tags.tenderly) {
    await hre.tenderly.verify({
      name: "Bank",
      address: Bank.address,
    })
  }
}

export default func

func.tags = ["Bank"]
