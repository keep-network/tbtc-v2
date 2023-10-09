import { expect } from "chai"
import {
  BitcoinNetwork,
  BitcoinPublicKeyUtils,
  BitcoinLocktimeUtils,
  BitcoinHeader,
  BitcoinHeaderSerializer,
  BitcoinHashUtils,
  BitcoinTargetConverter,
  BitcoinCompactSizeUint,
  BitcoinAddressConverter,
  Hex,
  BitcoinScriptUtils,
} from "../src"
import { BigNumber } from "ethers"
import { btcAddresses, btcAddressFromPublicKey } from "./data/bitcoin"

describe("Bitcoin", () => {
  describe("BitcoinPublicKeyUtils", () => {
    const { compressPublicKey } = BitcoinPublicKeyUtils

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
  })

  describe("BitcoinHashUtils", () => {
    const { computeHash160, computeHash256, hashLEToBigNumber } =
      BitcoinHashUtils

    describe("computeHash160", () => {
      it("should compute hash160 correctly", () => {
        const compressedPublicKey =
          "03474444cca71c678f5019d16782b6522735717a94602085b4adf707b465c36ca8"
        const expectedHash160 = "3e1dfbd72483fb3964ca828ee71cf3270cafdc65"

        expect(computeHash160(compressedPublicKey)).to.be.equal(expectedHash160)
      })
    })

    describe("computeHash256", () => {
      it("should compute hash256 correctly", () => {
        const hexValue = Hex.from(
          "03474444cca71c678f5019d16782b6522735717a94602085b4adf707b465c36ca8"
        )
        const expectedHash256 = Hex.from(
          "9f0b7447ca6ea11b8badd8a60a4dec1b846451551ef455975b1720f52bc90546"
        )

        expect(computeHash256(hexValue).toString()).to.be.equal(
          expectedHash256.toString()
        )
      })
    })

    describe("hashLEToBigNumber", () => {
      it("calculates correct value", () => {
        const hash = Hex.from(
          "31552151fbef8e96a33f979e6253d29edf65ac31b04802319e00000000000000"
        )
        const expectedBigNumber = BigNumber.from(
          "992983769452983078390935942095592601503357651673709518345521"
        )
        expect(hashLEToBigNumber(hash)).to.equal(expectedBigNumber)
      })
    })
  })

  describe("BitcoinAddressConverter", () => {
    const publicKeyHash = "3a38d44d6a0c8d0bb84e0232cc632b7e48c72e0e"
    const P2WPKHAddress = "bc1q8gudgnt2pjxshwzwqgevccet0eyvwtswt03nuy"
    const P2PKHAddress = "16JrGhLx5bcBSA34kew9V6Mufa4aXhFe9X"
    const P2WPKHAddressTestnet = "tb1q8gudgnt2pjxshwzwqgevccet0eyvwtswpf2q8h"
    const P2PKHAddressTestnet = "mkpoZkRvtd3SDGWgUDuXK1aEXZfHRM2gKw"

    const {
      publicKeyToAddress,
      publicKeyHashToAddress,
      addressToPublicKeyHash,
      addressToOutputScript,
      outputScriptToAddress,
    } = BitcoinAddressConverter

    describe("publicKeyToAddress", () => {
      Object.entries(btcAddressFromPublicKey).forEach(
        ([bitcoinNetwork, addressData]) => {
          context(`with ${bitcoinNetwork} addresses`, () => {
            Object.entries(addressData).forEach(
              ([addressType, { publicKey, address }]) => {
                it(`should return correct ${addressType} address for ${bitcoinNetwork}`, () => {
                  const witness = addressType === "P2WPKH"
                  const result = publicKeyToAddress(
                    publicKey,
                    bitcoinNetwork === "mainnet"
                      ? BitcoinNetwork.Mainnet
                      : BitcoinNetwork.Testnet,
                    witness
                  )
                  expect(result).to.eq(address)
                })
              }
            )
          })
        }
      )
    })

    describe("publicKeyHashToAddress", () => {
      context("when network is mainnet", () => {
        context("when witness option is true", () => {
          context("when proper public key hash is provided", () => {
            it("should encode public key hash into bitcoin address properly", () => {
              expect(
                publicKeyHashToAddress(
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
                publicKeyHashToAddress(
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
                publicKeyHashToAddress(
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
                publicKeyHashToAddress(
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
                publicKeyHashToAddress(
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
                publicKeyHashToAddress(
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
                publicKeyHashToAddress(
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
                publicKeyHashToAddress(
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
            publicKeyHashToAddress(publicKeyHash, true, BitcoinNetwork.Unknown)
          ).to.throw("network not supported")
        })
      })
    })

    describe("addressToPublicKeyHash", () => {
      context("when network is mainnet", () => {
        context("when proper P2WPKH address is provided", () => {
          it("should decode P2WPKH adress correctly", () => {
            expect(addressToPublicKeyHash(P2WPKHAddress)).to.be.equal(
              publicKeyHash
            )
          })
        })

        context("when proper P2PKH address is provided", () => {
          it("should decode P2PKH address correctly", () => {
            expect(addressToPublicKeyHash(P2PKHAddress)).to.be.equal(
              publicKeyHash
            )
          })
        })

        context("when wrong address is provided", () => {
          it("should throw", () => {
            const bitcoinAddress = "123" + P2PKHAddress

            expect(() => addressToPublicKeyHash(bitcoinAddress)).to.throw(
              "Address is too long"
            )
          })
        })

        context("when unsupported P2SH address is provided", () => {
          it("should throw", () => {
            expect(() =>
              addressToPublicKeyHash("3EktnHQD7RiAE6uzMj2ZifT9YgRrkSgzQX")
            ).to.throw("Address must be P2PKH or P2WPKH")
          })
        })

        context("when unsupported P2WSH address is provided", () => {
          it("should throw", () => {
            expect(() =>
              addressToPublicKeyHash(
                "bc1qma629cu92skg0t86lftyaf9uflzwhp7jk63h6mpmv3ezh6puvdhsdxuv4m"
              )
            ).to.throw("Address must be P2PKH or P2WPKH")
          })
        })
      })

      context("when network is testnet", () => {
        context("when proper P2WPKH address is provided", () => {
          it("should decode P2WPKH adress correctly", () => {
            expect(addressToPublicKeyHash(P2WPKHAddressTestnet)).to.be.equal(
              publicKeyHash
            )
          })
        })

        context("when proper P2PKH address is provided", () => {
          it("should decode P2PKH address correctly", () => {
            expect(addressToPublicKeyHash(P2PKHAddressTestnet)).to.be.equal(
              publicKeyHash
            )
          })
        })

        context("when wrong address is provided", () => {
          it("should throw", () => {
            const bitcoinAddress = "123" + P2PKHAddressTestnet

            expect(() => addressToPublicKeyHash(bitcoinAddress)).to.throw(
              "Address is too long"
            )
          })
        })

        context("when unsupported P2SH address is provided", () => {
          it("should throw", () => {
            expect(() =>
              addressToPublicKeyHash("2MyxShnGQ5NifGb8CHYrtmzosRySxZ9pZo5")
            ).to.throw("Address must be P2PKH or P2WPKH")
          })
        })

        context("when unsupported P2WSH address is provided", () => {
          it("should throw", () => {
            expect(() =>
              addressToPublicKeyHash(
                "tb1qma629cu92skg0t86lftyaf9uflzwhp7jk63h6mpmv3ezh6puvdhs6w2r05"
              )
            ).to.throw("Address must be P2PKH or P2WPKH")
          })
        })
      })
    })

    describe("addressToOutputScript", () => {
      Object.keys(btcAddresses).forEach((bitcoinNetwork) => {
        context(`with ${bitcoinNetwork} addresses`, () => {
          Object.entries(
            btcAddresses[bitcoinNetwork as keyof typeof btcAddresses]
          ).forEach(
            ([
              addressType,
              { address, scriptPubKey: expectedOutputScript },
            ]) => {
              it(`should create correct output script for ${addressType} address type`, () => {
                const result = addressToOutputScript(address)

                expect(result.toString()).to.eq(expectedOutputScript.toString())
              })
            }
          )
        })
      })
    })

    describe("outputScriptToAddress", () => {
      Object.keys(btcAddresses).forEach((bitcoinNetwork) => {
        context(`with ${bitcoinNetwork} addresses`, () => {
          Object.entries(
            btcAddresses[bitcoinNetwork as keyof typeof btcAddresses]
          ).forEach(([addressType, { address, scriptPubKey }]) => {
            it(`should return correct ${addressType} address`, () => {
              const result = outputScriptToAddress(
                scriptPubKey,
                bitcoinNetwork === "mainnet"
                  ? BitcoinNetwork.Mainnet
                  : BitcoinNetwork.Testnet
              )

              expect(result.toString()).to.eq(address)
            })
          })
        })
      })
    })
  })

  describe("BitcoinLocktimeUtils", () => {
    const { locktimeToNumber, calculateLocktime } = BitcoinLocktimeUtils

    describe("locktimeToNumber", () => {
      const locktimeStartedAt: number = 1640181600
      const locktimeDuration: number = 2592000
      const locktime = BitcoinLocktimeUtils.calculateLocktime(
        locktimeStartedAt,
        locktimeDuration
      )

      const testData = [
        {
          contextName: "when locktime is a block height",
          unprefixedHex: "ede80600",
          expectedLocktime: 452845,
        },
        {
          contextName: "when locktime is a timestamp",
          unprefixedHex: "06241559",
          expectedLocktime: 1494557702,
        },
        {
          contextName: "for locktime",
          unprefixedHex: locktime,
          expectedLocktime: locktimeStartedAt + locktimeDuration,
        },
      ]

      testData.forEach((test) => {
        context(test.contextName, () => {
          context("when input is non-prefixed hex string", () => {
            it("should return the locktime in seconds", async () => {
              expect(locktimeToNumber(test.unprefixedHex)).to.be.equal(
                test.expectedLocktime
              )
            })
          })

          context("when input is 0x prefixed hex string", () => {
            it("should return the locktime in seconds", async () => {
              expect(locktimeToNumber("0x" + test.unprefixedHex)).to.be.equal(
                test.expectedLocktime
              )
            })
          })

          context("when input is Buffer object", () => {
            it("should return the locktime in seconds", async () => {
              expect(
                locktimeToNumber(Buffer.from(test.unprefixedHex, "hex"))
              ).to.be.equal(test.expectedLocktime)
            })
          })
        })
      })
    })

    describe("calculateLocktime", () => {
      context("when the resulting locktime is lesser than 4 bytes", () => {
        it("should throw", () => {
          // This will result with 2592001 as the locktime which is a 3-byte number.
          expect(() => calculateLocktime(1, 2592000)).to.throw(
            "Locktime must be a 4 bytes number"
          )
        })
      })

      context("when the resulting locktime is greater than 4 bytes", () => {
        it("should throw", () => {
          // This will result with 259200144444 as the locktime which is a 5-byte number.
          expect(() => calculateLocktime(259197552444, 2592000)).to.throw(
            "Locktime must be a 4 bytes number"
          )
        })
      })

      context("when the resulting locktime is a 4-byte number", () => {
        it("should compute a proper 4-byte little-endian locktime as un-prefixed hex string", () => {
          const locktimeStartedAt = 1652776752

          const locktime = calculateLocktime(locktimeStartedAt, 2592000)

          // The start timestamp is 1652776752 and locktime duration 2592000 (30 days).
          // So, the locktime timestamp is 1652776752 + 2592000 = 1655368752 which
          // is represented as 30ecaa62 hex in the little-endian format.
          expect(locktime).to.be.equal("30ecaa62")
        })
      })
    })
  })

  describe("BitcoinHeaderSerializer", () => {
    const { serializeHeader, deserializeHeader } = BitcoinHeaderSerializer

    describe("serializeHeader", () => {
      it("calculates correct value", () => {
        const blockHeader: BitcoinHeader = {
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

        expect(serializeHeader(blockHeader)).to.be.deep.equal(
          expectedSerializedBlockHeader
        )
      })
    })

    describe("deserializeHeader", () => {
      it("calculates correct value", () => {
        const rawBlockHeader = Hex.from(
          "04000020a5a3501e6ba1f3e2a1ee5d29327a549524ed33f272dfef30004566000000" +
            "0000e27d241ca36de831ab17e6729056c14a383e7a3f43d56254f846b496497751" +
            "12939edd612ac0001abbaa602e"
        )

        const expectedBlockHeader: BitcoinHeader = {
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

        expect(deserializeHeader(rawBlockHeader)).to.deep.equal(
          expectedBlockHeader
        )
      })
    })
  })

  describe("BitcoinTargetConverter", () => {
    const { bitsToTarget, targetToDifficulty } = BitcoinTargetConverter

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

  describe("BitcoinCompactSizeUint", () => {
    const { read } = BitcoinCompactSizeUint

    describe("read", () => {
      context("when the compact size uint is 1-byte", () => {
        it("should return the the uint value and byte length", () => {
          expect(read(Hex.from("bb"))).to.be.eql({
            value: 187,
            byteLength: 1,
          })
        })
      })

      context("when the compact size uint is 3-byte", () => {
        it("should throw", () => {
          expect(() => read(Hex.from("fd0302"))).to.throw(
            "support for 3, 5 and 9 bytes compact size uints is not implemented yet"
          )
        })
      })

      context("when the compact size uint is 5-byte", () => {
        it("should throw", () => {
          expect(() => read(Hex.from("fe703a0f00"))).to.throw(
            "support for 3, 5 and 9 bytes compact size uints is not implemented yet"
          )
        })
      })

      context("when the compact size uint is 9-byte", () => {
        it("should throw", () => {
          expect(() => {
            return read(Hex.from("ff57284e56dab40000"))
          }).to.throw(
            "support for 3, 5 and 9 bytes compact size uints is not implemented yet"
          )
        })
      })
    })
  })

  describe("BitcoinScriptUtils", () => {
    const { isP2PKHScript, isP2WPKHScript, isP2SHScript, isP2WSHScript } =
      BitcoinScriptUtils

    describe("isScript", () => {
      const testData = [
        {
          testFunction: isP2PKHScript,
          validScript: Buffer.from(
            "76a9148db50eb52063ea9d98b3eac91489a90f738986f688ac",
            "hex"
          ),
          name: "P2PKH",
        },
        {
          testFunction: isP2WPKHScript,
          validScript: Buffer.from(
            "00148db50eb52063ea9d98b3eac91489a90f738986f6",
            "hex"
          ),
          name: "P2WPKH",
        },
        {
          testFunction: isP2SHScript,
          validScript: Buffer.from(
            "a914a9a5f97d5d3c4687a52e90718168270005b369c487",
            "hex"
          ),
          name: "P2SH",
        },
        {
          testFunction: isP2WSHScript,
          validScript: Buffer.from(
            "0020b1f83e226979dc9fe74e87f6d303dbb08a27a1c7ce91664033f34c7f2d214cd7",
            "hex"
          ),
          name: "P2WSH",
        },
      ]

      testData.forEach(({ testFunction, validScript, name }) => {
        describe(`is${name}Script`, () => {
          it(`should return true for a valid ${name} script`, () => {
            expect(testFunction(validScript)).to.be.true
          })

          it("should return false for other scripts", () => {
            testData.forEach((data) => {
              if (data.name !== name) {
                expect(testFunction(data.validScript)).to.be.false
              }
            })
          })
        })
      })
    })
  })
})
