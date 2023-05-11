import type { HardhatRuntimeEnvironment } from "hardhat/types"
import type { DeployFunction } from "hardhat-deploy/types"

const func: DeployFunction = async function (hre: HardhatRuntimeEnvironment) {
  const { ethers, getNamedAccounts, helpers, deployments } = hre
  const { deployer } = await getNamedAccounts()

  const OptimismTokenBridge = await deployments.get("OptimismTokenBridge")
  const OptimismWormholeTBTC = await deployments.get("OptimismWormholeTBTC")
  const OptimismTBTC = await deployments.get("OptimismTBTC")

  const [, proxyDeployment] = await helpers.upgrades.upgradeProxy(
    "OptimismWormholeGateway",
    "OptimismWormholeGateway",
    {
      contractName:
        "@keep-network/tbtc-v2/contracts/l2/L2WormholeGateway.sol:L2WormholeGateway",
      initializerArgs: [
        OptimismTokenBridge.address,
        OptimismWormholeTBTC.address,
        OptimismTBTC.address,
      ],
      factoryOpts: { signer: await ethers.getSigner(deployer) },
      proxyOpts: {
        kind: "transparent",
      },
    }
  )

  // Contracts can be verified on L2 Optimism Etherscan in a similar way as we do
  // it on L1 Etherscan
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

func.tags = ["UpgradeOptimismWormholeGateway"]

// Comment this line when running an upgrade.
// yarn deploy --tags UpgradeOptimismWormholeGateway --network <network>
func.skip = async () => true
