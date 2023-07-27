import type { HardhatRuntimeEnvironment } from "hardhat/types"
import type { DeployFunction } from "hardhat-deploy/types"

const func: DeployFunction = async function (hre: HardhatRuntimeEnvironment) {
  const { ethers, getNamedAccounts, helpers, deployments } = hre
  const { deployer } = await getNamedAccounts()

  const BaseTokenBridge = await deployments.get("BaseTokenBridge")
  const BaseWormholeTBTC = await deployments.get("BaseWormholeTBTC")
  const BaseTBTC = await deployments.get("BaseTBTC")

  const [, proxyDeployment] = await helpers.upgrades.upgradeProxy(
    "BaseWormholeGateway",
    "BaseWormholeGateway",
    {
      contractName:
        "@keep-network/tbtc-v2/contracts/l2/L2WormholeGateway.sol:L2WormholeGateway",
      initializerArgs: [
        BaseTokenBridge.address,
        BaseWormholeTBTC.address,
        BaseTBTC.address,
      ],
      factoryOpts: { signer: await ethers.getSigner(deployer) },
      proxyOpts: {
        kind: "transparent",
      },
    }
  )

  // Contracts can be verified on L2 Base Etherscan in a similar way as we do
  // it on L1 Etherscan
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

func.tags = ["UpgradeBaseWormholeGateway"]

// Comment this line when running an upgrade.
// yarn deploy --tags UpgradeBaseWormholeGateway --network <network>
func.skip = async () => true
