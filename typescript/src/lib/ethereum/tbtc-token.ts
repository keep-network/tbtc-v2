import { TBTC as TBTCTypechain } from "../../../typechain/TBTC"
import { ChainIdentifier, TBTCToken } from "../contracts"
import { BigNumber, ContractTransaction, utils } from "ethers"
import { BitcoinHashUtils, BitcoinUtxo } from "../bitcoin"
import { Hex } from "../utils"
import {
  EthersContractConfig,
  EthersContractDeployment,
  EthersContractHandle,
  EthersTransactionUtils,
} from "./adapter"
import { EthereumAddress } from "./address"

import MainnetTBTCTokenDeployment from "./artifacts/mainnet/TBTC.json"
import SepoliaTBTCTokenDeployment from "./artifacts/sepolia/TBTC.json"
import LocalTBTCTokenDeployment from "@keep-network/tbtc-v2/artifacts/TBTC.json"

/**
 * Implementation of the Ethereum TBTC v2 token handle.
 * @see {TBTCToken} for reference.
 */
export class EthereumTBTCToken
  extends EthersContractHandle<TBTCTypechain>
  implements TBTCToken
{
  constructor(
    config: EthersContractConfig,
    deploymentType: "local" | "sepolia" | "mainnet" = "local"
  ) {
    let deployment: EthersContractDeployment

    switch (deploymentType) {
      case "local":
        deployment = LocalTBTCTokenDeployment
        break
      case "sepolia":
        deployment = SepoliaTBTCTokenDeployment
        break
      case "mainnet":
        deployment = MainnetTBTCTokenDeployment
        break
      default:
        throw new Error("Unsupported deployment type")
    }

    super(config, deployment)
  }

  // eslint-disable-next-line valid-jsdoc
  /**
   * @see {TBTCToken#getChainIdentifier}
   */
  getChainIdentifier(): ChainIdentifier {
    return EthereumAddress.from(this._instance.address)
  }

  // eslint-disable-next-line valid-jsdoc
  /**
   * @see {TBTCToken#totalSupply}
   */
  async totalSupply(blockNumber?: number): Promise<BigNumber> {
    return this._instance.totalSupply({
      blockTag: blockNumber ?? "latest",
    })
  }

  // eslint-disable-next-line valid-jsdoc
  /**
   * @see {TBTCToken#requestRedemption}
   */
  async requestRedemption(
    walletPublicKey: Hex,
    mainUtxo: BitcoinUtxo,
    redeemerOutputScript: Hex,
    amount: BigNumber
  ): Promise<Hex> {
    const redeemer = await this._instance?.signer?.getAddress()
    if (!redeemer) {
      throw new Error("Signer not provided")
    }

    const vault = await this._instance.owner()
    const extraData = this.buildRequestRedemptionData(
      EthereumAddress.from(redeemer),
      walletPublicKey,
      mainUtxo,
      redeemerOutputScript
    )

    const tx = await EthersTransactionUtils.sendWithRetry<ContractTransaction>(
      async () => {
        return await this._instance.approveAndCall(
          vault,
          amount,
          extraData.toPrefixedString()
        )
      },
      this._totalRetryAttempts
    )

    return Hex.from(tx.hash)
  }

  private buildRequestRedemptionData(
    redeemer: EthereumAddress,
    walletPublicKey: Hex,
    mainUtxo: BitcoinUtxo,
    redeemerOutputScript: Hex
  ): Hex {
    const {
      walletPublicKeyHash,
      prefixedRawRedeemerOutputScript,
      mainUtxo: _mainUtxo,
    } = this.buildBridgeRequestRedemptionData(
      walletPublicKey,
      mainUtxo,
      redeemerOutputScript
    )

    return Hex.from(
      utils.defaultAbiCoder.encode(
        ["address", "bytes20", "bytes32", "uint32", "uint64", "bytes"],
        [
          redeemer.identifierHex,
          walletPublicKeyHash,
          _mainUtxo.txHash,
          _mainUtxo.txOutputIndex,
          _mainUtxo.txOutputValue,
          prefixedRawRedeemerOutputScript,
        ]
      )
    )
  }

  private buildBridgeRequestRedemptionData(
    walletPublicKey: Hex,
    mainUtxo: BitcoinUtxo,
    redeemerOutputScript: Hex
  ) {
    const walletPublicKeyHash =
      BitcoinHashUtils.computeHash160(walletPublicKey).toPrefixedString()

    const mainUtxoParam = {
      // The Ethereum Bridge expects this hash to be in the Bitcoin internal
      // byte order.
      txHash: mainUtxo.transactionHash.reverse().toPrefixedString(),
      txOutputIndex: mainUtxo.outputIndex,
      txOutputValue: mainUtxo.value,
    }

    // Convert the output script to raw bytes buffer.
    const rawRedeemerOutputScript = redeemerOutputScript.toBuffer()
    // Prefix the output script bytes buffer with 0x and its own length.
    const prefixedRawRedeemerOutputScript = `0x${Buffer.concat([
      Buffer.from([rawRedeemerOutputScript.length]),
      rawRedeemerOutputScript,
    ]).toString("hex")}`

    return {
      walletPublicKeyHash,
      mainUtxo: mainUtxoParam,
      prefixedRawRedeemerOutputScript,
    }
  }
}
