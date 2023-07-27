import type { HardhatRuntimeEnvironment } from "hardhat/types"
import type { DeployFunction } from "hardhat-deploy/types"

const func: DeployFunction = async function (hre: HardhatRuntimeEnvironment) {
  const { ethers, getNamedAccounts, helpers, deployments } = hre
  const { log } = deployments
  const { deployer } = await getNamedAccounts()

  // These are the fake random addresses for local development purposes only.
  const fakeTokenBridge = "0x0af5DC16568EFF2d480a43A77E6C409e497FcFb9"
  const fakeWormholeTBTC = "0xe1F0b28a3518cCeC430d0d86Ea1725e6256b0296"

  const baseTokenBridge = await deployments.getOrNull("BaseTokenBridge")
  const baseWormholeTBTC = await deployments.getOrNull("BaseWormholeTBTC")

  const baseTBTC = await deployments.get("BaseTBTC")

  let baseTokenBridgeAddress = baseTokenBridge?.address
  if (!baseTokenBridgeAddress && hre.network.name === "hardhat") {
    baseTokenBridgeAddress = fakeTokenBridge
    log(`fake Base TokenBridge address ${baseTokenBridgeAddress}`)
  }

  let baseWormholeTBTCAddress = baseWormholeTBTC?.address
  if (!baseWormholeTBTCAddress && hre.network.name === "hardhat") {
    baseWormholeTBTCAddress = fakeWormholeTBTC
    log(`fake Base WormholeTBTC address ${baseWormholeTBTCAddress}`)
  }

  const [, proxyDeployment] = await helpers.upgrades.deployProxy(
    "BaseWormholeGateway",
    {
      contractName:
        "@keep-network/tbtc-v2/contracts/l2/L2WormholeGateway.sol:L2WormholeGateway",
      initializerArgs: [
        baseTokenBridgeAddress,
        baseWormholeTBTCAddress,
        baseTBTC.address,
      ],
      factoryOpts: { signer: await ethers.getSigner(deployer) },
      proxyOpts: {
        kind: "transparent",
      },
    }
  )

  // TODO: Investigate the possibility of adding Tenderly verification for
  // L2 and upgradable proxy.

  // Contracts can be verified on L2 Base Etherscan in a similar way as we
  // do it on L1 Etherscan
  if (hre.network.tags.basescan) {
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

func.tags = ["BaseWormholeGateway"]
func.dependencies = ["BaseTokenBridge", "BaseWormholeTBTC"]
