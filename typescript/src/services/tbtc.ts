import { DepositsService } from "./deposits"
import { MaintenanceService } from "./maintenance"
import { RedemptionsService } from "./redemptions"
import { TBTCContracts } from "../lib/contracts"
import { BitcoinClient, BitcoinNetwork } from "../lib/bitcoin"
import { EthereumSigner, loadEthereumContracts } from "../lib/ethereum"
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
    const tbtcContracts = await loadEthereumContracts(signer, "mainnet")
    const bitcoinClient = ElectrumClient.fromDefaultConfig(
      BitcoinNetwork.Mainnet
    )
    return new TBTC(tbtcContracts, bitcoinClient)
  }

  /**
   * Initializes the tBTC v2 SDK entrypoint for Ethereum goerli and Bitcoin testnet.
   * The initialized instance uses default Electrum servers to interact
   * with Bitcoin testnet
   * @param signer Ethereum signer.
   * @returns Initialized tBTC v2 SDK entrypoint.
   * @throws Throws an error if the signer's Ethereum network is other than
   *         Ethereum mainnet.
   */
  static async initializeGoerli(signer: EthereumSigner): Promise<TBTC> {
    const tbtcContracts = await loadEthereumContracts(signer, "goerli")
    const bitcoinClient = ElectrumClient.fromDefaultConfig(
      BitcoinNetwork.Testnet
    )
    return new TBTC(tbtcContracts, bitcoinClient)
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
