import { HardhatRuntimeEnvironment } from "hardhat/types"
import { DeployFunction } from "hardhat-deploy/types"

const func: DeployFunction = async function (hre: HardhatRuntimeEnvironment) {
  const { deployments, getNamedAccounts, helpers } = hre
  const { deploy, log } = deployments
  const { deployer } = await getNamedAccounts()

  const TBTCCurveVault = await deployments.getOrNull("TBTCCurveVault")
  if (!TBTCCurveVault || !helpers.address.isValid(TBTCCurveVault.address)) {
    throw new Error("Address of TBTCCurveVault must be set")
  }

  const TBTCCurvePoolDepositor = await deployments.getOrNull("TBTCCurvePoolDepositor")
  if (!TBTCCurvePoolDepositor || !helpers.address.isValid(TBTCCurvePoolDepositor.address)) {
    throw new Error("Address of TBTCCurvePoolDepositor must be set")
  }

  const TBTCCurvePoolGauge = await deployments.getOrNull("TBTCCurvePoolGauge")
  if (!TBTCCurvePoolGauge || !helpers.address.isValid(TBTCCurvePoolGauge.address)) {
    throw new Error("Address of TBTCCurvePoolGauge must be set")
  }

  const TBTCCurvePoolGaugeReward = await deployments.getOrNull("TBTCCurvePoolGaugeReward")
  if (!TBTCCurvePoolGaugeReward || !helpers.address.isValid(TBTCCurvePoolGaugeReward.address)) {
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