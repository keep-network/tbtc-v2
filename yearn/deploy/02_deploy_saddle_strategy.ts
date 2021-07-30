import { HardhatRuntimeEnvironment } from "hardhat/types"
import { DeployFunction } from "hardhat-deploy/types"

const func: DeployFunction = async function (hre: HardhatRuntimeEnvironment) {
  const { deployments, getNamedAccounts, helpers } = hre
  const { deploy, log } = deployments
  const { deployer } = await getNamedAccounts()

  const TBTCSaddleVault = await deployments.get("TBTCSaddleVault")
  if (!helpers.address.isValid(TBTCSaddleVault.address)) {
    throw new Error(
      `Invalid TBTCSaddleVault address: ${TBTCSaddleVault.address}`
    )
  }

  const TBTCSaddlePoolSwap = await deployments.get("TBTCSaddlePoolSwap")
  if (!helpers.address.isValid(TBTCSaddlePoolSwap.address)) {
    throw new Error(
      `Invalid TBTCSaddlePoolSwap address: ${TBTCSaddlePoolSwap.address}`
    )
  }

  const TBTCSaddleLPRewards = await deployments.get("TBTCSaddleLPRewards")
  if (!helpers.address.isValid(TBTCSaddleLPRewards.address)) {
    throw new Error(
      `Invalid TBTCSaddleLPRewards address: ${TBTCSaddleLPRewards.address}`
    )
  }

  log(`tbtcSaddleVault: ${TBTCSaddleVault.address}`)
  log(`tbtcSaddlePoolSwap: ${TBTCSaddlePoolSwap.address}`)
  log(`tbtcSaddleLPRewards: ${TBTCSaddleLPRewards.address}`)

  await deploy("SaddleStrategy", {
    from: deployer,
    args: [
      TBTCSaddleVault.address,
      TBTCSaddlePoolSwap.address,
      TBTCSaddleLPRewards.address,
    ],
    log: true,
    gasLimit: parseInt(process.env.GAS_LIMIT) || undefined,
  })
}

export default func

func.tags = ["SaddleStrategy"]
