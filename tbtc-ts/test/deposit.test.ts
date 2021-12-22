import TBTC from "./../src"
import { expect } from "chai"
import { BigNumber } from "ethers"

describe("Deposit", () => {
  describe("createDepositScript", () => {
    it("should work", async () => {
      const rawScript = await TBTC.createDepositScript({
        ethereumAddress: "0x934B98637cA318a4D6E7CA6ffd1690b8e77df637",
        amount: BigNumber.from(120000000), // 1.2 BTC
        refundPublicKey:
          "0300d6f28a2f6bf9836f57fcda5d284c9a8f849316119779f0d6090830d97763a9",
      })

      expect(rawScript.length).to.be.equal(236)
    })
  })
})
