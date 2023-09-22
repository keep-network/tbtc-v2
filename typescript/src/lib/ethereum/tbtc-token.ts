import { TBTC as ContractTBTC } from "../../../typechain/TBTC"
import { TBTCToken as ChainTBTCToken } from "../contracts"
import { BigNumber, ContractTransaction, utils } from "ethers"
import { computeHash160, UnspentTransactionOutput } from "../bitcoin"
import { Hex } from "../../hex"
import {
  ContractConfig,
  EthereumContract,
  sendWithRetry,
} from "./contract-handle"
import TBTCDeployment from "@keep-network/tbtc-v2/artifacts/TBTC.json"
import { Address } from "./address"

/**
 * Implementation of the Ethereum TBTC v2 token handle.
 */
export class TBTCToken
  extends EthereumContract<ContractTBTC>
  implements ChainTBTCToken
{
  constructor(config: ContractConfig) {
    super(config, TBTCDeployment)
  }

  // eslint-disable-next-line valid-jsdoc
  /**
   * @see {ChainTBTCToken#totalSupply}
   */
  async totalSupply(blockNumber?: number): Promise<BigNumber> {
    return this._instance.totalSupply({
      blockTag: blockNumber ?? "latest",
    })
  }

  // eslint-disable-next-line valid-jsdoc
  /**
   * @see {ChainTBTCToken#requestRedemption}
   */
  async requestRedemption(
    walletPublicKey: string,
    mainUtxo: UnspentTransactionOutput,
    redeemerOutputScript: string,
    amount: BigNumber
  ): Promise<Hex> {
    const redeemer = await this._instance?.signer?.getAddress()
    if (!redeemer) {
      throw new Error("Signer not provided")
    }

    const vault = await this._instance.owner()
    const extraData = this.buildRequestRedemptionData(
      Address.from(redeemer),
      walletPublicKey,
      mainUtxo,
      redeemerOutputScript
    )

    const tx = await sendWithRetry<ContractTransaction>(async () => {
      return await this._instance.approveAndCall(
        vault,
        amount,
        extraData.toPrefixedString()
      )
    }, this._totalRetryAttempts)

    return Hex.from(tx.hash)
  }

  private buildRequestRedemptionData(
    redeemer: Address,
    walletPublicKey: string,
    mainUtxo: UnspentTransactionOutput,
    redeemerOutputScript: string
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
    walletPublicKey: string,
    mainUtxo: UnspentTransactionOutput,
    redeemerOutputScript: string
  ) {
    const walletPublicKeyHash = `0x${computeHash160(walletPublicKey)}`

    const mainUtxoParam = {
      // The Ethereum Bridge expects this hash to be in the Bitcoin internal
      // byte order.
      txHash: mainUtxo.transactionHash.reverse().toPrefixedString(),
      txOutputIndex: mainUtxo.outputIndex,
      txOutputValue: mainUtxo.value,
    }

    // Convert the output script to raw bytes buffer.
    const rawRedeemerOutputScript = Buffer.from(redeemerOutputScript, "hex")
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
