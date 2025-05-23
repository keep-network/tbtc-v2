import {
  EthersContractConfig,
  EthersContractDeployment,
  EthersContractHandle,
} from "./adapter"
import { L1BitcoinDepositor as L1BitcoinDepositorTypechain } from "../../../typechain/L1BitcoinDepositor"
import {
  ChainIdentifier,
  Chains,
  CrossChainExtraDataEncoder as ExtraDataEncoder,
  DepositReceipt,
  DepositState,
  L1BitcoinDepositor,
  DestinationChainName,
} from "../contracts"
import { EthereumAddress, packRevealDepositParameters } from "./index"
import { BitcoinRawTxVectors } from "../bitcoin"
import { Hex } from "../utils"

import MainnetBaseL1BitcoinDepositorDeployment from "./artifacts/mainnet/BaseL1BitcoinDepositor.json"
import MainnetArbitrumL1BitcoinDepositorDeployment from "./artifacts/mainnet/ArbitrumOneL1BitcoinDepositor.json"
// Note: SUI mainnet L1 depositor not yet deployed

import SepoliaBaseL1BitcoinDepositorDeployment from "./artifacts/sepolia/BaseL1BitcoinDepositor.json"
import SepoliaArbitrumL1BitcoinDepositorDeployment from "./artifacts/sepolia/ArbitrumL1BitcoinDepositor.json"
import SepoliaSuiL1BitcoinDepositorDeployment from "./artifacts/sepolia/SuiBTCDepositorWormhole.json"
import { SolanaAddress } from "../solana/address"
import { SuiAddress } from "../sui/address"

const artifactLoader = {
  getMainnet: (destinationChainName: DestinationChainName) => {
    switch (destinationChainName) {
      case "Base":
        return MainnetBaseL1BitcoinDepositorDeployment
      case "Arbitrum":
        return MainnetArbitrumL1BitcoinDepositorDeployment
      case "Sui":
        throw new Error("SUI mainnet L1 depositor not yet deployed")
      default:
        throw new Error("Unsupported L2 chain")
    }
  },

  getSepolia: (destinationChainName: DestinationChainName) => {
    switch (destinationChainName) {
      case "Base":
        return SepoliaBaseL1BitcoinDepositorDeployment
      case "Arbitrum":
        return SepoliaArbitrumL1BitcoinDepositorDeployment
      case "Sui":
        return SepoliaSuiL1BitcoinDepositorDeployment
      default:
        throw new Error("Unsupported L2 chain")
    }
  },
}

/**
 * Implementation of the Ethereum L1BitcoinDepositor handle. It can be
 * constructed for each supported L2 chain.
 * @see {L1BitcoinDepositor} for reference.
 */
export class EthereumL1BitcoinDepositor
  extends EthersContractHandle<L1BitcoinDepositorTypechain>
  implements L1BitcoinDepositor
{
  readonly #extraDataEncoder: CrossChainExtraDataEncoder
  #depositOwner: ChainIdentifier | undefined

  constructor(
    config: EthersContractConfig,
    chainId: Chains.Ethereum,
    destinationChainName: DestinationChainName
  ) {
    let deployment: EthersContractDeployment

    switch (chainId) {
      case Chains.Ethereum.Sepolia:
        deployment = artifactLoader.getSepolia(destinationChainName)
        break
      case Chains.Ethereum.Mainnet:
        deployment = artifactLoader.getMainnet(destinationChainName)
        break
      default:
        throw new Error("Unsupported deployment type")
    }

    super(config, deployment)

    this.#extraDataEncoder = new CrossChainExtraDataEncoder(
      destinationChainName
    )
  }

  // eslint-disable-next-line valid-jsdoc
  /**
   * @see {BitcoinDepositor#getDepositOwner}
   */
  getDepositOwner(): ChainIdentifier | undefined {
    return this.#depositOwner
  }

  // eslint-disable-next-line valid-jsdoc
  /**
   * @see {BitcoinDepositor#setDepositOwner}
   */
  setDepositOwner(depositOwner: ChainIdentifier | undefined): void {
    this.#depositOwner = depositOwner
  }

  // eslint-disable-next-line valid-jsdoc
  /**
   * @see {L1BitcoinDepositor#getDepositState}
   */
  getDepositState(depositId: string): Promise<DepositState> {
    return this._instance.deposits(depositId)
  }

  // eslint-disable-next-line valid-jsdoc
  /**
   * @see {L1BitcoinDepositor#getChainIdentifier}
   */
  getChainIdentifier(): ChainIdentifier {
    return EthereumAddress.from(this._instance.address)
  }

  // eslint-disable-next-line valid-jsdoc
  /**
   * @see {L1BitcoinDepositor#extraDataEncoder}
   */
  extraDataEncoder(): CrossChainExtraDataEncoder {
    return this.#extraDataEncoder
  }

  // eslint-disable-next-line valid-jsdoc
  /**
   * @see {L1BitcoinDepositor#initializeDeposit}
   */
  async initializeDeposit(
    depositTx: BitcoinRawTxVectors,
    depositOutputIndex: number,
    deposit: DepositReceipt,
    vault?: ChainIdentifier
  ): Promise<Hex> {
    const { fundingTx, reveal } = packRevealDepositParameters(
      depositTx,
      depositOutputIndex,
      deposit,
      vault
    )

    if (!deposit.extraData) {
      throw new Error("Extra data is required")
    }

    const l2DepositOwner = this.extraDataEncoder().decodeDepositOwner(
      deposit.extraData
    )

    const tx = await this._instance.initializeDeposit(
      fundingTx,
      reveal,
      `0x${l2DepositOwner.identifierHex}`
    )

    return Hex.from(tx.hash)
  }
}

/**
 * Implementation of the CrossChainExtraDataEncoder
 * that handles both Ethereum (20-byte) and Solana/SUI (32-byte) addresses.
 * It relies on the destination chain context provided during instantiation
 * to differentiate between 32-byte address formats (Solana vs SUI).
 */
export class CrossChainExtraDataEncoder implements ExtraDataEncoder {
  // Store the destination chain name to help decoding
  constructor(private destinationChainName: DestinationChainName) {}

  // eslint-disable-next-line valid-jsdoc
  /**
   * @see {CrossChainExtraDataEncoder#encodeDepositOwner}
   */
  encodeDepositOwner(depositOwner: ChainIdentifier): Hex {
    console.log(
      "[SDK ENCODER DEBUG] encodeDepositOwner called with:",
      depositOwner
    )
    if (!depositOwner || !depositOwner.identifierHex) {
      console.error(
        "[SDK ENCODER ERROR] depositOwner or identifierHex is undefined/null.",
        depositOwner
      )
      // Decide how to handle this - throw error or return a specific Hex representation of an error?
      // Forcing an error to make it obvious if this path is taken.
      throw new Error(
        "depositOwner or identifierHex is invalid in encodeDepositOwner"
      )
    }
    console.log(
      "[SDK ENCODER DEBUG] depositOwner.identifierHex:",
      depositOwner.identifierHex,
      "Type:",
      typeof depositOwner.identifierHex
    )

    const hexInput = depositOwner.identifierHex
    // Hex.from() handles addresses both with and without 0x prefix

    const hexObj = Hex.from(hexInput)
    console.log("[SDK ENCODER DEBUG] Hex.from(identifierHex) created:", hexObj)

    const buffer = hexObj.toBuffer()
    console.log(
      "[SDK ENCODER DEBUG] Buffer from Hex object (length",
      buffer.length,
      "):",
      buffer.toString("hex")
    )

    if (buffer.length === 20) {
      const paddedHex = `000000000000000000000000${hexObj.toString()}`
      console.log(
        "[SDK ENCODER DEBUG] Encoding as 20-byte (padded Ethereum style):",
        paddedHex
      )
      return Hex.from(paddedHex)
    } else if (buffer.length === 32) {
      console.log(
        "[SDK ENCODER DEBUG] Encoding as 32-byte (SUI/Solana style). Buffer hex:",
        Hex.from(buffer).toString()
      )
      return Hex.from(buffer)
    } else {
      console.error(
        `[SDK ENCODER ERROR] Unsupported address length: ${buffer.length} for identifierHex: ${hexInput}`
      )
      throw new Error(`Unsupported address length: ${buffer.length}`)
    }
  }

  // eslint-disable-next-line valid-jsdoc
  /**
   * @see {CrossChainExtraDataEncoder#decodeDepositOwner}
   */
  decodeDepositOwner(extraData: Hex): ChainIdentifier {
    const buffer = extraData.toBuffer()

    if (buffer.length !== 32) {
      throw new Error(`Extra data must be 32 bytes. Got ${buffer.length}.`)
    }

    const isEthereum = buffer.subarray(0, 12).every((b) => b === 0)

    if (isEthereum) {
      const ethAddr = buffer.subarray(12)
      return EthereumAddress.from(Hex.from(ethAddr).toString())
    } else {
      switch (this.destinationChainName) {
        case "Solana":
          return SolanaAddress.from(Hex.from(buffer).toString())
        case "Sui":
          return SuiAddress.from(Hex.from(buffer).toString())
        default:
          throw new Error(
            `Cannot decode 32-byte address for destination chain ${this.destinationChainName}`
          )
      }
    }
  }
}
