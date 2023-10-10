import { expect } from "chai"
import { BitcoinTxHash, BitcoinNetwork, toBitcoinJsLibNetwork } from "../src"
import { networks } from "bitcoinjs-lib"

describe("BitcoinNetwork", () => {
  const testData = [
    {
      enumKey: BitcoinNetwork.Unknown,
      enumValue: "unknown",
      // any value that doesn't match other supported networks
      genesisHash: BitcoinTxHash.from("0x00010203"),
      expectedToBitcoinJsLibResult: new Error("network not supported"),
    },
    {
      enumKey: BitcoinNetwork.Testnet,
      enumValue: "testnet",
      genesisHash: BitcoinTxHash.from(
        "0x000000000933ea01ad0ee984209779baaec3ced90fa3f408719526f8d77f4943"
      ),
      expectedToBitcoinJsLibResult: networks.testnet,
    },
    {
      enumKey: BitcoinNetwork.Mainnet,
      enumValue: "mainnet",
      genesisHash: BitcoinTxHash.from(
        "000000000019d6689c085ae165831e934ff763ae46a2a6c172b3f1b60a8ce26f"
      ),
      expectedToBitcoinJsLibResult: networks.bitcoin,
    },
  ]

  testData.forEach(
    ({ enumKey, enumValue, genesisHash, expectedToBitcoinJsLibResult }) => {
      context(enumKey, async () => {
        describe(`toString`, async () => {
          it(`should return correct value`, async () => {
            expect(enumKey.toString()).to.be.equal(enumValue)
          })
        })

        describe(`fromGenesisHash`, async () => {
          it(`should resolve correct enum key`, async () => {
            expect(BitcoinNetwork.fromGenesisHash(genesisHash)).to.be.equal(
              enumKey
            )
          })
        })

        describe(`toBitcoinJsLibNetwork`, async () => {
          if (expectedToBitcoinJsLibResult instanceof Error) {
            it(`should throw an error`, async () => {
              expect(() => toBitcoinJsLibNetwork(enumKey)).to.throw(
                expectedToBitcoinJsLibResult.message
              )
            })
          } else {
            it(`should return ${expectedToBitcoinJsLibResult}`, async () => {
              expect(toBitcoinJsLibNetwork(enumKey)).to.be.equal(
                expectedToBitcoinJsLibResult
              )
            })
          }
        })
      })
    }
  )
})
