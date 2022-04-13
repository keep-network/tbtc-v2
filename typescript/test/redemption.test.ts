import TBTC from "./../src"
import { BigNumber } from "ethers"

// @ts-ignore
import bcoin from "bcoin"
import { MockBitcoinClient } from "./utils/mock-bitcoin-client"

describe("Redemption", () => {
  describe("redeemDeposits", () => {
    const fee = BigNumber.from(1600)
    let bitcoinClient: MockBitcoinClient

    const NO_MAIN_UTXO = {
      transactionHash: "",
      outputIndex: 0,
      value: 0,
      transactionHex: "",
    }

    const testnetWalletPrivateKey =
      "cRk1zdau3jp2X3XsrRKDdviYLuC32fHfyU186wLBEbZWx4uQWW3v"

    beforeEach(async () => {
      bcoin.set("testnet")

      bitcoinClient = new MockBitcoinClient()
    })

    context("when the there is a single redeemer", () => {
      context("when the redeemer address is public key hash", () => {
        // TODO: Implement
      })

      context("when the redeemer address is script hash", () => {
        // TODO: Implement
      })

      context("when the redeemer address is witness public key hash", () => {
        // TODO: Implement
      })

      context("when the redeemer address is witness script hash", () => {
        // TODO: Implement
      })
    })

    context("when there are multiple redeemers", () => {
      // TODO: Implement
    })

    context("should work", async () => {
      await TBTC.redeemDeposits(
        bitcoinClient,
        fee,
        testnetWalletPrivateKey,
        NO_MAIN_UTXO,
        []
      )
    })

    it("should work", () => {
      // TODO: Implement
    })
  })
})
