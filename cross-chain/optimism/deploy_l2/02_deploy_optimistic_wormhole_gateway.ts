import type { HardhatRuntimeEnvironment } from "hardhat/types"
import type { DeployFunction } from "hardhat-deploy/types"

const func: DeployFunction = async function (hre: HardhatRuntimeEnvironment) {
  const { ethers, getNamedAccounts, helpers, deployments } = hre
  const { log } = deployments
  const { deployer } = await getNamedAccounts()

  // These are the fake random addresses for local development purposes only.
  const fakeTokenBridge = "0x0af5DC16568EFF2d480a43A77E6C409e497FcFb9"
  const fakeWormholeTBTC = "0xe1F0b28a3518cCeC430d0d86Ea1725e6256b0296"

  const optimisticTokenBridge = await deployments.getOrNull(
    "OptimisticTokenBridge"
  )
  const optimisticWormholeTBTC = await deployments.getOrNull(
    "OptimisticWormholeTBTC"
  )

  const optimisticTBTC = await deployments.get("OptimisticTBTC")

  let optimisticTokenBridgeAddress = optimisticTokenBridge?.address
  if (!optimisticTokenBridgeAddress && hre.network.name === "hardhat") {
    optimisticTokenBridgeAddress = fakeTokenBridge
    log(`fake Optimistic TokenBridge address ${optimisticTokenBridgeAddress}`)
  }

  let optimisticWormholeTBTCAddress = optimisticWormholeTBTC?.address
  if (!optimisticWormholeTBTCAddress && hre.network.name === "hardhat") {
    optimisticWormholeTBTCAddress = fakeWormholeTBTC
    log(`fake Optimistic WormholeTBTC address ${optimisticWormholeTBTCAddress}`)
  }

  const [, proxyDeployment] = await helpers.upgrades.deployProxy(
    "OptimisticWormholeGateway",
    {
      contractName:
        "@keep-network/tbtc-v2/contracts/l2/L2WormholeGateway.sol:L2WormholeGateway",
      initializerArgs: [
        optimisticTokenBridgeAddress,
        optimisticWormholeTBTCAddress,
        optimisticTBTC.address,
      ],
      factoryOpts: { signer: await ethers.getSigner(deployer) },
      proxyOpts: {
        kind: "transparent",
      },
    }
  )

  // TODO: Investigate the possibility of adding Tenderly verification for
  // L2 and upgradable proxy.

  // Contracts can be verified on L2 Optimism Etherscan in a similar way as we
  // do it on L1 Etherscan
  if (hre.network.tags.optimism_etherscan) {
    // We use `verify` instead of `verify:verify` as the `verify` task is defined
    // in "@openzeppelin/hardhat-upgrades" to verify the proxy’s implementation
    // contract, the proxy itself and any proxy-related contracts, as well as
    // link the proxy to the implementation contract’s ABI on (Ether)scan.
    await hre.run("verify", {
      address: proxyDeployment.address,
      constructorArgsParams: proxyDeployment.args,
    })
  }
}

export default func

func.tags = ["OptimisticWormholeGateway"]
func.dependencies = ["OptimisticTokenBridge", "OptimisticWormholeTBTC"]
