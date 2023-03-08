import { expect } from "chai"
import {
  compressPublicKey,
  encodeToBitcoinAddress,
  decodeBitcoinAddress,
  isPublicKeyHashLength,
  locktimeToNumber,
  BlockHeader,
  serializeBlockHeader,
  deserializeBlockHeader,
  hashLEToBigNumber,
  bitsToTarget,
  targetToDifficulty,
} from "../src/bitcoin"
import { calculateDepositRefundLocktime } from "../src/deposit"
import { BitcoinNetwork } from "../src/bitcoin-network"
import { Hex } from "../src/hex"
import { BigNumber } from "ethers"

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
      context("when network is mainnet", () => {
        context("when witness option is true", () => {
          context("when proper public key hash is provided", () => {
            it("should encode public key hash into bitcoin address properly", () => {
              expect(
                encodeToBitcoinAddress(
                  publicKeyHash,
                  true,
                  BitcoinNetwork.Mainnet
                )
              ).to.be.equal(P2WPKHAddress)
            })
          })

          context("when wrong public key hash is provided", () => {
            it("should throw", () => {
              const wrongPublicKeyHash = "02" + publicKeyHash

              expect(() =>
                encodeToBitcoinAddress(
                  wrongPublicKeyHash,
                  true,
                  BitcoinNetwork.Mainnet
                )
              ).to.throw("P2WPKH must be 20 bytes")
            })
          })
        })

        context("when witness option is false", () => {
          context("when proper public key hash is provided", () => {
            it("should encode public key hash into bitcoin address properly", () => {
              expect(
                encodeToBitcoinAddress(
                  publicKeyHash,
                  false,
                  BitcoinNetwork.Mainnet
                )
              ).to.be.equal(P2PKHAddress)
            })
          })

          context("when wrong public key hash is provided", () => {
            it("should throw", () => {
              const wrongPublicKeyHash = "02" + publicKeyHash

              expect(() =>
                encodeToBitcoinAddress(
                  wrongPublicKeyHash,
                  false,
                  BitcoinNetwork.Mainnet
                )
              ).to.throw("P2PKH must be 20 bytes")
            })
          })
        })
      })

      context("when network is testnet", () => {
        context("when witness option is true", () => {
          context("when proper public key hash is provided", () => {
            it("should encode public key hash into bitcoin address properly", () => {
              expect(
                encodeToBitcoinAddress(
                  publicKeyHash,
                  true,
                  BitcoinNetwork.Testnet
                )
              ).to.be.equal(P2WPKHAddressTestnet)
            })
          })

          context("when wrong public key hash is provided", () => {
            it("should throw", () => {
              const wrongPublicKeyHash = "02" + publicKeyHash

              expect(() =>
                encodeToBitcoinAddress(
                  wrongPublicKeyHash,
                  true,
                  BitcoinNetwork.Testnet
                )
              ).to.throw("P2WPKH must be 20 bytes")
            })
          })
        })

        context("when witness option is false", () => {
          context("when proper public key hash is provided", () => {
            it("should encode public key hash into bitcoin address properly", () => {
              expect(
                encodeToBitcoinAddress(
                  publicKeyHash,
                  false,
                  BitcoinNetwork.Testnet
                )
              ).to.be.equal(P2PKHAddressTestnet)
            })
          })

          context("when wrong public key hash is provided", () => {
            it("should throw", () => {
              const wrongPublicKeyHash = "02" + publicKeyHash

              expect(() =>
                encodeToBitcoinAddress(
                  wrongPublicKeyHash,
                  false,
                  BitcoinNetwork.Testnet
                )
              ).to.throw("P2PKH must be 20 bytes")
            })
          })
        })
      })

      context("when network is unknown", () => {
        it("should throw", () => {
          expect(() =>
            encodeToBitcoinAddress(publicKeyHash, true, BitcoinNetwork.Unknown)
          ).to.throw("network not supported")
        })
      })
    })

    describe("decodeAddress", () => {
      context("when network is mainnet", () => {
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

            expect(() => decodeBitcoinAddress(bitcoinAddress)).to.throw(
              "Address is too long"
            )
          })
        })

        context("when unsupported P2SH address is provided", () => {
          it("should throw", () => {
            expect(() =>
              decodeBitcoinAddress("3EktnHQD7RiAE6uzMj2ZifT9YgRrkSgzQX")
            ).to.throw("Address must be P2PKH or P2WPKH")
          })
        })

        context("when unsupported P2WSH address is provided", () => {
          it("should throw", () => {
            expect(() =>
              decodeBitcoinAddress(
                "bc1qma629cu92skg0t86lftyaf9uflzwhp7jk63h6mpmv3ezh6puvdhsdxuv4m"
              )
            ).to.throw("Address must be P2PKH or P2WPKH")
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

            expect(() => decodeBitcoinAddress(bitcoinAddress)).to.throw(
              "Address is too long"
            )
          })
        })

        context("when unsupported P2SH address is provided", () => {
          it("should throw", () => {
            expect(() =>
              decodeBitcoinAddress("2MyxShnGQ5NifGb8CHYrtmzosRySxZ9pZo5")
            ).to.throw("Address must be P2PKH or P2WPKH")
          })
        })

        context("when unsupported P2WSH address is provided", () => {
          it("should throw", () => {
            expect(() =>
              decodeBitcoinAddress(
                "tb1qma629cu92skg0t86lftyaf9uflzwhp7jk63h6mpmv3ezh6puvdhs6w2r05"
              )
            ).to.throw("Address must be P2PKH or P2WPKH")
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

  describe("locktimeToNumber", () => {
    const depositCreatedAt: number = 1640181600
    const depositRefundLocktimeDuration: number = 2592000
    const depositRefundLocktime = calculateDepositRefundLocktime(
      depositCreatedAt,
      depositRefundLocktimeDuration
    )

    const testData = [
      {
        contextName: "when locktime is a block height",
        unprefixedHex: "ede80600",
        expectedDepositLocktime: 452845,
      },
      {
        contextName: "when locktime is a timestamp",
        unprefixedHex: "06241559",
        expectedDepositLocktime: 1494557702,
      },
      {
        contextName: "for deposit refund locktime",
        unprefixedHex: depositRefundLocktime,
        expectedDepositLocktime:
          depositCreatedAt + depositRefundLocktimeDuration,
      },
    ]

    testData.forEach((test) => {
      context(test.contextName, () => {
        context("when input is non-prefixed hex string", () => {
          it("should return the locktime in seconds", async () => {
            expect(locktimeToNumber(test.unprefixedHex)).to.be.equal(
              test.expectedDepositLocktime
            )
          })
        })

        context("when input is 0x prefixed hex string", () => {
          it("should return the locktime in seconds", async () => {
            expect(locktimeToNumber("0x" + test.unprefixedHex)).to.be.equal(
              test.expectedDepositLocktime
            )
          })
        })

        context("when input is Buffer object", () => {
          it("should return the locktime in seconds", async () => {
            expect(
              locktimeToNumber(Buffer.from(test.unprefixedHex, "hex"))
            ).to.be.equal(test.expectedDepositLocktime)
          })
        })
      })
    })
  })

  describe("serializeBlockHeader", () => {
    it("calculates correct value", () => {
      const blockHeader: BlockHeader = {
        version: 536870916,
        previousBlockHeaderHash: Hex.from(
          "a5a3501e6ba1f3e2a1ee5d29327a549524ed33f272dfef300045660000000000"
        ),
        merkleRootHash: Hex.from(
          "e27d241ca36de831ab17e6729056c14a383e7a3f43d56254f846b49649775112"
        ),
        time: 1641914003,
        bits: 436256810,
        nonce: 778087099,
      }

      const expectedSerializedBlockHeader = Hex.from(
        "04000020a5a3501e6ba1f3e2a1ee5d29327a549524ed33f272dfef30004566000000" +
          "0000e27d241ca36de831ab17e6729056c14a383e7a3f43d56254f846b496497751" +
          "12939edd612ac0001abbaa602e"
      )

      expect(serializeBlockHeader(blockHeader)).to.be.deep.equal(
        expectedSerializedBlockHeader
      )
    })
  })

  describe("deserializeBlockHeader", () => {
    it("calculates correct value", () => {
      const rawBlockHeader = Hex.from(
        "04000020a5a3501e6ba1f3e2a1ee5d29327a549524ed33f272dfef30004566000000" +
          "0000e27d241ca36de831ab17e6729056c14a383e7a3f43d56254f846b496497751" +
          "12939edd612ac0001abbaa602e"
      )

      const expectedBlockHeader: BlockHeader = {
        version: 536870916,
        previousBlockHeaderHash: Hex.from(
          "a5a3501e6ba1f3e2a1ee5d29327a549524ed33f272dfef300045660000000000"
        ),
        merkleRootHash: Hex.from(
          "e27d241ca36de831ab17e6729056c14a383e7a3f43d56254f846b49649775112"
        ),
        time: 1641914003,
        bits: 436256810,
        nonce: 778087099,
      }

      expect(deserializeBlockHeader(rawBlockHeader)).to.deep.equal(
        expectedBlockHeader
      )
    })
  })

  describe("hashLEToBigNumber", () => {
    it("calculates correct value", () => {
      const hash =
        "31552151fbef8e96a33f979e6253d29edf65ac31b04802319e00000000000000"
      const expectedBigNumber = BigNumber.from(
        "992983769452983078390935942095592601503357651673709518345521"
      )
      expect(hashLEToBigNumber(hash)).to.equal(expectedBigNumber)
    })
  })

  describe("bitsToTarget", () => {
    it("calculates correct value for random block header bits", () => {
      const difficultyBits = 436256810
      const expectedDifficultyTarget = BigNumber.from(
        "1206233370197704583969288378458116959663044038027202007138304"
      )
      expect(bitsToTarget(difficultyBits)).to.equal(expectedDifficultyTarget)
    })

    it("calculates correct value for block header with difficulty of 1", () => {
      const difficultyBits = 486604799
      const expectedDifficultyTarget = BigNumber.from(
        "26959535291011309493156476344723991336010898738574164086137773096960"
      )
      expect(bitsToTarget(difficultyBits)).to.equal(expectedDifficultyTarget)
    })
  })

  describe("targetToDifficulty", () => {
    it("calculates correct value for random block header bits", () => {
      const target = BigNumber.from(
        "1206233370197704583969288378458116959663044038027202007138304"
      )
      const expectedDifficulty = BigNumber.from("22350181")
      expect(targetToDifficulty(target)).to.equal(expectedDifficulty)
    })

    it("calculates correct value for block header with difficulty of 1", () => {
      const target = BigNumber.from(
        "26959535291011309493156476344723991336010898738574164086137773096960"
      )
      const expectedDifficulty = BigNumber.from("1")
      expect(targetToDifficulty(target)).to.equal(expectedDifficulty)
    })
  })
})
