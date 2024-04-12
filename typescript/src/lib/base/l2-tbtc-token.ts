import {
  EthersContractConfig,
  EthersContractDeployment,
  EthersContractHandle,
} from "../ethereum/adapter"
import { L2TBTC as L2TBTCTypechain } from "../../../typechain/L2TBTC"
import { ChainIdentifier, Chains, L2TBTCToken } from "../contracts"
import { BigNumber } from "ethers"
import { EthereumAddress } from "../ethereum"

// TODO: Uncomment once Base native minting is available on Base mainnet.
// import BaseL2TBTCTokenDeployment from "./artifacts/base/BaseTBTC.json"
import BaseSepoliaL2TBTCTokenDeployment from "./artifacts/baseSepolia/BaseTBTC.json"

/**
 * Implementation of the Base L2TBTCToken handle.
 * @see {L2TBTCToken} for reference.
 */
export class BaseL2TBTCToken
  extends EthersContractHandle<L2TBTCTypechain>
  implements L2TBTCToken
{
  constructor(config: EthersContractConfig, chainId: Chains.Base) {
    let deployment: EthersContractDeployment

    switch (chainId) {
      case Chains.Base.BaseSepolia:
        deployment = BaseSepoliaL2TBTCTokenDeployment
        break
      // TODO: Uncomment once Base native minting is available on Base mainnet.
      // case Chains.Base.Base:
      //   deployment = BaseL2TBTCTokenDeployment
      //   break
      default:
        throw new Error("Unsupported deployment type")
    }

    super(config, deployment)
  }

  // eslint-disable-next-line valid-jsdoc
  /**
   * @see {L2TBTCToken#getChainIdentifier}
   */
  getChainIdentifier(): ChainIdentifier {
    return EthereumAddress.from(this._instance.address)
  }

  // eslint-disable-next-line valid-jsdoc
  /**
   * @see {L2TBTCToken#balanceOf}
   */
  balanceOf(identifier: ChainIdentifier): Promise<BigNumber> {
    return this._instance.balanceOf(`0x${identifier.identifierHex}`)
  }
}
