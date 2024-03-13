import { DepositsService } from "./deposits"
import { MaintenanceService } from "./maintenance"
import { RedemptionsService } from "./redemptions"
import {
  Chains,
  CrossChainContracts,
  CrossChainContractsLoader,
  L2Chain,
  TBTCContracts,
} from "../lib/contracts"
import { BitcoinClient, BitcoinNetwork } from "../lib/bitcoin"
import {
  ethereumAddressFromSigner,
  EthereumSigner,
  ethereumCrossChainContractsLoader,
  loadEthereumCoreContracts,
} from "../lib/ethereum"
import { ElectrumClient } from "../lib/electrum"
import { loadBaseCrossChainContracts } from "../lib/base"

/**
 * Entrypoint component of the tBTC v2 SDK.
 */
export class TBTC {
  /**
   * Service supporting the tBTC v2 deposit flow.
   */
  public readonly deposits: DepositsService
  /**
   * Service supporting authorized operations of tBTC v2 system maintainers
   * and operators.
   */
  public readonly maintenance: MaintenanceService
  /**
   * Service supporting the tBTC v2 redemption flow.
   */
  public readonly redemptions: RedemptionsService
  /**
   * Handle to tBTC contracts for low-level access.
   */
  public readonly tbtcContracts: TBTCContracts
  /**
   * Bitcoin client handle for low-level access.
   */
  public readonly bitcoinClient: BitcoinClient
  /**
   * Reference to the cross-chain contracts loader.
   */
  private readonly crossChainContractsLoader?: CrossChainContractsLoader

  private constructor(
    tbtcContracts: TBTCContracts,
    bitcoinClient: BitcoinClient,
    crossChainContractsLoader?: CrossChainContractsLoader
  ) {
    this.deposits = new DepositsService(tbtcContracts, bitcoinClient)
    this.maintenance = new MaintenanceService(tbtcContracts, bitcoinClient)
    this.redemptions = new RedemptionsService(tbtcContracts, bitcoinClient)
    this.tbtcContracts = tbtcContracts
    this.bitcoinClient = bitcoinClient
    this.crossChainContractsLoader = crossChainContractsLoader
  }

  /**
   * Initializes the tBTC v2 SDK entrypoint for Ethereum and Bitcoin mainnets.
   * The initialized instance uses default Electrum servers to interact
   * with Bitcoin mainnet
   * @param signer Ethereum signer.
   * @returns Initialized tBTC v2 SDK entrypoint.
   * @throws Throws an error if the signer's Ethereum network is other than
   *         Ethereum mainnet.
   */
  static async initializeMainnet(signer: EthereumSigner): Promise<TBTC> {
    return TBTC.initializeEthereum(
      signer,
      Chains.Ethereum.Mainnet,
      BitcoinNetwork.Mainnet
    )
  }

  /**
   * Initializes the tBTC v2 SDK entrypoint for Ethereum Sepolia and Bitcoin testnet.
   * The initialized instance uses default Electrum servers to interact
   * with Bitcoin testnet
   * @param signer Ethereum signer.
   * @returns Initialized tBTC v2 SDK entrypoint.
   * @throws Throws an error if the signer's Ethereum network is other than
   *         Ethereum mainnet.
   */
  static async initializeSepolia(signer: EthereumSigner): Promise<TBTC> {
    return TBTC.initializeEthereum(
      signer,
      Chains.Ethereum.Sepolia,
      BitcoinNetwork.Testnet
    )
  }

  /**
   * Initializes the tBTC v2 SDK entrypoint for the given Ethereum network and Bitcoin network.
   * The initialized instance uses default Electrum servers to interact
   * with Bitcoin network.
   * @param signer Ethereum signer.
   * @param ethereumChainId Ethereum chain ID.
   * @param bitcoinNetwork Bitcoin network.
   * @returns Initialized tBTC v2 SDK entrypoint.
   * @throws Throws an error if the underlying signer's Ethereum network is
   *         other than the given Ethereum network.
   */
  private static async initializeEthereum(
    signer: EthereumSigner,
    ethereumChainId: Chains.Ethereum,
    bitcoinNetwork: BitcoinNetwork
  ): Promise<TBTC> {
    const signerAddress = await ethereumAddressFromSigner(signer)
    const tbtcContracts = await loadEthereumCoreContracts(
      signer,
      ethereumChainId
    )
    const crossChainContractsLoader = await ethereumCrossChainContractsLoader(
      signer,
      ethereumChainId
    )

    const bitcoinClient = ElectrumClient.fromDefaultConfig(bitcoinNetwork)

    const tbtc = new TBTC(
      tbtcContracts,
      bitcoinClient,
      crossChainContractsLoader
    )

    // If signer address can be resolved, set it as default depositor.
    if (signerAddress !== undefined) {
      tbtc.deposits.setDefaultDepositor(signerAddress)
    }

    return tbtc
  }

  /**
   * Initializes the tBTC v2 SDK entrypoint with custom tBTC contracts and
   * Bitcoin client.
   * @param tbtcContracts Custom tBTC contracts handle.
   * @param bitcoinClient Custom Bitcoin client implementation.
   * @returns Initialized tBTC v2 SDK entrypoint.
   * @dev This function is especially useful for local development as it gives
   *      flexibility to combine different implementations of tBTC v2 contracts
   *      with different Bitcoin networks.
   */
  static async initializeCustom(
    tbtcContracts: TBTCContracts,
    bitcoinClient: BitcoinClient
  ): Promise<TBTC> {
    return new TBTC(tbtcContracts, bitcoinClient)
  }

  /**
   * Returns cross-chain contracts for the given L2 chain.
   * @param l2ChainName Name of the L2 chain for which to load cross-chain contracts.
   * @param l2Signer Signer for the L2 chain contracts.
   * @returns Cross-chain contracts for the given L2 chain.
   * @throws Throws an error if:
   *         - Cross-chain contracts loader is not available for this TBTC SDK instance,
   *         - Chain mapping between L1 and L2 chains is not defined.
   * @dev In case this function needs to support non-EVM L2 chains that can't
   *      use EthereumSigner as a signer type, the l2Signer parameter should
   *      probably be turned into a union of multiple supported types or
   *      generalized in some other way.
   */
  async crossChainContracts(
    l2ChainName: L2Chain,
    l2Signer: EthereumSigner
  ): Promise<CrossChainContracts> {
    if (!this.crossChainContractsLoader) {
      throw new Error(
        "Cross-chain contracts loader not available for this instance"
      )
    }

    const chainMapping = this.crossChainContractsLoader.loadChainMapping()
    if (!chainMapping) {
      throw new Error("Chain mapping between L1 and L2 chains not defined")
    }

    const L1CrossChainContracts =
      await this.crossChainContractsLoader.loadL1Contracts(l2ChainName)

    switch (l2ChainName) {
      case "Base":
        const baseChainId = chainMapping.base
        if (!baseChainId) {
          throw new Error("Base chain ID not available in chain mapping")
        }

        return {
          ...L1CrossChainContracts,
          ...(await loadBaseCrossChainContracts(l2Signer, baseChainId)),
        }
      default:
        throw new Error("Unsupported L2 chain")
    }
  }
}
