import { expect } from "chai"
import {
  compressPublicKey,
  decodeP2PKHAddress,
  encodeToP2PKHAddress,
} from "../src/bitcoin"

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

  describe("encodeToP2PKHAddress", () => {
    context("when network is main", () => {
      context("when proper public key hash is provided", () => {
        it("should generate proper public key hash", () => {
          const publicKeyHash = "3a38d44d6a0c8d0bb84e0232cc632b7e48c72e0e"

          const bitcoinAddress = "16JrGhLx5bcBSA34kew9V6Mufa4aXhFe9X"

          expect(encodeToP2PKHAddress(publicKeyHash, "main")).to.be.equal(
            bitcoinAddress
          )
        })
      })

      context("when wrong public key hash is provided", () => {
        it("should generate proper public key hash", () => {
          const publicKeyHash = "023a38d44d6a0c8d0bb84e0232cc632b7e48c72e0e"

          expect(() => encodeToP2PKHAddress(publicKeyHash, "main")).to.throw()
        })
      })
    })

    context("when network is testnet", () => {
      context("when proper public key hash is provided", () => {
        it("should generate proper public key hash", () => {
          const publicKeyHash = "12dca478de0fc650ed22bb3b6f09eed59db0462f"

          const bitcoinAddress = "mhEgn1o29c8YD5V1uWCU51u3g9cBYxMxvy"

          expect(encodeToP2PKHAddress(publicKeyHash, "testnet")).to.be.equal(
            bitcoinAddress
          )
        })
      })

      context("when wrong public key hash is provided", () => {
        it("should generate proper public key hash", () => {
          const publicKeyHash = "0212dca478de0fc650ed22bb3b6f09eed59db0462f"

          expect(() =>
            encodeToP2PKHAddress(publicKeyHash, "testnet")
          ).to.throw()
        })
      })
    })
  })

  describe("decodeP2PKHAddress", () => {
    context("when network is main", () => {
      context("when proper P2PKH address is provided", () => {
        it("should generate proper public key hash", () => {
          const bitcoinAddress = "16JrGhLx5bcBSA34kew9V6Mufa4aXhFe9X"

          const publicKeyHash = "3a38d44d6a0c8d0bb84e0232cc632b7e48c72e0e"

          expect(decodeP2PKHAddress(bitcoinAddress, "main")).to.be.equal(
            publicKeyHash
          )
        })
      })

      context("when wrong P2PKH address  is provided", () => {
        it("should generate proper public key hash", () => {
          const bitcoinAddress = "12316JrGhLx5bcBSA34kew9V6Mufa4aXhFe9X"

          expect(() => decodeP2PKHAddress(bitcoinAddress, "main")).to.throw()
        })
      })
    })

    context("when network is testnet", () => {
      context("when proper public key hash is provided", () => {
        it("should generate proper public key hash", () => {
          const bitcoinAddress = "mhEgn1o29c8YD5V1uWCU51u3g9cBYxMxvy"

          const publicKeyHash = "12dca478de0fc650ed22bb3b6f09eed59db0462f"

          expect(decodeP2PKHAddress(bitcoinAddress, "testnet")).to.be.equal(
            publicKeyHash
          )
        })
      })

      context("when wrong public key hash is provided", () => {
        it("should generate proper public key hash", () => {
          const bitcoinAddress = "123mhEgn1o29c8YD5V1uWCU51u3g9cBYxMxvy"

          expect(() => decodeP2PKHAddress(bitcoinAddress, "testnet")).to.throw()
        })
      })
    })
  })
})
