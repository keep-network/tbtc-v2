import {
  EthersContractConfig,
  EthersContractDeployment,
  EthersContractHandle,
} from "../ethereum/adapter"
import { L2TBTC as L2TBTCTypechain } from "../../../typechain/L2TBTC"
import { ChainIdentifier, Chains, L2TBTCToken } from "../contracts"
import { BigNumber } from "ethers"
import { EthereumAddress } from "../ethereum"

import ArbitrumL2TBTCTokenDeployment from "./artifacts/arbitrumOne/ArbitrumTBTC.json"
import ArbitrumSepoliaL2TBTCTokenDeployment from "./artifacts/arbitrumSepolia/ArbitrumTBTC.json"

/**
 * Implementation of the Arbitrum L2TBTCToken handle.
 * @see {L2TBTCToken} for reference.
 */
export class ArbitrumL2TBTCToken
  extends EthersContractHandle<L2TBTCTypechain>
  implements L2TBTCToken
{
  constructor(config: EthersContractConfig, chainId: Chains.Arbitrum) {
    let deployment: EthersContractDeployment

    switch (chainId) {
      case Chains.Arbitrum.ArbitrumSepolia:
        deployment = ArbitrumSepoliaL2TBTCTokenDeployment
        break
      case Chains.Arbitrum.Arbitrum:
        deployment = ArbitrumL2TBTCTokenDeployment
        break
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
