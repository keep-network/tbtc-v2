import TBTC from "./../src"
import { expect } from "chai"
import { BigNumber } from "ethers"
import { testnetPrivateKey, testnetUTXO } from "./data/bitcoin"

describe("Deposit", () => {
  const depositData = {
    ethereumAddress: "0x934B98637cA318a4D6E7CA6ffd1690b8e77df637",
    amount: BigNumber.from(10000), // 0.0001 BTC
    refundPublicKey:
      "0300d6f28a2f6bf9836f57fcda5d284c9a8f849316119779f0d6090830d97763a9",
    blindingFactor: BigNumber.from("0xf9f0c90d00039523"), // 18010115967526606115
    createdAt: 1640181600, // 22-12-2021 14:00:00 UTC
  }

  describe("createDepositTransaction", () => {
    it("should work", async () => {
      const rawTransaction = await TBTC.createDepositTransaction(
        depositData,
        [testnetUTXO],
        testnetPrivateKey
      )

      expect(rawTransaction.transactionHex.length).to.be.equal(446)
    })
  })

  describe("createDepositScript", () => {
    it("should work", async () => {
      const rawScript = await TBTC.createDepositScript(depositData)

      expect(rawScript.length).to.be.equal(236)
    })
  })
})
