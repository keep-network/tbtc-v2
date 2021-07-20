import { HardhatRuntimeEnvironment } from "hardhat/types"
import { DeployFunction } from "hardhat-deploy/types"
import { addressFromEnv } from "./helpers"

const func: DeployFunction = async function (hre: HardhatRuntimeEnvironment) {
  const { deployments, getNamedAccounts } = hre
  const { deploy, log } = deployments
  const { deployer } = await getNamedAccounts()

  const tbtcCurveVault = addressFromEnv(
    hre,
    "TBTC_CURVE_VAULT_ADDRESS"
  )
  const tbtcCurvePoolDepositor = addressFromEnv(
    hre,
    "TBTC_CURVE_POOL_DEPOSITOR_ADDRESS"
  )
  const tbtcConvexRewardPoolId = parseInt(process.env.TBTC_CONVEX_REWARD_POOL_ID)

  if (!tbtcConvexRewardPoolId) {
    throw new Error("TBTC_CONVEX_REWARD_POOL_ID must be set")
  }

  log(`tbtcCurveVault: ${tbtcCurveVault}`)
  log(`tbtcCurvePoolDepositor: ${tbtcCurvePoolDepositor}`)
  log(`tbtcConvexRewardPoolId: ${tbtcConvexRewardPoolId}`)

  await deploy("ConvexStrategy", {
    from: deployer,
    args: [
      tbtcCurveVault,
      tbtcCurvePoolDepositor,
      tbtcConvexRewardPoolId
    ],
    log: true,
    gasLimit: parseInt(process.env.GAS_LIMIT) || undefined
  })
}

export default func

func.tags = ["ConvexStrategy"]