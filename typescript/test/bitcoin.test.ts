import { expect } from "chai"
import { compressPublicKey, decodeP2PKHAddress, generateP2PKHAddress } from "../src/bitcoin"

describe("Bitcoin", () => {
  describe("compressPublicKey", () => {
    context("when public key parameter has a correct length", () => {
      context("when the Y coordinate is divisible by 2", () => {
        it("should compress the public key correctly", () => {
          const uncompressedPublicKey =
            "ff6e1857db52d6dba2bd4239fba722655622bc520709d38011f9adac8ea3477b" +
            "45ae275b657f7bac7c1e3d146a564051aee1356895f01e4f29f333502416fa4a"
          const compressedPublicKey =
            "02ff6e1857db52d6dba2bd4239fba722655622bc520709d38011f9adac8ea3477b"

          expect(compressPublicKey(uncompressedPublicKey)).to.be.equal(
            compressedPublicKey
          )
        })
      })

      context("when the Y coordinate is not divisible by 2", () => {
        it("should compress the public key correctly", () => {
          const uncompressedPublicKey =
            "474444cca71c678f5019d16782b6522735717a94602085b4adf707b465c36ca8" +
            "7b5dff055ee1cc3a1fff4715dea2858ca4dd5bba0af30abcd881a6bda4fb70af"
          const compressedPublicKey =
            "03474444cca71c678f5019d16782b6522735717a94602085b4adf707b465c36ca8"

          expect(compressPublicKey(uncompressedPublicKey)).to.be.equal(
            compressedPublicKey
          )
        })
      })
    })

    context("when public key parameter has an incorrect length", () => {
      it("should throw", () => {
        const uncompressedPublicKey =
          "04474444cca71c678f5019d16782b6522735717a94602085b4adf707b465c36ca8" +
          "7b5dff055ee1cc3a1fff4715dea2858ca4dd5bba0af30abcd881a6bda4fb70af"

        expect(() => compressPublicKey(uncompressedPublicKey)).to.throw(
          "The public key parameter must be 64-byte. Neither 0x nor 04 prefix is allowed"
        )
      })
    })
  })

  describe("generateP2PKHAddress", () => {
    context("when compressed public key is provided", () => {
      it("should generate proper P2PKH address", () => {
        const compressedPublicKey =
          "02ff6e1857db52d6dba2bd4239fba722655622bc520709d38011f9adac8ea3477b"

        const bitcoinAddress =
          "6pyyJxc6x6Ev8utcxUYVqqNjSrSjdixNJv9WnoXJEHtBpPGa5m"

        expect(generateP2PKHAddress(compressedPublicKey)).to.be.equal(
          bitcoinAddress
        )
      })
    })

    context("when uncompressed public key is provided", () => {
      it("should throw", () => {
        const uncompressedPublicKey =
          "ff6e1857db52d6dba2bd4239fba722655622bc520709d38011f9adac8ea3477b" +
          "45ae275b657f7bac7c1e3d146a564051aee1356895f01e4f29f333502416fa4a"

        expect(() => generateP2PKHAddress(uncompressedPublicKey)).to.throw(
          "Public key must be compressed"
        )
      })
    })
  })

  describe("decodeP2PKHAddress", () => {
    context("when proper P2PKH address is provided", () => {
      it("should return proper compressed public key", () => {
        const compressedPublicKey =
          "02ff6e1857db52d6dba2bd4239fba722655622bc520709d38011f9adac8ea3477b"

        const bitcoinAddress =
          "6pyyJxc6x6Ev8utcxUYVqqNjSrSjdixNJv9WnoXJEHtBpPGa5m"

        expect(decodeP2PKHAddress(bitcoinAddress)).to.be.equal(
          compressedPublicKey
        )
      })

      it("should return the same public key that was used in `generateP2PKHAddress` function", () => {
        const compressedPublicKey =
            "03474444cca71c678f5019d16782b6522735717a94602085b4adf707b465c36ca8"

        const bitcoinAddress = generateP2PKHAddress(compressedPublicKey)

        expect(decodeP2PKHAddress(bitcoinAddress)).to.be.equal(compressedPublicKey)
      })
    })

    context("when random string is provided as a P2PKH address", () => {
      it("should throw", () => {
        const bitcoinAddress = "random string"

        expect(() => decodeP2PKHAddress(bitcoinAddress)).to.throw(
          "Decoding failed."
        )
      })
    })
  })

})
