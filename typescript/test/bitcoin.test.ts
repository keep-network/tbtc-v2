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
  createOutputScriptFromAddress,
  createAddressFromOutputScript,
  createAddressFromPublicKey,
  readCompactSizeUint,
  computeHash160,
  computeSha256,
  computeHash256,
  isP2PKHScript,
  isP2WPKHScript,
  isP2SHScript,
  isP2WSHScript,
  txToJSON,
  decomposeRawTransaction,
} from "../src/bitcoin"
import { calculateDepositRefundLocktime } from "../src/deposit"
import { BitcoinNetwork } from "../src/bitcoin-network"
import { Hex } from "../src/hex"
import { BigNumber } from "ethers"
import {
  btcAddresses,
  btcAddressFromPublicKey,
  mainnetTransaction,
  testnetTransaction,
} from "./data/bitcoin"
import { depositSweepWithNoMainUtxoAndWitnessOutput } from "./data/deposit-sweep"

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

  describe("computeSha256", () => {
    it("should compute hash256 correctly", () => {
      const hexValue = Hex.from(
        "03474444cca71c678f5019d16782b6522735717a94602085b4adf707b465c36ca8"
      )
      const expectedSha256 = Hex.from(
        "c62e5cb26c97cb52fea7f9965e9ea1f8d41c97773688aa88674e64629fc02901"
      )

      expect(computeSha256(hexValue).toString()).to.be.equal(
        expectedSha256.toString()
      )
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
              ).to.throw(
                'Expected property "hash" of type Buffer(Length: 20), got ' +
                  "Buffer(Length: 21)"
              )
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
              ).to.throw(
                'Expected property "hash" of type Buffer(Length: 20), got ' +
                  "Buffer(Length: 21)"
              )
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
              ).to.throw(
                'Expected property "hash" of type Buffer(Length: 20), got ' +
                  "Buffer(Length: 21)"
              )
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
              ).to.throw(
                'Expected property "hash" of type Buffer(Length: 20), got ' +
                  "Buffer(Length: 21)"
              )
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

    describe("decodeBitcoinAddress", () => {
      context("when network is mainnet", () => {
        context("when proper P2WPKH address is provided", () => {
          it("should decode P2WPKH adress correctly", () => {
            expect(
              decodeBitcoinAddress(P2WPKHAddress, BitcoinNetwork.Mainnet)
            ).to.be.equal(publicKeyHash)
          })
        })

        context("when proper P2PKH address is provided", () => {
          it("should decode P2PKH address correctly", () => {
            expect(
              decodeBitcoinAddress(P2PKHAddress, BitcoinNetwork.Mainnet)
            ).to.be.equal(publicKeyHash)
          })
        })

        context("when wrong address is provided", () => {
          it("should throw", () => {
            const bitcoinAddress = "123" + P2PKHAddress

            expect(() =>
              decodeBitcoinAddress(bitcoinAddress, BitcoinNetwork.Mainnet)
            ).to.throw(
              "Address must be P2PKH or P2WPKH valid for given network"
            )
          })
        })

        context("when unsupported P2SH address is provided", () => {
          it("should throw", () => {
            expect(() =>
              decodeBitcoinAddress(
                "3EktnHQD7RiAE6uzMj2ZifT9YgRrkSgzQX",
                BitcoinNetwork.Mainnet
              )
            ).to.throw(
              "Address must be P2PKH or P2WPKH valid for given network"
            )
          })
        })

        context("when unsupported P2WSH address is provided", () => {
          it("should throw", () => {
            expect(() =>
              decodeBitcoinAddress(
                "bc1qma629cu92skg0t86lftyaf9uflzwhp7jk63h6mpmv3ezh6puvdhsdxuv4m",
                BitcoinNetwork.Mainnet
              )
            ).to.throw(
              "Address must be P2PKH or P2WPKH valid for given network"
            )
          })
        })

        context("when address from testnet network is provided", () => {
          it("should throw", () => {
            expect(() =>
              decodeBitcoinAddress(
                "mkpoZkRvtd3SDGWgUDuXK1aEXZfHRM2gKw",
                BitcoinNetwork.Mainnet
              )
            ).to.throw(
              "Address must be P2PKH or P2WPKH valid for given network"
            )
          })
        })
      })

      context("when network is testnet", () => {
        context("when proper P2WPKH address is provided", () => {
          it("should decode P2WPKH adress correctly", () => {
            expect(
              decodeBitcoinAddress(P2WPKHAddressTestnet, BitcoinNetwork.Testnet)
            ).to.be.equal(publicKeyHash)
          })
        })

        context("when proper P2PKH address is provided", () => {
          it("should decode P2PKH address correctly", () => {
            expect(
              decodeBitcoinAddress(P2PKHAddressTestnet, BitcoinNetwork.Testnet)
            ).to.be.equal(publicKeyHash)
          })
        })

        context("when wrong address is provided", () => {
          it("should throw", () => {
            const bitcoinAddress = "123" + P2PKHAddressTestnet

            expect(() =>
              decodeBitcoinAddress(bitcoinAddress, BitcoinNetwork.Testnet)
            ).to.throw(
              "Address must be P2PKH or P2WPKH valid for given network"
            )
          })
        })

        context("when unsupported P2SH address is provided", () => {
          it("should throw", () => {
            expect(() =>
              decodeBitcoinAddress(
                "2MyxShnGQ5NifGb8CHYrtmzosRySxZ9pZo5",
                BitcoinNetwork.Testnet
              )
            ).to.throw(
              "Address must be P2PKH or P2WPKH valid for given network"
            )
          })
        })

        context("when unsupported P2WSH address is provided", () => {
          it("should throw", () => {
            expect(() =>
              decodeBitcoinAddress(
                "tb1qma629cu92skg0t86lftyaf9uflzwhp7jk63h6mpmv3ezh6puvdhs6w2r05",
                BitcoinNetwork.Testnet
              )
            ).to.throw(
              "Address must be P2PKH or P2WPKH valid for given network"
            )
          })
        })

        context("when address from mainnet network is provided", () => {
          it("should throw", () => {
            expect(() =>
              decodeBitcoinAddress(
                "bc1q8gudgnt2pjxshwzwqgevccet0eyvwtswt03nuy",
                BitcoinNetwork.Testnet
              )
            ).to.throw(
              "Address must be P2PKH or P2WPKH valid for given network"
            )
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
      const hash = Hex.from(
        "31552151fbef8e96a33f979e6253d29edf65ac31b04802319e00000000000000"
      )
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

  describe("createOutputScriptFromAddress", () => {
    Object.keys(btcAddresses).forEach((bitcoinNetwork) => {
      context(`with ${bitcoinNetwork} addresses`, () => {
        Object.entries(
          btcAddresses[bitcoinNetwork as keyof typeof btcAddresses]
        ).forEach(
          ([addressType, { address, scriptPubKey: expectedOutputScript }]) => {
            it(`should create correct output script for ${addressType} address type`, () => {
              const network =
                bitcoinNetwork === "mainnet"
                  ? BitcoinNetwork.Mainnet
                  : BitcoinNetwork.Testnet
              const result = createOutputScriptFromAddress(address, network)

              expect(result.toString()).to.eq(expectedOutputScript.toString())
            })
          }
        )
      })
    })
  })

  describe("createAddressFromOutputScript", () => {
    Object.keys(btcAddresses).forEach((bitcoinNetwork) => {
      context(`with ${bitcoinNetwork} addresses`, () => {
        Object.entries(
          btcAddresses[bitcoinNetwork as keyof typeof btcAddresses]
        ).forEach(([addressType, { address, scriptPubKey }]) => {
          it(`should return correct ${addressType} address`, () => {
            const result = createAddressFromOutputScript(
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

  describe("createAddressFromPublicKey", () => {
    Object.entries(btcAddressFromPublicKey).forEach(
      ([bitcoinNetwork, addressData]) => {
        context(`with ${bitcoinNetwork} addresses`, () => {
          Object.entries(addressData).forEach(
            ([addressType, { publicKey, address }]) => {
              it(`should return correct ${addressType} address for ${bitcoinNetwork}`, () => {
                const witness = addressType === "P2WPKH"
                const result = createAddressFromPublicKey(
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

  describe("readCompactSizeUint", () => {
    context("when the compact size uint is 1-byte", () => {
      it("should return the the uint value and byte length", () => {
        expect(readCompactSizeUint(Hex.from("bb"))).to.be.eql({
          value: 187,
          byteLength: 1,
        })
      })
    })

    context("when the compact size uint is 3-byte", () => {
      it("should throw", () => {
        expect(() => readCompactSizeUint(Hex.from("fd0302"))).to.throw(
          "support for 3, 5 and 9 bytes compact size uints is not implemented yet"
        )
      })
    })

    context("when the compact size uint is 5-byte", () => {
      it("should throw", () => {
        expect(() => readCompactSizeUint(Hex.from("fe703a0f00"))).to.throw(
          "support for 3, 5 and 9 bytes compact size uints is not implemented yet"
        )
      })
    })

    context("when the compact size uint is 9-byte", () => {
      it("should throw", () => {
        expect(() => {
          return readCompactSizeUint(Hex.from("ff57284e56dab40000"))
        }).to.throw(
          "support for 3, 5 and 9 bytes compact size uints is not implemented yet"
        )
      })
    })
  })

  describe("Bitcoin Script Type", () => {
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

describe("txToJSON", () => {
  context("when network is mainnet", () => {
    it("should return correct transaction JSON", () => {
      const txJSON = txToJSON(mainnetTransaction, BitcoinNetwork.Mainnet)

      expect(txJSON.hash).to.be.equal(
        "bb20b27fef136ab1e5ee866a73bc9b33a038c3e258162e6c03e94f6e22941e0e"
      )
      expect(txJSON.version).to.be.equal(1)
      expect(txJSON.locktime).to.be.equal(0)

      expect(txJSON.inputs.length).to.be.equal(1)
      expect(txJSON.inputs[0].hash).to.be.equal(
        "a4082d137ab5c5264efb9f616ca4ac1673015c1e0817cd5cdc1b0379161be95e"
      )
      expect(txJSON.inputs[0].index).to.be.equal(5)
      expect(txJSON.inputs[0].sequence).to.be.equal(4294967295)
      expect(txJSON.inputs[0].script).to.be.equal("")
      expect(txJSON.inputs[0].witness).to.deep.equal([
        "",
        "3044022022c7d7546fc0bb96a26c04823d97f0aa4bbe5d9af54acc8f4bd898e88" +
          "b86956002206b126720f42b2f200434c6ae770b78aded9b32da4f020aba37f099" +
          "d804eab02701",
        "304402202b60c2ef3ba68eb473b65564e0fd038884407dc684c98309e3141bb53" +
          "233dfd7022078d14fb2e433c71c6c62bd2019dd83859173a3b6973c62444930c1" +
          "5d86d4bd1601",
        "52210375e00eb72e29da82b89367947f29ef34afb75e8654f6ea368e0acdfd929" +
          "76b7c2103a1b26313f430c4b15bb1fdce663207659d8cac749a0e53d70eff0187" +
          "4496feff2103c96d495bfdd5ba4145e3e046fee45e84a8a48ad05bd8dbb395c01" +
          "1a32cf9f88053ae",
      ])

      expect(txJSON.outputs.length).to.be.equal(2)
      expect(txJSON.outputs[0].value).to.be.equal(11991850)
      expect(txJSON.outputs[0].script).to.be.equal(
        "76a914ee4b7569e9063064323332ad07dd18bc32402a0c88ac"
      )
      expect(txJSON.outputs[0].address).to.be.equal(
        "1NizDcdk2mWE45yZr98JJ2dyi2W2zeZUn5"
      )
      expect(txJSON.outputs[1].value).to.be.equal(1805173)
      expect(txJSON.outputs[1].script).to.be.equal(
        "0020701a8d401c84fb13e6baf169d59684e17abd9fa216c8cc5b9fc63d622ff8c58d"
      )
      expect(txJSON.outputs[1].address).to.be.equal(
        "bc1qwqdg6squsna38e46795at95yu9atm8azzmyvckulcc7kytlcckxswvvzej"
      )
    })
  })

  context("when network is testnet", () => {
    it("should return correct transaction JSON", () => {
      const txJSON = txToJSON(testnetTransaction, BitcoinNetwork.Testnet)

      expect(txJSON.hash).to.be.equal(
        "873effe868161e09ab65e1a23c7cecdc2792995c90ec94973f2fdbc59728ba89"
      )
      expect(txJSON.version).to.be.equal(1)
      expect(txJSON.locktime).to.be.equal(0)

      expect(txJSON.inputs.length).to.be.equal(1)
      expect(txJSON.inputs[0].hash).to.be.equal(
        "c0a5ed42f574b4b969ef0df16a70edb60d4a464739c5011bc051a8dedbaab730"
      )
      expect(txJSON.inputs[0].index).to.be.equal(0)
      expect(txJSON.inputs[0].sequence).to.be.equal(4294967295)
      expect(txJSON.inputs[0].script).to.be.equal(
        "4830450221009ab9ba3a4c9d81c4ac4431c05eac57388c8332bb191507926a3424" +
          "ec697ac23802203369c91742a7d5168ba3af429aed4f2d1022749a4ba5052b172b" +
          "b6776d9a07c1012103548c7fe1d7a66f8e705a4299153b87f4874c80aaed2cf828" +
          "cd552d6975a01b80"
      )
      expect(txJSON.inputs[0].witness).to.deep.equal([])

      expect(txJSON.outputs.length).to.be.equal(1)
      expect(txJSON.outputs[0].value).to.be.equal(270150)
      expect(txJSON.outputs[0].script).to.be.equal(
        "76a914819850140920deeacfee3a63193807daea8fc5d288ac"
      )
      expect(txJSON.outputs[0].address).to.be.equal(
        "msLBvgMp45BN9CaQCoZ4ewjm71Fix7RgB2"
      )
    })
  })
})

describe("decomposeRawTransaction", () => {
  it("should return correctly decomposed transaction", () => {
    const rawTransaction =
      depositSweepWithNoMainUtxoAndWitnessOutput.expectedSweep.transaction
    const decomposedTransaction = decomposeRawTransaction(rawTransaction)

    expect(decomposedTransaction.version).to.be.equal("01000000")
    expect(decomposedTransaction.inputs).to.be.equal(
      "02bc187be612bc3db8cfcdec56b75e9bc0262ab6eacfe27cc1a699bacd53e3d07400" +
        "000000c948304502210089a89aaf3fec97ac9ffa91cdff59829f0cb3ef852a468153" +
        "e2c0e2b473466d2e022072902bb923ef016ac52e941ced78f816bf27991c2b73211e" +
        "227db27ec200bc0a012103989d253b17a6a0f41838b84ff0d20e8898f9d7b1a98f25" +
        "64da4cc29dcf8581d94c5c14934b98637ca318a4d6e7ca6ffd1690b8e77df6377508" +
        "f9f0c90d000395237576a9148db50eb52063ea9d98b3eac91489a90f738986f68763" +
        "ac6776a914e257eccafbc07c381642ce6e7e55120fb077fbed8804e0250162b175ac" +
        "68ffffffffdc557e737b6688c5712649b86f7757a722dc3d42786f23b2fa826394df" +
        "ec545c0000000000ffffffff"
    )
    expect(decomposedTransaction.outputs).to.be.equal(
      "01488a0000000000001600148db50eb52063ea9d98b3eac91489a90f738986f6"
    )
    expect(decomposedTransaction.locktime).to.be.equal("00000000")
  })
})
