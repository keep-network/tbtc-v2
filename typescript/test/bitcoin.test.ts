import { expect } from "chai"
import {
  compressPublicKey,
  encodeToBitcoinAddress,
  decodeBitcoinAddress,
  isPublicKeyHashLength,
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

  describe("P2PKH <-> public key hash conversion", () => {
    const publicKeyHash = "3a38d44d6a0c8d0bb84e0232cc632b7e48c72e0e"
    const P2WPKHAddress = "bc1q8gudgnt2pjxshwzwqgevccet0eyvwtswt03nuy"
    const P2PKHAddress = "16JrGhLx5bcBSA34kew9V6Mufa4aXhFe9X"
    const P2WPKHAddressTestnet = "tb1q8gudgnt2pjxshwzwqgevccet0eyvwtswpf2q8h"
    const P2PKHAddressTestnet = "mkpoZkRvtd3SDGWgUDuXK1aEXZfHRM2gKw"

    describe("encodeToBitcoinAddress", () => {
      context("when network is main", () => {
        context("when witness option is true", () => {
          context("when proper public key hash is provided", () => {
            it("should encode public key hash into bitcoin address properly", () => {
              expect(
                encodeToBitcoinAddress(publicKeyHash, true, "main")
              ).to.be.equal(P2WPKHAddress)
            })
          })

          context("when wrong public key hash is provided", () => {
            it("should throw", () => {
              const wrontPublicKeyHash = "02" + publicKeyHash

              expect(() =>
                encodeToBitcoinAddress(wrontPublicKeyHash, true, "main")
              ).to.throw()
            })
          })
        })

        context("when witness option is false", () => {
          context("when proper public key hash is provided", () => {
            it("should encode public key hash into bitcoin address properly", () => {
              expect(
                encodeToBitcoinAddress(publicKeyHash, false, "main")
              ).to.be.equal(P2PKHAddress)
            })
          })

          context("when wrong public key hash is provided", () => {
            it("should throw", () => {
              const wrongPublicKeyHash = "02" + publicKeyHash

              expect(() =>
                encodeToBitcoinAddress(wrongPublicKeyHash, false, "main")
              ).to.throw()
            })
          })
        })
      })
    })

    describe("decodeAddress", () => {
      context("when network is main", () => {
        context("when proper P2WPKH address is provided", () => {
          it("should decode P2WPKH adress correctly", () => {
            expect(decodeBitcoinAddress(P2WPKHAddress)).to.be.equal(
              publicKeyHash
            )
          })
        })

        context("when proper P2PKH address is provided", () => {
          it("should decode P2PKH address correctly", () => {
            expect(decodeBitcoinAddress(P2PKHAddress)).to.be.equal(
              publicKeyHash
            )
          })
        })

        context("when wrong address is provided", () => {
          it("should throw", () => {
            const bitcoinAddress = "123" + P2PKHAddress

            expect(() => decodeBitcoinAddress(bitcoinAddress)).to.throw()
          })
        })
      })

      context("when network is testnet", () => {
        context("when proper P2WPKH address is provided", () => {
          it("should decode P2WPKH adress correctly", () => {
            expect(decodeBitcoinAddress(P2WPKHAddressTestnet)).to.be.equal(
              publicKeyHash
            )
          })
        })

        context("when proper P2PKH address is provided", () => {
          it("should decode P2PKH address correctly", () => {
            expect(decodeBitcoinAddress(P2PKHAddressTestnet)).to.be.equal(
              publicKeyHash
            )
          })
        })

        context("when wrong address is provided", () => {
          it("should throw", () => {
            const bitcoinAddress = "123" + P2PKHAddressTestnet

            expect(() => decodeBitcoinAddress(bitcoinAddress)).to.throw()
          })
        })
      })
    })
  })

  describe("isPublicKeyHashLength", () => {
    const publicKeyHash = "3a38d44d6a0c8d0bb84e0232cc632b7e48c72e0e"
    const wrongPublicKeyHash = "3a38d44d6a0c8d0"

    context("when proper public key hash is provided", () => {
      it("should return true", () => {
        expect(isPublicKeyHashLength(publicKeyHash)).to.be.equal(true)
      })
    })

    context("when wrong public key hash is provided", () => {
      it("should return false", () => {
        expect(isPublicKeyHashLength(wrongPublicKeyHash)).to.be.equal(false)
      })
    })
  })
})
