import { RequestRedemptionData, TBTCToken } from "../../src/chain"
import { Hex } from "../../src/hex"
import { BigNumber } from "ethers"

interface RequestRedemptionLog extends RequestRedemptionData {}

export class MockTBTCToken implements TBTCToken {
  private _requestRedemptionLog: RequestRedemptionLog[] = []

  get requestRedemptionLog() {
    return this._requestRedemptionLog
  }

  totalSupply(blockNumber?: number | undefined): Promise<BigNumber> {
    throw new Error("Method not implemented.")
  }

  async requestRedemption(
    requestRedemptionData: RequestRedemptionData
  ): Promise<Hex> {
    this._requestRedemptionLog.push(requestRedemptionData)

    return Hex.from(
      "0xf7d0c92c8de4d117d915c2a8a54ee550047f926bc00b91b651c40628751cfe29"
    )
  }
}
