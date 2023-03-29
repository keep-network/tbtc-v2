import type { HardhatRuntimeEnvironment } from "hardhat/types"
import type { DeployFunction } from "hardhat-deploy/types"

const func: DeployFunction = async function (hre: HardhatRuntimeEnvironment) {
  const { ethers, getNamedAccounts, helpers, deployments } = hre
  const { log } = deployments
  const { deployer } = await getNamedAccounts()

  // These are the fake random addresses for local development purposes only.
  const fakeTokenBridge = "0x0af5DC16568EFF2d480a43A77E6C409e497FcFb9"
  const fakeWormholeTBTC = "0xe1F0b28a3518cCeC430d0d86Ea1725e6256b0296"

  const L2TokenBridge = await deployments.getOrNull("TokenBridge") // L2
  const WormholeTBTC = await deployments.getOrNull("WormholeTBTC") // L2
  const ArbitrumTBTC = await deployments.get("ArbitrumTBTC")

  let tokenBridgeAddress = ""
  if (L2TokenBridge && helpers.address.isValid(L2TokenBridge.address)) {
    log(`using existing L2 TokenBridge at ${L2TokenBridge.address}`)
    tokenBridgeAddress = L2TokenBridge.address
  } else {
    log(`using fake L2 TokenBridge at ${fakeTokenBridge}`)
    tokenBridgeAddress = fakeTokenBridge
  }

  let wormholeTBTCAddress = ""
  if (WormholeTBTC && helpers.address.isValid(WormholeTBTC.address)) {
    log(`using existing L2 WormholeTBTC at ${WormholeTBTC.address}`)
    wormholeTBTCAddress = WormholeTBTC.address
  } else {
    log(`using fake L2 WormholeTBTC at ${fakeWormholeTBTC}`)
    wormholeTBTCAddress = fakeWormholeTBTC
  }

  const [, proxyDeployment] = await helpers.upgrades.deployProxy(
    "ArbitrumWormholeGateway",
    {
      contractName: "L2WormholeGateway",
      initializerArgs: [
        tokenBridgeAddress,
        wormholeTBTCAddress,
        ArbitrumTBTC.address,
      ],
      factoryOpts: { signer: await ethers.getSigner(deployer) },
      proxyOpts: {
        kind: "transparent",
      },
    }
  )

  // TODO: Investigate the possibility of adding Tenderly verification for
  // L2 and upgradable proxy.

  // Contracts can be verified on L2 Arbiscan in a similar way as we do it on
  // L1 Etherscan
  if (hre.network.tags.arbiscan) {
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

func.tags = ["ArbitrumWormholeGateway"]
