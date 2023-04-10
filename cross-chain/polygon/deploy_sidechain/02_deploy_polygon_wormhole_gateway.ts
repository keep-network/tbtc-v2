import type { HardhatRuntimeEnvironment } from "hardhat/types"
import type { DeployFunction } from "hardhat-deploy/types"

const func: DeployFunction = async function (hre: HardhatRuntimeEnvironment) {
  const { ethers, getNamedAccounts, helpers, deployments } = hre
  const { log } = deployments
  const { deployer } = await getNamedAccounts()

  // These are the fake random addresses for local development purposes only.
  const fakeTokenBridge = "0x0af5DC16568EFF2d480a43A77E6C409e497FcFb9"
  const fakeWormholeTBTC = "0xe1F0b28a3518cCeC430d0d86Ea1725e6256b0296"

  const polygonTokenBridge = await deployments.getOrNull("PolygonTokenBridge")
  const polygonWormholeTBTC = await deployments.getOrNull("PolygonWormholeTBTC")

  const polygonTBTC = await deployments.get("PolygonTBTC")

  let polygonTokenBridgeAddress = polygonTokenBridge?.address
  if (!polygonTokenBridgeAddress && hre.network.name === "hardhat") {
    polygonTokenBridgeAddress = fakeTokenBridge
    log(`fake Polygon TokenBridge address ${polygonTokenBridgeAddress}`)
  }

  let polygonWormholeTBTCAddress = polygonWormholeTBTC?.address
  if (!polygonWormholeTBTCAddress && hre.network.name === "hardhat") {
    polygonWormholeTBTCAddress = fakeWormholeTBTC
    log(`fake Polygon WormholeTBTC address ${polygonWormholeTBTCAddress}`)
  }

  const [, proxyDeployment] = await helpers.upgrades.deployProxy(
    "PolygonWormholeGateway",
    {
      contractName:
        "@keep-network/tbtc-v2/contracts/l2/L2WormholeGateway.sol:L2WormholeGateway",
      initializerArgs: [
        polygonTokenBridgeAddress,
        polygonWormholeTBTCAddress,
        polygonTBTC.address,
      ],
      factoryOpts: { signer: await ethers.getSigner(deployer) },
      proxyOpts: {
        kind: "transparent",
      },
    }
  )

  // TODO: Investigate the possibility of adding Tenderly verification for the
  // sidechain and upgradable proxy.

  // Contracts can be verified on Polygonscan in a similar way as we
  // do it on L1 Etherscan
  if (hre.network.tags.polygonscan) {
    // Polygonscan might not include the recently added proxy transaction right
    // after deployment. We need to wait some time so that transaction is
    // visible on Polygonscan.
    await new Promise((resolve) => setTimeout(resolve, 10000))
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

func.tags = ["PolygonWormholeGateway"]
func.dependencies = ["PolygonTokenBridge", "PolygonWormholeTBTC"]
