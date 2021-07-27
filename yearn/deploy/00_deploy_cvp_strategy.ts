import { HardhatRuntimeEnvironment } from "hardhat/types"
import { DeployFunction } from "hardhat-deploy/types"

const func: DeployFunction = async function (hre: HardhatRuntimeEnvironment) {
  const { deployments, getNamedAccounts, helpers } = hre
  const { deploy, log } = deployments
  const { deployer } = await getNamedAccounts()

  const TBTCCurveVault = await deployments.get("TBTCCurveVault")
  if (!helpers.address.isValid(TBTCCurveVault.address)) {
    throw new Error(
      `Invalid TBTCCurveVault address: ${TBTCCurveVault.address}`
    )
  }

  const TBTCCurvePoolDepositor = await deployments.get("TBTCCurvePoolDepositor")
  if (!helpers.address.isValid(TBTCCurvePoolDepositor.address)) {
    throw new Error(
      `Invalid TBTCCurvePoolDepositor address: ${TBTCCurvePoolDepositor.address}`
    )
  }

  const TBTCCurvePoolGauge = await deployments.get("TBTCCurvePoolGauge")
  if (!helpers.address.isValid(TBTCCurvePoolGauge.address)) {
    throw new Error(
      `Invalid TBTCCurvePoolGauge address: ${TBTCCurvePoolGauge.address}`
    )
  }

  const TBTCCurvePoolGaugeReward = await deployments.getOrNull("TBTCCurvePoolGaugeReward")
  if (!TBTCCurvePoolGaugeReward) {
    log(`Deployment TBTCCurvePoolGaugeReward not found - using default address`)

    TBTCCurvePoolGaugeReward.address = "0x0000000000000000000000000000000000000000"
  } else if (!helpers.address.isValid(TBTCCurvePoolGaugeReward.address)) {
    log(
      `Invalid TBTCCurvePoolGaugeReward address: 
      ${TBTCCurvePoolGaugeReward.address} - using default address`
    )

    TBTCCurvePoolGaugeReward.address = "0x0000000000000000000000000000000000000000"
  }

  log(`tbtcCurveVault: ${TBTCCurveVault.address}`)
  log(`tbtcCurvePoolDepositor: ${TBTCCurvePoolDepositor.address}`)
  log(`tbtcCurvePoolGauge: ${TBTCCurvePoolGauge.address}`)
  log(`tbtcCurvePoolGaugeReward: ${TBTCCurvePoolGaugeReward.address}`)

  await deploy("CurveVoterProxyStrategy", {
    from: deployer,
    args: [
      TBTCCurveVault.address,
      TBTCCurvePoolDepositor.address,
      TBTCCurvePoolGauge.address,
      TBTCCurvePoolGaugeReward.address
    ],
    log: true,
    gasLimit: parseInt(process.env.GAS_LIMIT) || undefined
  })
}

export default func

func.tags = ["CurveVoterProxyStrategy"]