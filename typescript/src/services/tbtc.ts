import { DepositsService } from "./deposits"
import { MaintenanceService } from "./maintenance"
import { RedemptionsService } from "./redemptions"
import { TBTCContracts } from "../lib/contracts"
import { BitcoinClient, BitcoinNetwork } from "../lib/bitcoin"
import {
  ethereumAddressFromSigner,
  EthereumNetwork,
  EthereumSigner,
  loadEthereumContracts,
} from "../lib/ethereum"
import { ElectrumClient } from "../lib/electrum"

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

  private constructor(
    tbtcContracts: TBTCContracts,
    bitcoinClient: BitcoinClient
  ) {
    this.deposits = new DepositsService(tbtcContracts, bitcoinClient)
    this.maintenance = new MaintenanceService(tbtcContracts, bitcoinClient)
    this.redemptions = new RedemptionsService(tbtcContracts, bitcoinClient)
    this.tbtcContracts = tbtcContracts
    this.bitcoinClient = bitcoinClient
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
    return TBTC.initializeEthereum(signer, "mainnet", BitcoinNetwork.Mainnet)
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
    return TBTC.initializeEthereum(signer, "sepolia", BitcoinNetwork.Testnet)
  }

  /**
   * Initializes the tBTC v2 SDK entrypoint for the given Ethereum network and Bitcoin network.
   * The initialized instance uses default Electrum servers to interact
   * with Bitcoin network.
   * @param signer Ethereum signer.
   * @param ethereumNetwork Ethereum network.
   * @param bitcoinNetwork Bitcoin network.
   * @returns Initialized tBTC v2 SDK entrypoint.
   * @throws Throws an error if the underlying signer's Ethereum network is
   *         other than the given Ethereum network.
   */
  private static async initializeEthereum(
    signer: EthereumSigner,
    ethereumNetwork: EthereumNetwork,
    bitcoinNetwork: BitcoinNetwork
  ): Promise<TBTC> {
    const signerAddress = await ethereumAddressFromSigner(signer)
    const tbtcContracts = await loadEthereumContracts(signer, ethereumNetwork)
    const bitcoinClient = ElectrumClient.fromDefaultConfig(bitcoinNetwork)

    const tbtc = new TBTC(tbtcContracts, bitcoinClient)

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
}
