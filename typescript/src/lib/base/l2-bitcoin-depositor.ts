import {
  EthersContractConfig,
  EthersContractDeployment,
  EthersContractHandle,
} from "../ethereum/adapter"
import { L2BitcoinDepositor as L2BitcoinDepositorTypechain } from "../../../typechain/L2BitcoinDepositor"
import {
  ChainIdentifier,
  Chains,
  CrossChainExtraDataEncoder,
  DepositReceipt,
  L2BitcoinDepositor,
} from "../contracts"
import {
  EthereumAddress,
  EthereumCrossChainExtraDataEncoder,
  packRevealDepositParameters,
} from "../ethereum"
import { Hex } from "../utils"
import { BitcoinRawTxVectors } from "../bitcoin"

// TODO: Uncomment once Base native minting is available on Base mainnet.
// import BaseL2BitcoinDepositorDeployment from "./artifacts/base/BaseL2BitcoinDepositor.json"
import BaseSepoliaL2BitcoinDepositorDeployment from "./artifacts/baseSepolia/BaseL2BitcoinDepositor.json"

/**
 * Implementation of the Base L2BitcoinDepositor handle.
 * @see {L2BitcoinDepositor} for reference.
 */
export class BaseL2BitcoinDepositor
  extends EthersContractHandle<L2BitcoinDepositorTypechain>
  implements L2BitcoinDepositor
{
  readonly #extraDataEncoder: CrossChainExtraDataEncoder
  #depositOwner: ChainIdentifier | undefined

  constructor(config: EthersContractConfig, chainId: Chains.Base) {
    let deployment: EthersContractDeployment

    switch (chainId) {
      case Chains.Base.BaseSepolia:
        deployment = BaseSepoliaL2BitcoinDepositorDeployment
        break
      // TODO: Uncomment once Base native minting is available on Base mainnet.
      // case Chains.Base.Base:
      //   deployment = BaseL2BitcoinDepositorDeployment
      //   break
      default:
        throw new Error("Unsupported deployment type")
    }

    super(config, deployment)

    this.#extraDataEncoder = new EthereumCrossChainExtraDataEncoder()
  }

  // eslint-disable-next-line valid-jsdoc
  /**
   * @see {L2BitcoinDepositor#getChainIdentifier}
   */
  getChainIdentifier(): ChainIdentifier {
    return EthereumAddress.from(this._instance.address)
  }

  // eslint-disable-next-line valid-jsdoc
  /**
   * @see {L2BitcoinDepositor#getDepositOwner}
   */
  getDepositOwner(): ChainIdentifier | undefined {
    return this.#depositOwner
  }

  // eslint-disable-next-line valid-jsdoc
  /**
   * @see {L2BitcoinDepositor#setDepositOwner}
   */
  setDepositOwner(depositOwner: ChainIdentifier | undefined) {
    this.#depositOwner = depositOwner
  }

  // eslint-disable-next-line valid-jsdoc
  /**
   * @see {L2BitcoinDepositor#extraDataEncoder}
   */
  extraDataEncoder(): CrossChainExtraDataEncoder {
    return this.#extraDataEncoder
  }

  // eslint-disable-next-line valid-jsdoc
  /**
   * @see {L2BitcoinDepositor#initializeDeposit}
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
