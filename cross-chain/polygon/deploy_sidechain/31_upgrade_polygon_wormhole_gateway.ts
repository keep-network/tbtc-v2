import type { HardhatRuntimeEnvironment } from "hardhat/types"
import type { DeployFunction } from "hardhat-deploy/types"

const func: DeployFunction = async function (hre: HardhatRuntimeEnvironment) {
  const { ethers, getNamedAccounts, helpers, deployments } = hre
  const { deployer } = await getNamedAccounts()

  const PolygonTokenBridge = await deployments.get("PolygonTokenBridge")
  const PolygonWormholeTBTC = await deployments.get("PolygonWormholeTBTC")
  const PolygonTBTC = await deployments.get("PolygonTBTC")

  const [, proxyDeployment] = await helpers.upgrades.upgradeProxy(
    "PolygonWormholeGateway",
    "PolygonWormholeGateway",
    {
      contractName:
        "@keep-network/tbtc-v2/contracts/l2/L2WormholeGateway.sol:L2WormholeGateway",
      initializerArgs: [
        PolygonTokenBridge.address,
        PolygonWormholeTBTC.address,
        PolygonTBTC.address,
      ],
      factoryOpts: { signer: await ethers.getSigner(deployer) },
      proxyOpts: {
        kind: "transparent",
      },
    }
  )

  // Contracts can be verified on L2 Polygonscan in a similar way as we do it on
  // L1 Etherscan
  if (hre.network.tags.polygonscan) {
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

func.tags = ["UpgradePolygonWormholeGateway"]

// Comment this line when running an upgrade.
// yarn deploy --tags UpgradePolygonWormholeGateway --network <network>
func.skip = async () => true
