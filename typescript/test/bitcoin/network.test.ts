import { expect } from "chai"
import { BitcoinNetwork, toBcoinNetwork } from "../../src/bitcoin/network"
import { TransactionHash } from "../../src/bitcoin"

describe("BitcoinNetwork", () => {
  const testData = [
    {
      enumKey: BitcoinNetwork.Unknown,
      enumValue: "unknown",
      // any value that doesn't match other supported networks
      genesisHash: TransactionHash.from("0x00010203"),
      bcoinString: undefined, // should throw an error
    },
    {
      enumKey: BitcoinNetwork.Testnet,
      enumValue: "testnet",
      genesisHash: TransactionHash.from(
        "0x000000000933ea01ad0ee984209779baaec3ced90fa3f408719526f8d77f4943"
      ),
      bcoinString: "testnet",
    },
    {
      enumKey: BitcoinNetwork.Mainnet,
      enumValue: "mainnet",
      genesisHash: TransactionHash.from(
        "000000000019d6689c085ae165831e934ff763ae46a2a6c172b3f1b60a8ce26f"
      ),
      bcoinString: "main",
    },
  ]

  testData.forEach(({ enumKey, enumValue, genesisHash, bcoinString }) => {
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

      describe(`toBcoinNetwork`, async () => {
        if (!bcoinString) {
          it(`should throw an error`, async () => {
            expect(() => toBcoinNetwork(enumKey)).to.throw(
              "network not supported"
            )
          })
        } else {
          it(`should return ${bcoinString}`, async () => {
            expect(toBcoinNetwork(enumKey)).to.be.equal(bcoinString)
          })
        }
      })
    })
  })
})
