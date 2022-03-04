import { expect } from "chai"
import { ethers } from "hardhat"
import { TestEcdsaLib, TestEcdsaLib__factory } from "../../typechain"

describe("EcdsaLib", () => {
  let ecdsaLib: TestEcdsaLib

  before(async () => {
    const EcdsaLib = await ethers.getContractFactory<TestEcdsaLib__factory>(
      "TestEcdsaLib"
    )
    ecdsaLib = await EcdsaLib.deploy()
  })

  describe("compressPublicKey", async () => {
    context("with valid uncompressed public key", async () => {
      const testData = [
        {
          testName: "with even Y",
          uncompressedPublicKey:
            "0x50863ad64a87ae8a2fe83c1af1a8403cb53f53e486d8511dad8a04887e5b23522cd470243453a299fa9e77237716103abc11a1df38855ed6f2ee187e9c582ba6",
          expectedCompressedPublicKey:
            "0x0250863ad64a87ae8a2fe83c1af1a8403cb53f53e486d8511dad8a04887e5b2352",
        },
        {
          testName: "with odd Y",
          uncompressedPublicKey:
            "0x2a574ea59cae80b09d6ba415746e9b031abfbe83f149b43b37be035b871648720336c5eb647e891c98261c57c13098fa6ae68221363c68ff15841b86dad60241",
          expectedCompressedPublicKey:
            "0x032a574ea59cae80b09d6ba415746e9b031abfbe83f149b43b37be035b87164872",
        },
      ]

      testData.forEach((test) => {
        it(test.testName, async () => {
          expect(
            await ecdsaLib.compressPublicKey(test.uncompressedPublicKey)
          ).to.be.equal(test.expectedCompressedPublicKey)
        })
      })
    })

    context("with invalid uncompressed public key", async () => {
      const testData = [
        {
          testName: "reverts for too short public key",
          uncompressedPublicKey: ethers.utils.randomBytes(63),
          expectedError: "Invalid public key length",
        },
        {
          testName: "reverts for too long public key",
          uncompressedPublicKey: ethers.utils.randomBytes(65),
          expectedError: "Invalid public key length",
        },
      ]

      testData.forEach((test) => {
        it(test.testName, async () => {
          await expect(
            ecdsaLib.compressPublicKey(test.uncompressedPublicKey)
          ).to.be.revertedWith(test.expectedError)
        })
      })
    })
  })
})
