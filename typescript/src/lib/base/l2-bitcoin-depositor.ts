import {
  EthersContractConfig,
  EthersContractDeployment,
  EthersContractHandle,
} from "../ethereum/adapter"
import { L2BitcoinDepositor as L2BitcoinDepositorTypechain } from "../../../typechain/L2BitcoinDepositor"
import { ChainIdentifier, Chains, L2BitcoinDepositor } from "../contracts"
import { EthereumAddress } from "../ethereum"

// TODO: Uncomment once BaseL2BitcoinDepositor is available on Base mainnet.
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
  constructor(config: EthersContractConfig, chainId: Chains.Base) {
    let deployment: EthersContractDeployment

    switch (chainId) {
      case Chains.Base.BaseSepolia:
        deployment = BaseSepoliaL2BitcoinDepositorDeployment
        break
      case Chains.Base.Base:
      // TODO: Uncomment once BaseL2BitcoinDepositor is available on Base mainnet.
      // deployment = BaseL2BitcoinDepositorDeployment
      // break
      default:
        throw new Error("Unsupported deployment type")
    }

    super(config, deployment)
  }

  // eslint-disable-next-line valid-jsdoc
  /**
   * @see {L2BitcoinDepositor#getChainIdentifier}
   */
  getChainIdentifier(): ChainIdentifier {
    return EthereumAddress.from(this._instance.address)
  }
}
