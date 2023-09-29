import { TBTCContracts } from "../contracts"
import { providers, Signer } from "ethers"
import { EthereumBridge } from "./bridge"
import { EthereumWalletRegistry } from "./wallet-registry"
import { EthereumTBTCToken } from "./tbtc-token"
import { EthereumTBTCVault } from "./tbtc-vault"

export * from "./address"
export * from "./bridge"
export * from "./tbtc-token"
export * from "./tbtc-vault"
export * from "./wallet-registry"

// The `adapter` module should not be re-exported directly as it
// contains low-level contract integration code. Re-export only components
// that are relevant for `lib/ethereum` clients.
export { EthersContractConfig as EthereumContractConfig } from "./adapter"

/**
 * Represents an Ethereum signer. This type is a wrapper for Ethers-specific
 * types and can be either a Signer that can make write transactions
 * or a Provider that works only in the read-only mode.
 */
export type EthereumSigner = Signer | providers.Provider

/**
 * Resolves the Ethereum network the given Signer is tied to.
 * @param signer The signer whose network should be resolved.
 * @returns Ethereum network.
 */
export async function ethereumNetworkFromSigner(
  signer: EthereumSigner
): Promise<EthereumNetwork> {
  let chainId: number
  if (signer instanceof Signer) {
    chainId = await signer.getChainId()
  } else {
    const network = await signer.getNetwork()
    chainId = network.chainId
  }

  switch (chainId) {
    case 1:
      return "mainnet"
    case 5:
      return "goerli"
    default:
      return "local"
  }
}

/**
 * Supported Ethereum networks.
 */
export type EthereumNetwork = "local" | "goerli" | "mainnet"

/**
 * Loads Ethereum implementation of tBTC contracts for the given Ethereum
 * network and attaches the given signer there.
 * @param signer Signer that should be attached to tBTC contracts.
 * @param network Ethereum network.
 * @returns Handle to tBTC contracts.
 * @throws Throws an error if the signer's Ethereum network is other than
 *         the one used to load tBTC contracts.
 */
export async function loadEthereumContracts(
  signer: EthereumSigner,
  network: EthereumNetwork
): Promise<TBTCContracts> {
  const signerNetwork = await ethereumNetworkFromSigner(signer)
  if (signerNetwork !== network) {
    throw new Error("Signer uses different network than tBTC contracts")
  }

  const bridge = new EthereumBridge({ signerOrProvider: signer }, network)
  const tbtcToken = new EthereumTBTCToken({ signerOrProvider: signer }, network)
  const tbtcVault = new EthereumTBTCVault({ signerOrProvider: signer }, network)
  const walletRegistry = new EthereumWalletRegistry(
    { signerOrProvider: signer },
    "mainnet"
  )

  const bridgeWalletRegistry = await bridge.walletRegistry()
  if (
    !bridgeWalletRegistry
      .getChainIdentifier()
      .equals(walletRegistry.getChainIdentifier())
  ) {
    throw new Error(
      "Wallet registry used by Bridge is different than the one resolved from artifacts"
    )
  }

  return {
    bridge,
    tbtcToken,
    tbtcVault,
    walletRegistry,
  }
}
