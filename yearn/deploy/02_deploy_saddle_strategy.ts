import { HardhatRuntimeEnvironment } from "hardhat/types"
import { DeployFunction } from "hardhat-deploy/types"

const func: DeployFunction = async function (hre: HardhatRuntimeEnvironment) {
  const { deployments, getNamedAccounts, helpers } = hre
  const { deploy, log } = deployments
  const { deployer } = await getNamedAccounts()

  const TBTCSaddleVault = await deployments.getOrNull("TBTCSaddleVault")
  if (!TBTCSaddleVault || !helpers.address.isValid(TBTCSaddleVault.address)) {
    throw new Error("Address of TBTCSaddleVault must be set")
  }

  const TBTCSaddlePoolSwap = await deployments.getOrNull("TBTCSaddlePoolSwap")
  if (!TBTCSaddlePoolSwap || !helpers.address.isValid(TBTCSaddlePoolSwap.address)) {
    throw new Error("Address of TBTCSaddlePoolSwap must be set")
  }

  const TBTCSaddleLPRewards = await deployments.getOrNull("TBTCSaddleLPRewards")
  if (!TBTCSaddleLPRewards || !helpers.address.isValid(TBTCSaddleLPRewards.address)) {
    throw new Error("Address of TBTCSaddleLPRewards must be set")
  }

  log(`tbtcSaddleVault: ${TBTCSaddleVault.address}`)
  log(`tbtcSaddlePoolSwap: ${TBTCSaddlePoolSwap.address}`)
  log(`tbtcSaddleLPRewards: ${TBTCSaddleLPRewards.address}`)

  await deploy("SaddleStrategy", {
    from: deployer,
    args: [
      TBTCSaddleVault.address,
      TBTCSaddlePoolSwap.address,
      TBTCSaddleLPRewards.address
    ],
    log: true,
    gasLimit: parseInt(process.env.GAS_LIMIT) || undefined
  })
}

export default func

func.tags = ["SaddleStrategy"]