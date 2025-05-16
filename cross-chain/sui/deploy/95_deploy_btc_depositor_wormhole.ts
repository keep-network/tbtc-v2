import { HardhatRuntimeEnvironment } from "hardhat/types"
import { DeployFunction } from "hardhat-deploy/types"
// import { base58 } from "ethers/lib/utils" // Not needed if gateway is already bytes32 hex

// TODO: Replace with actual addresses or a configuration mechanism for your target L1 testnet (e.g., Sepolia)
const TBTC_BRIDGE_ADDRESS = "0x9b1a7fE5a16A15F2f9475C5B231750598b113403" // Official Threshold Sepolia Bridge
const TBTC_VAULT_ADDRESS = "0xB5679dE944A79732A75CE556191DF11F489448d5" // Official Threshold Sepolia TBTCVault
const WORMHOLE_CORE_ADDRESS = "0x4a8bc80Ed5a4067f1CCf107057b8270E0cC11A78" // Official Wormhole Sepolia Core Contract
const WORMHOLE_TOKEN_BRIDGE_ADDRESS =
  "0xDB5492265f6038831E89f495670FF909aDe94bd9" // Official Wormhole Sepolia Token Bridge

// TODO: Replace with the ACTUAL tBTC Wormhole Gateway address on SUI TESTNET as a bytes32 hex string.
// This address must be a 32-byte hex string (e.g., "0x" followed by 64 hex characters).
// If the native Sui address is shorter, it needs to be left-padded with zeros to 32 bytes.
const DESTINATION_CHAIN_WORMHOLE_GATEWAY_SUI_TESTNET =
  "0x1db1fcdaada7c286d77f3347e593e06d8f33b8255e0861033a0a9f321f4eade7" // Sui Testnet Gateway address

const DESTINATION_CHAIN_ID = 21 // Sui Testnet Wormhole Chain ID (also same for Mainnet)

const func: DeployFunction = async function (hre: HardhatRuntimeEnvironment) {
  const { ethers, helpers, deployments, getNamedAccounts } = hre
  const { deployer } = await getNamedAccounts()

  console.log("Deploying BTCDepositorWormhole for Sui Testnet...")
  console.log(`Deployer address (L1 Testnet): ${deployer}`)

  // The gateway address is now expected to be a direct bytes32 hex string.
  const wormholeGatewayBytes32 = DESTINATION_CHAIN_WORMHOLE_GATEWAY_SUI_TESTNET

  console.log(
    `Using Wormhole Gateway for Sui Testnet (bytes32): ${wormholeGatewayBytes32}`
  )
  console.log(
    `Using Wormhole Destination Chain ID for Sui Testnet: ${DESTINATION_CHAIN_ID}`
  )

  const [btcDepositorWormholeDeployment, proxyDeployment] =
    await helpers.upgrades.deployProxy(
      "BTCDepositorWormhole", // Name of the contract to deploy
      {
        contractName: "BTCDepositorWormhole", // Specifies the contract name for the proxy
        initializerArgs: [
          TBTC_BRIDGE_ADDRESS,
          TBTC_VAULT_ADDRESS,
          WORMHOLE_CORE_ADDRESS,
          WORMHOLE_TOKEN_BRIDGE_ADDRESS,
          wormholeGatewayBytes32, // This is DESTINATION_CHAIN_WORMHOLE_GATEWAY_SUI_TESTNET
          DESTINATION_CHAIN_ID,
        ],
        factoryOpts: {
          signer: await ethers.getSigner(deployer),
        },
        proxyOpts: {
          kind: "transparent",
          // Allow external libraries linking. We need to ensure manually that the
          // external libraries we link are upgrade safe, as the OpenZeppelin plugin
          // doesn't perform such a validation yet.
          // See: https://docs.openzeppelin.com/upgrades-plugins/1.x/faq#why-cant-i-use-external-libraries
          unsafeAllow: ["external-library-linking"],
        },
      }
    )

  const btcDepositorWormhole = btcDepositorWormholeDeployment // The main contract instance

  console.log(
    `BTCDepositorWormhole (logic) deployed to: ${await btcDepositorWormhole.address}`
  )
  console.log(
    `BTCDepositorWormholeProxy deployed to: ${proxyDeployment.address}`
  )
  console.log(
    `BTCDepositorWormhole implementation (logic contract for proxy) deployed to: ${await hre.upgrades.erc1967.getImplementationAddress(
      proxyDeployment.address
    )}`
  )

  // Verify the Proxy contract
  // Note: Verification of the implementation is often handled automatically by plugins
  // or done separately if needed, especially for complex proxy setups.
  // The `args` for proxy verification usually point to the implementation's constructor args if any,
  // or are specific to the proxy contract itself.
  // For OpenZeppelin proxies, the proxy itself doesn't have constructor args in the traditional sense for verification directly.
  // We verify the proxy address, and tools usually figure out the implementation.
  if (
    hre.network.name !== "hardhat" &&
    hre.network.name !== "localhost" &&
    proxyDeployment.args
  ) {
    try {
      console.log("Verifying BTCDepositorWormholeProxy...")
      await hre.run("verify:verify", {
        address: proxyDeployment.address,
        // constructorArguments: proxyDeployment.args, // OpenZeppelin proxies might not need this or might need specific handling
        // For UUPS proxies, you verify the implementation and it links to the proxy.
        // For Transparent proxies, you verify the proxy, and it delegates to an implementation.
        // The hardhat-deploy `verify` task usually handles this well.
        // If `proxyDeployment.args` is undefined or causes issues, it might be removed or adjusted.
      })
      console.log("Proxy contract verification successful.")
    } catch (error) {
      console.error("Proxy contract verification failed:", error)
    }
  }

  if (hre.network.tags.tenderly) {
    console.log("Verifying BTCDepositorWormhole implementation on Tenderly...")
    await hre.tenderly.verify({
      name: "BTCDepositorWormhole", // The name of the implementation contract
      address: await hre.upgrades.erc1967.getImplementationAddress(
        proxyDeployment.address
      ),
    })
    console.log("Tenderly verification successful.")
  }
}

export default func

func.tags = ["BTCDepositorWormhole"]
// It's good practice to add dependencies if this deploy script depends on others
// func.dependencies = ["OtherDeployScript"];
