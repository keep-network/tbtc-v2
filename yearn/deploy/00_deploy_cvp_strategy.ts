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
  const tbtcCurvePoolGauge = addressFromEnv(
    hre,
    "TBTC_CURVE_POOL_GAUGE_ADDRESS"
  )
  const tbtcCurvePoolGaugeReward = addressFromEnv(
    hre,
    "TBTC_CURVE_POOL_GAUGE_REWARD_ADDRESS",
    false
  )

  log(`tbtcCurveVault: ${tbtcCurveVault}`)
  log(`tbtcCurvePoolDepositor: ${tbtcCurvePoolDepositor}`)
  log(`tbtcCurvePoolGauge: ${tbtcCurvePoolGauge}`)
  log(`tbtcCurvePoolGaugeReward: ${tbtcCurvePoolGaugeReward}`)

  const deployOptions =

  await deploy("CurveVoterProxyStrategy", {
    from: deployer,
    args: [
      tbtcCurveVault,
      tbtcCurvePoolDepositor,
      tbtcCurvePoolGauge,
      tbtcCurvePoolGaugeReward
    ],
    log: true,
    gasLimit: parseInt(process.env.GAS_LIMIT || "0") || undefined
  })
}

export default func

func.tags = ["CurveVoterProxyStrategy"]