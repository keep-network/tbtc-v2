import { TBTCToken } from "../../src/lib/contracts"
import { Hex } from "../../src/hex"
import { BigNumber } from "ethers"
import { UnspentTransactionOutput } from "../../src/lib/bitcoin"

interface RequestRedemptionLog {
  walletPublicKey: string
  mainUtxo: UnspentTransactionOutput
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
    mainUtxo: UnspentTransactionOutput,
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
}
