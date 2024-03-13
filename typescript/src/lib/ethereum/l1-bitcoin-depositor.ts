import {
  EthersContractConfig,
  EthersContractDeployment,
  EthersContractHandle,
} from "./adapter"
import { L1BitcoinDepositor as L1BitcoinDepositorTypechain } from "../../../typechain/L1BitcoinDepositor"
import {
  ChainIdentifier,
  Chains,
  L1BitcoinDepositor,
  L2Chain,
} from "../contracts"
import { EthereumAddress } from "./index"

// TODO: Uncomment once BaseL1BitcoinDepositor is available on Ethereum mainnet.
// import MainnetBaseL1BitcoinDepositorDeployment from "./artifacts/mainnet/BaseL1BitcoinDepositor.json"
import SepoliaBaseL1BitcoinDepositorDeployment from "./artifacts/sepolia/BaseL1BitcoinDepositor.json"

const artifactLoader = {
  getMainnet: (l2ChainName: L2Chain) => {
    switch (l2ChainName) {
      // TODO: Uncomment once BaseL1BitcoinDepositor is available on Ethereum mainnet.
      // case "Base":
      //   return MainnetBaseL1BitcoinDepositorDeployment
      default:
        throw new Error("Unsupported L2 chain")
    }
  },

  getSepolia: (l2ChainName: L2Chain) => {
    switch (l2ChainName) {
      case "Base":
        return SepoliaBaseL1BitcoinDepositorDeployment
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
  constructor(
    config: EthersContractConfig,
    chainId: Chains.Ethereum,
    l2ChainName: L2Chain
  ) {
    let deployment: EthersContractDeployment

    switch (chainId) {
      case Chains.Ethereum.Sepolia:
        deployment = artifactLoader.getSepolia(l2ChainName)
        break
      case Chains.Ethereum.Mainnet:
        deployment = artifactLoader.getMainnet(l2ChainName)
        break
      default:
        throw new Error("Unsupported deployment type")
    }

    super(config, deployment)
  }

  // eslint-disable-next-line valid-jsdoc
  /**
   * @see {L1BitcoinDepositor#getChainIdentifier}
   */
  getChainIdentifier(): ChainIdentifier {
    return EthereumAddress.from(this._instance.address)
  }
}
