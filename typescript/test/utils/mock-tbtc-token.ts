import { ChainIdentifier, TBTCToken } from "../../src/lib/contracts"
import { Hex } from "../../src/lib/utils"
import { BigNumber } from "ethers"
import { BitcoinUtxo } from "../../src/lib/bitcoin"
import { EthereumAddress } from "../../src"

interface RequestRedemptionLog {
  walletPublicKey: string
  mainUtxo: BitcoinUtxo
  redeemerOutputScript: string
  amount: BigNumber
}

export class MockTBTCToken implements TBTCToken {
  private _requestRedemptionLog: RequestRedemptionLog[] = []

  get requestRedemptionLog() {
    return this._requestRedemptionLog
  }

  totalSupply(blockNumber?: number | undefined): Promise<BigNumber> {
    throw new Error("Method not implemented.")
  }

  async requestRedemption(
    walletPublicKey: string,
    mainUtxo: BitcoinUtxo,
    redeemerOutputScript: string,
    amount: BigNumber
  ): Promise<Hex> {
    this._requestRedemptionLog.push({
      walletPublicKey,
      mainUtxo,
      redeemerOutputScript,
      amount,
    })

    return Hex.from(
      "0xf7d0c92c8de4d117d915c2a8a54ee550047f926bc00b91b651c40628751cfe29"
    )
  }

  getChainIdentifier(): ChainIdentifier {
    return EthereumAddress.from("0x694cfd89700040163727828AE20B52099C58F02C")
  }
}
