import { ChainIdentifier, Hex, RedeemerProxy } from "../../src"

export class MockRedeemerProxy implements RedeemerProxy {
  private _redeemerAddress: ChainIdentifier
  private _requestRedemptionLog: Hex[] = []

  get requestRedemptionLog(): Hex[] {
    return this._requestRedemptionLog
  }

  constructor(redeemerAddress: ChainIdentifier) {
    this._redeemerAddress = redeemerAddress
  }

  redeemerAddress(): ChainIdentifier {
    return this._redeemerAddress
  }

  requestRedemption(redemptionData: Hex): Promise<Hex> {
    this._requestRedemptionLog.push(redemptionData)
    return new Promise<Hex>((resolve, _) => {
      // random transaction hash
      resolve(
        Hex.from(
          "13d4d424cacca7468f1df40d04beb141431d65c75b5eee910c0d0a1208ca85b4"
        )
      )
    })
  }
}
