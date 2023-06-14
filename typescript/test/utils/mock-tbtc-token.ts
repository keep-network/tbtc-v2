import { Identifier, TBTCToken } from "../../src/chain"
import { Hex } from "../../src/hex"
import { BigNumber } from "ethers"

interface ApproveAndCallLog {
  spender: Identifier
  amount: BigNumber
  extraData: Hex
}

export class MockTBTCToken implements TBTCToken {
  private _approveAndCallLog: ApproveAndCallLog[] = []

  get approveAndCallLog() {
    return this._approveAndCallLog
  }

  totalSupply(blockNumber?: number | undefined): Promise<BigNumber> {
    throw new Error("Method not implemented.")
  }
  async approveAndCall(
    spender: Identifier,
    amount: BigNumber,
    extraData: Hex
  ): Promise<Hex> {
    this._approveAndCallLog.push({ spender, amount, extraData })

    // Random tx hash
    return Hex.from(
      "0xf7d0c92c8de4d117d915c2a8a54ee550047f926bc00b91b651c40628751cfe29"
    )
  }
}
