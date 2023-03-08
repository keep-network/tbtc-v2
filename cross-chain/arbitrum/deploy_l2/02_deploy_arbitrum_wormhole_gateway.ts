import { smock } from "@defi-wonderland/smock"

import type { HardhatRuntimeEnvironment } from "hardhat/types"
import type { DeployFunction } from "hardhat-deploy/types"
import type { ITokenBridge } from "../typechain/ITokenBridge"

const func: DeployFunction = async function (hre: HardhatRuntimeEnvironment) {
  const { ethers, getNamedAccounts, helpers, deployments } = hre
  const { log } = deployments
  const { deployer } = await getNamedAccounts()

  const L2TokenBridge = await deployments.getOrNull("TokenBridge") // L2
  let tokenBridgeAddress = ""

  if (L2TokenBridge && helpers.address.isValid(L2TokenBridge.address)) {
    log(`using existing L2 TokenBridge at ${L2TokenBridge.address}`)
    tokenBridgeAddress = L2TokenBridge.address
  } else {
    // For local development
    const FakeTokenBridge = await smock.fake<ITokenBridge>("ITokenBridge")
    tokenBridgeAddress = FakeTokenBridge.address
  }

  const [, proxyDeployment] = await helpers.upgrades.deployProxy(
    "ArbitrumWormholeGateway",
    {
      initializerArgs: [tokenBridgeAddress],
      factoryOpts: { signer: await ethers.getSigner(deployer) },
      proxyOpts: {
        kind: "transparent",
      },
    }
  )

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
