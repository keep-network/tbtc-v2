import { DepositsService } from "./deposits"
import { MaintenanceService } from "./maintenance"
import { RedemptionsService } from "./redemptions"
import {
  Chains,
  CrossChainInterfaces,
  CrossChainContractsLoader,
  L1CrossChainContracts,
  DestinationChainName,
  TBTCContracts,
  DestinationChainInterfaces,
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
import { loadArbitrumCrossChainContracts } from "../lib/arbitrum"
import { providers } from "ethers"
// import { loadSolanaCrossChainPrograms } from "../lib/solana"
// import { AnchorProvider } from "@coral-xyz/anchor"
import { SuiClient } from "@mysten/sui/client"
import { loadSuiDestinationChainContracts } from "../lib/sui"
import type { Signer as SuiSigner } from "@mysten/sui/cryptography"
import { BigNumber } from "ethers"
import { ChainIdentifier } from "../lib/contracts/chain-identifier"
import { Hex } from "../lib/utils"
import { CrossChainExtraDataEncoder } from "../lib/ethereum/l1-bitcoin-depositor"
import { SuiAddress } from "../lib/sui/address"
import { SuiBitcoinDepositor } from "../lib/sui/sui-bitcoin-depositor"

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
  readonly #crossChainContractsLoader?: CrossChainContractsLoader
  /**
   * Mapping of cross-chain contracts for different supported L2 chains.
   * Each set of cross-chain contracts must be first initialized using
   * the `initializeCrossChain` method.
   */
  readonly #crossChainContracts: Map<DestinationChainName, CrossChainInterfaces>

  /**
   * Flag to track if SUI signer is available.
   * @private
   */
  private hasSuiSigner: boolean = false

  /**
   * Store SUI client for later use
   * @private
   */
  private suiClient?: SuiClient

  /**
   * Store SUI signer for later use
   * @private
   */
  private suiSigner?: SuiSigner

  private constructor(
    tbtcContracts: TBTCContracts,
    bitcoinClient: BitcoinClient,
    crossChainContractsLoader?: CrossChainContractsLoader
  ) {
    this.deposits = new DepositsService(
      tbtcContracts,
      bitcoinClient,
      (destinationChainName) => this.crossChainContracts(destinationChainName)
    )
    this.maintenance = new MaintenanceService(tbtcContracts, bitcoinClient)
    this.redemptions = new RedemptionsService(tbtcContracts, bitcoinClient)
    this.tbtcContracts = tbtcContracts
    this.bitcoinClient = bitcoinClient
    this.#crossChainContractsLoader = crossChainContractsLoader
    this.#crossChainContracts = new Map<
      DestinationChainName,
      CrossChainInterfaces
    >()
  }

  /**
   * Initializes the tBTC v2 SDK entrypoint for Ethereum and Bitcoin mainnets.
   * The initialized instance uses default Electrum servers to interact
   * with Bitcoin mainnet
   * @param ethereumSignerOrProvider Ethereum signer or provider.
   * @param crossChainSupport Whether to enable cross-chain support. False by default.
   * @returns Initialized tBTC v2 SDK entrypoint.
   * @throws Throws an error if the signer's Ethereum network is other than
   *         Ethereum mainnet.
   */
  static async initializeMainnet(
    ethereumSignerOrProvider: EthereumSigner | providers.Provider,
    crossChainSupport: boolean = false
  ): Promise<TBTC> {
    return TBTC.initializeEthereum(
      ethereumSignerOrProvider,
      Chains.Ethereum.Mainnet,
      BitcoinNetwork.Mainnet,
      crossChainSupport
    )
  }

  /**
   * Initializes the tBTC v2 SDK entrypoint for Ethereum Sepolia and Bitcoin testnet.
   * The initialized instance uses default Electrum servers to interact
   * with Bitcoin testnet
   * @param ethereumSignerOrProvider Ethereum signer or provider.
   * @param crossChainSupport Whether to enable cross-chain support. False by default.
   * @returns Initialized tBTC v2 SDK entrypoint.
   * @throws Throws an error if the signer's Ethereum network is other than
   *         Ethereum mainnet.
   */
  static async initializeSepolia(
    ethereumSignerOrProvider: EthereumSigner | providers.Provider,
    crossChainSupport: boolean = false
  ): Promise<TBTC> {
    return TBTC.initializeEthereum(
      ethereumSignerOrProvider,
      Chains.Ethereum.Sepolia,
      BitcoinNetwork.Testnet,
      crossChainSupport
    )
  }

  /**
   * Initializes the tBTC v2 SDK entrypoint for the given Ethereum network and Bitcoin network.
   * The initialized instance uses default Electrum servers to interact
   * with Bitcoin network.
   * @param ethereumSignerOrProvider Ethereum signer or provider.
   * @param ethereumChainId Ethereum chain ID.
   * @param bitcoinNetwork Bitcoin network.
   * @param crossChainSupport Whether to enable cross-chain support. False by default.
   * @returns Initialized tBTC v2 SDK entrypoint.
   * @throws Throws an error if the underlying signer's Ethereum network is
   *         other than the given Ethereum network.
   */
  private static async initializeEthereum(
    ethereumSignerOrProvider: EthereumSigner | providers.Provider,
    ethereumChainId: Chains.Ethereum,
    bitcoinNetwork: BitcoinNetwork,
    crossChainSupport = false
  ): Promise<TBTC> {
    const signerAddress = await ethereumAddressFromSigner(
      ethereumSignerOrProvider
    )
    const tbtcContracts = await loadEthereumCoreContracts(
      ethereumSignerOrProvider,
      ethereumChainId
    )

    let crossChainContractsLoader: CrossChainContractsLoader | undefined =
      undefined
    if (crossChainSupport) {
      crossChainContractsLoader = await ethereumCrossChainContractsLoader(
        ethereumSignerOrProvider,
        ethereumChainId
      )
    }

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
   * Sets the SUI signer to be used for cross-chain operations.
   * This allows setting or updating the signer after initialization.
   *
   * @param signer The SUI signer to use for transactions.
   * @param suiAddressString The SUI address string of the connected account (optional).
   * @returns Void - This function doesn't return a value
   */
  setSuiSigner(signer: SuiSigner, suiAddressString?: string): void {
    this.suiSigner = signer
    this.hasSuiSigner = true
    console.log(
      `[SDK CORE] setSuiSigner called. Signer set. Address received: ${suiAddressString}`
    )

    const existingSuiContracts = this.#crossChainContracts.get("Sui")
    if (existingSuiContracts && this.suiClient) {
      console.log(
        "[SDK CORE] Existing SUI contracts and suiClient found, proceeding to update L2 contracts."
      )
      const isTestnet = true // Or determine dynamically if mainnet support is added

      const newL2SuiContracts = loadSuiDestinationChainContracts(
        this.suiClient,
        signer,
        isTestnet
      )
      console.log("[SDK CORE] New SUI L2 contracts loaded with new signer.")

      if (
        suiAddressString &&
        newL2SuiContracts.destinationChainBitcoinDepositor &&
        typeof (
          newL2SuiContracts.destinationChainBitcoinDepositor as SuiBitcoinDepositor
        ).setDepositOwner === "function"
      ) {
        try {
          const suiOwnerAddress = SuiAddress.from(suiAddressString)
          ;(
            newL2SuiContracts.destinationChainBitcoinDepositor as SuiBitcoinDepositor
          ).setDepositOwner(suiOwnerAddress)
          console.log(
            `[SDK CORE] SuiBitcoinDepositor owner successfully set to: ${suiAddressString}`
          )
        } catch (e) {
          console.error(
            `[SDK CORE] Failed to create SuiAddress from string or set owner on SuiBitcoinDepositor: ${suiAddressString}`,
            e
          )
        }
      } else if (!suiAddressString) {
        console.warn(
          "[SDK CORE] SUI signer set, but no SUI address string provided to set deposit owner in SuiBitcoinDepositor."
        )
      } else {
        console.warn(
          "[SDK CORE] SuiBitcoinDepositor on newL2SuiContracts does not have setDepositOwner or is not the expected type."
        )
      }

      this.#crossChainContracts.set("Sui", {
        ...existingSuiContracts, // Keeps L1 contracts
        destinationChainBitcoinDepositor:
          newL2SuiContracts.destinationChainBitcoinDepositor,
        destinationChainTbtcToken: newL2SuiContracts.destinationChainTbtcToken,
      })
      console.log(
        "[SDK CORE] SUI L2 contracts updated in map with new signer and owner info."
      )
    } else {
      console.warn(
        "[SDK CORE] setSuiSigner called but no existingSuiContracts or this.suiClient found. This might be an issue if called too early or SUI not initialized."
      )
    }
  }

  /**
   * Initializes cross-chain contracts for the given L2 chain, using the
   * given signer. Updates the signer on subsequent calls.
   *
   * @experimental THIS IS EXPERIMENTAL CODE THAT CAN BE CHANGED OR REMOVED
   *               IN FUTURE RELEASES. IT SHOULD BE USED ONLY FOR INTERNAL
   *               PURPOSES AND EXTERNAL APPLICATIONS SHOULD NOT DEPEND ON IT.
   *               CROSS-CHAIN SUPPORT IS NOT FULLY OPERATIONAL YET.
   *
   * @param destinationChainName Name of the L2 chain for which to initialize
   *                    cross-chain contracts.
   * @param ethereumChainSigner Signer to use with the L2 chain contracts.
   * @param solanaProvider Provider of Solana that contains connection and signer.
   * @param suiClient Client to interact with the SUI network.
   * @param suiSigner Signer for SUI transactions.
   * @returns Void promise.
   * @throws Throws an error if:
   *         - Cross-chain contracts loader is not available for this TBTC SDK instance,
   *         - Chain mapping between the L1 and the given L2 chain is not defined.
   * @dev In case this function needs to support non-EVM L2 chains that can't
   *      use EthereumSigner as a signer type, the l2Signer parameter should
   *      probably be turned into a union of multiple supported types or
   *      generalized in some other way.
   */
  async initializeCrossChain(
    destinationChainName: DestinationChainName,
    ethereumChainSigner: EthereumSigner,
    solanaProvider?: any, // Changed from AnchorProvider
    suiClient?: SuiClient,
    suiSigner?: SuiSigner // Made optional
  ): Promise<void> {
    if (!this.#crossChainContractsLoader) {
      throw new Error(
        "L1 Cross-chain contracts loader not available for this instance"
      )
    }

    const chainMapping = this.#crossChainContractsLoader.loadChainMapping()
    if (!chainMapping) {
      throw new Error(
        "Chain mapping between Ethereum L1 and destination chains not defined"
      )
    }

    let l1CrossChainInterfaces: L1CrossChainContracts
    let destinationChainInterfaces: DestinationChainInterfaces

    switch (destinationChainName) {
      case "Base":
        const baseChainId = chainMapping.base
        if (!baseChainId) {
          throw new Error("Base chain ID not available in chain mapping")
        }
        l1CrossChainInterfaces =
          await this.#crossChainContractsLoader.loadL1Contracts(
            destinationChainName
          )

        destinationChainInterfaces = await loadBaseCrossChainContracts(
          ethereumChainSigner,
          baseChainId
        )
        break
      case "Arbitrum":
        const arbitrumChainId = chainMapping.arbitrum
        if (!arbitrumChainId) {
          throw new Error("Arbitrum chain ID not available in chain mapping")
        }
        l1CrossChainInterfaces =
          await this.#crossChainContractsLoader.loadL1Contracts(
            destinationChainName
          )

        destinationChainInterfaces = await loadArbitrumCrossChainContracts(
          ethereumChainSigner,
          arbitrumChainId
        )
        break
      case "Solana":
        if (!solanaProvider) {
          throw new Error("Solana provider is not defined")
        }

        const genesisHash = chainMapping.solana
        if (!genesisHash) {
          throw new Error("Solana chain not available in chain mapping")
        }
        l1CrossChainInterfaces =
          await this.#crossChainContractsLoader.loadL1Contracts(
            destinationChainName
          )

        // Comment out actual Solana integration and use mock
        // destinationChainInterfaces = await loadSolanaCrossChainPrograms(
        //   solanaProvider,
        //   genesisHash
        // )

        // Create a mock ChainIdentifier that implements the required interface
        const mockChainIdentifier: ChainIdentifier = {
          identifierHex: "mock",
          equals: (other: ChainIdentifier) => other.identifierHex === "mock",
        }

        // Use a mock implementation instead
        destinationChainInterfaces = {
          destinationChainBitcoinDepositor: {
            getChainIdentifier: () => mockChainIdentifier,
            getDepositOwner: () => undefined,
            setDepositOwner: () => {},
            extraDataEncoder: () => new CrossChainExtraDataEncoder("Solana"),
            initializeDeposit: async (
              _depositTx,
              _depositOutputIndex,
              _deposit,
              _vault
            ) => Hex.from("0x"),
          },
          destinationChainTbtcToken: {
            getChainIdentifier: () => mockChainIdentifier,
            balanceOf: async () => BigNumber.from(0),
          },
        }

        break
      case "Sui":
        if (!suiClient) {
          throw new Error("SUI client is not defined")
        }
        // console.log("[SDK CORE DEBUG] Case SUI in initializeCrossChain. suiClient provided.");

        this.suiClient = suiClient
        if (suiSigner) {
          // console.log("[SDK CORE DEBUG] SUI signer provided to initializeCrossChain.");
          this.suiSigner = suiSigner
          this.hasSuiSigner = true
        } else {
          // console.log("[SDK CORE DEBUG] SUI signer NOT provided to initializeCrossChain.");
        }

        const suiChainId = chainMapping.sui
        if (!suiChainId) {
          throw new Error("SUI chain ID not available in chain mapping")
        }

        l1CrossChainInterfaces =
          await this.#crossChainContractsLoader!.loadL1Contracts(
            destinationChainName
          )

        if (this.hasSuiSigner && this.suiSigner) {
          // console.log("[SDK CORE DEBUG] Has SUI signer, loading SUI destination contracts.");
          const isTestnet = true
          destinationChainInterfaces = loadSuiDestinationChainContracts(
            suiClient,
            this.suiSigner,
            isTestnet
          )
        } else {
          // console.log("[SDK CORE DEBUG] No SUI signer, creating mock SUI destination interfaces.");
          const mockChainIdentifier: ChainIdentifier = {
            identifierHex: "sui-mock",
            equals: (other: ChainIdentifier) =>
              other.identifierHex === "sui-mock",
          }
          destinationChainInterfaces = {
            destinationChainBitcoinDepositor: {
              getChainIdentifier: () => mockChainIdentifier,
              getDepositOwner: () => undefined,
              setDepositOwner: () => {},
              extraDataEncoder: () => new CrossChainExtraDataEncoder("Sui"),
              initializeDeposit: async (
                _depositTx,
                _depositOutputIndex,
                _deposit,
                _vault
              ) => {
                throw new Error(
                  "SUI wallet connection required to initialize deposit on SUI network. " +
                    "Please connect your SUI wallet before proceeding."
                )
              },
            },
            destinationChainTbtcToken: {
              getChainIdentifier: () => mockChainIdentifier,
              balanceOf: async () => BigNumber.from(0),
            },
          }
        }
        break
      default:
        throw new Error("Unsupported destination chain")
    }

    const keyToSet = destinationChainName
    // console.log(`[SDK CORE DEBUG] ABOUT TO SET in #crossChainContracts: Key='${keyToSet}', Type='${typeof keyToSet}'`);
    this.#crossChainContracts.set(keyToSet, {
      ...l1CrossChainInterfaces,
      ...destinationChainInterfaces,
    })
    // console.log(`[SDK CORE DEBUG] Value from map immediately after set for key '${keyToSet}':`, this.#crossChainContracts.get(keyToSet));
  }

  /**
   * Gets cross-chain contracts for the given supported L2 chain.
   * The given destination chain contracts must be first initialized using the
   * `initializeCrossChain` method.
   *
   * @experimental THIS IS EXPERIMENTAL CODE THAT CAN BE CHANGED OR REMOVED
   *               IN FUTURE RELEASES. IT SHOULD BE USED ONLY FOR INTERNAL
   *               PURPOSES AND EXTERNAL APPLICATIONS SHOULD NOT DEPEND ON IT.
   *               CROSS-CHAIN SUPPORT IS NOT FULLY OPERATIONAL YET.
   *
   * @param destinationChainName Name of the destination chain for which to get cross-chain contracts.
   * @returns Cross-chain contracts for the given L2 chain or
   *          undefined if not initialized.
   */
  crossChainContracts(
    destinationChainName: DestinationChainName
  ): CrossChainInterfaces | undefined {
    // console.log(`[SDK CORE DEBUG] crossChainContracts method called. Original Key to get: '${destinationChainName}'`);

    let effectiveKey = destinationChainName
    if (
      typeof destinationChainName === "string" &&
      destinationChainName.toLowerCase() === "sui"
    ) {
      effectiveKey = "Sui" as DestinationChainName
      // console.log(`[SDK CORE DEBUG] Key normalized for SUI access to: '${effectiveKey}'`);
    }
    // console.log("[SDK CORE DEBUG] Current state of this.#crossChainContracts map:",this.#crossChainContracts);

    const contracts = this.#crossChainContracts.get(effectiveKey)
    // console.log(`[SDK CORE DEBUG] Value returned by .get('${effectiveKey}') was:`, contracts);
    return contracts
  }
}
