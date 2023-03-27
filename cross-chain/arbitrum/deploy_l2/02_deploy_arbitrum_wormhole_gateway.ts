import { smock } from "@defi-wonderland/smock"

import type { HardhatRuntimeEnvironment } from "hardhat/types"
import type { DeployFunction } from "hardhat-deploy/types"
import type { IWormholeTokenBridge, IERC20Upgradeable } from "../typechain"

const func: DeployFunction = async function (hre: HardhatRuntimeEnvironment) {
  const { ethers, getNamedAccounts, helpers, deployments } = hre
  const { log } = deployments
  const { deployer } = await getNamedAccounts()

  const L2TokenBridge = await deployments.getOrNull("TokenBridge") // L2
  const WormholeTBTC = await deployments.getOrNull("WormholeTBTC") // L2
  const ArbitrumTBTC = await deployments.get("ArbitrumTBTC")

  let tokenBridgeAddress = ""
  if (L2TokenBridge && helpers.address.isValid(L2TokenBridge.address)) {
    log(`using existing L2 TokenBridge at ${L2TokenBridge.address}`)
    tokenBridgeAddress = L2TokenBridge.address
  } else {
    // For local development
    const FakeWormholeTokenBridge = await smock.fake<IWormholeTokenBridge>(
      "IWormholeTokenBridge"
    )
    tokenBridgeAddress = FakeWormholeTokenBridge.address
  }

  let wormholeTBTCAddress = ""
  if (WormholeTBTC && helpers.address.isValid(WormholeTBTC.address)) {
    log(`using existing L2 WormholeTBTC at ${WormholeTBTC.address}`)
    wormholeTBTCAddress = WormholeTBTC.address
  } else {
    // For local development
    const TestERC20 = await smock.fake<IERC20Upgradeable>("IERC20Upgradeable")
    wormholeTBTCAddress = TestERC20.address
  }

  const [, proxyDeployment] = await helpers.upgrades.deployProxy(
    "ArbitrumWormholeGateway",
    {
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
      // Implementation contract
      contract: "contracts/ArbitrumWormholeGateway.sol:ArbitrumWormholeGateway",
    })
  }
}

export default func

func.tags = ["ArbitrumWormholeGateway"]
