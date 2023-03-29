import type { HardhatRuntimeEnvironment } from "hardhat/types"
import type { DeployFunction } from "hardhat-deploy/types"

const func: DeployFunction = async function (hre: HardhatRuntimeEnvironment) {
  const { ethers, getNamedAccounts, helpers } = hre
  const { deployer } = await getNamedAccounts()

  const [, proxyDeployment] = await helpers.upgrades.deployProxy(
    "ArbitrumTBTC",
    {
      contractName: "L2TBTC",
      initializerArgs: ["Arbitrum tBTC v2", "tBTC"],
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

func.tags = ["ArbitrumTBTC"]
