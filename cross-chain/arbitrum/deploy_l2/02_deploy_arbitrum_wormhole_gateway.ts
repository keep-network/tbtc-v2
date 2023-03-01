import { smock } from "@defi-wonderland/smock"

import type { HardhatRuntimeEnvironment } from "hardhat/types"
import type { DeployFunction } from "hardhat-deploy/types"
import type { ITokenBridge } from "../typechain/ITokenBridge"

const func: DeployFunction = async function (hre: HardhatRuntimeEnvironment) {
  const { ethers, getNamedAccounts, helpers, deployments } = hre
  const { log } = deployments
  const { deployer } = await getNamedAccounts()

  // const TokenBridge = await hre.companionNetworks['l1'].deployments.get(
  //   'TokenBridge'
  // ); // TokenBridge on L1

  const TokenBridge = await deployments.getOrNull("TokenBridge") // L2
  let tokenBridgeAddress = ""

  if (TokenBridge && helpers.address.isValid(TokenBridge.address)) {
    log(`using existing L2 TokenBridge at ${TokenBridge.address}`)
    tokenBridgeAddress = TokenBridge.address
  } else {
    // For local development
    const FakeTokenBridge = await smock.fake<ITokenBridge>("ITokenBridge")
    tokenBridgeAddress = FakeTokenBridge.address
  }

  const [arbitrumWormholeGateway, proxyDeployment] =
    await helpers.upgrades.deployProxy("ArbitrumWormholeGateway", {
      initializerArgs: [tokenBridgeAddress],
      factoryOpts: { signer: await ethers.getSigner(deployer) },
      proxyOpts: {
        kind: "transparent",
      },
    })

  if (hre.network.tags.etherscan) {
    // We use `verify` instead of `verify:verify` as the `verify` task is defined
    // in "@openzeppelin/hardhat-upgrades" to perform Etherscan verification
    // of Proxy and Implementation contracts.
    await hre.run("verify", {
      address: proxyDeployment.address,
      constructorArgsParams: proxyDeployment.args,
    })
  }

  if (hre.network.tags.tenderly) {
    await hre.tenderly.verify({
      name: "ArbitrumWormholeGateway",
      address: arbitrumWormholeGateway.address,
    })
  }
}

export default func

func.tags = ["ArbitrumWormholeGateway"]
