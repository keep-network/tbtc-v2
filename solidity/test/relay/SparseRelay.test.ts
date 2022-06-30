/* eslint-disable no-underscore-dangle */
/* eslint-disable @typescript-eslint/no-unused-expressions */

import { ethers, helpers, waffle } from "hardhat"
import { SignerWithAddress } from "@nomiclabs/hardhat-ethers/signers"
import { expect } from "chai"
import { ContractTransaction } from "ethers"

import type { SparseRelayStub } from "../../typechain"

import { concatenateHexStrings } from "../helpers/contract-test-helpers"

import headers from "./longHeaders.json"
import reorgHeaders from "./headersReorgAndRetarget.json"

const { createSnapshot, restoreSnapshot } = helpers.snapshot

const epochStart = headers.epochStart
const genesis = headers.chain[0]

const epochStartBlock = 739872
const retargetBlock = 741888
const headerStart = 741798
const headerHex = headers.chain.map((h) => h.hex)
const genesisEpoch = 367
const genesisDifficulty = 30283293547736
const nextDifficulty = 29570168636357

const fixture = async () => {
  const [deployer, governance, thirdParty] = await ethers.getSigners()

  const Relay = await ethers.getContractFactory("SparseRelayStub")
  const relay = await Relay.deploy()
  await relay.deployed()

  await relay.connect(deployer).transferOwnership(governance.address)

  return {
    deployer,
    governance,
    thirdParty,
    relay,
  }
}

describe.only("SparseRelay", () => {
  let governance: SignerWithAddress

  let thirdParty: SignerWithAddress

  let relay: SparseRelayStub

  before(async () => {
    // eslint-disable-next-line @typescript-eslint/no-extra-semi
    ;({ governance, thirdParty, relay } = await waffle.loadFixture(fixture))
  })

  //
  // genesis
  //
  describe("genesis", () => {
    before(async () => {
      await createSnapshot()
    })

    after(async () => {
      await restoreSnapshot()
    })

    context("when called with valid inputs", () => {
      let tx: ContractTransaction

      before(async () => {
        await createSnapshot()
        tx = await relay
          .connect(governance)
          .genesis(epochStart.hex, genesis.hex, genesis.height)
      })

      after(async () => {
        await restoreSnapshot()
      })

      // it("should record the relay as ready for use", async () => {
      //   expect(await relay.ready()).to.be.true
      // })

      // it("should emit the Genesis event", async () => {
      //   await expect(tx).to.emit(relay, "Genesis").withArgs(genesisHeight)
      // })

      it("should record the genesis height correctly", async () => {
        expect(await relay.getHeight()).to.equal(
          genesis.height
        )
      })
    })

    context("when called with invalid block height", () => {
      it("should revert", async () => {
        await expect(
          relay
            .connect(governance)
            .genesis(epochStart.hex, genesis.hex, genesis.height + 1)
        ).to.be.revertedWith("Genesis block height invalid")
      })
    })

    context("when called with invalid header data", () => {
      it("should revert", async () => {
        await expect(
          relay
            .connect(governance)
            .genesis("0xdeadbeef", genesis.hex, genesis.height)
        ).to.be.revertedWith("Invalid header length")
      })

      it("should revert", async () => {
        await expect(
          relay
            .connect(governance)
            .genesis(epochStart.hex, "0xbad0da7a", genesis.height)
        ).to.be.revertedWith("Invalid header length")
      })
    })

    context("when called by anyone other than governance", () => {
      it("should revert", async () => {
        await expect(
          relay
            .connect(thirdParty)
            .genesis(epochStart.hex, genesis.hex, genesis.height)
        ).to.be.revertedWith("Ownable: caller is not the owner")
      })
    })

    context("when called more than once", () => {
      it("should revert", async () => {
        await relay
          .connect(governance)
          .genesis(epochStart.hex, genesis.hex, genesis.height)

        await expect(
          relay.connect(governance).genesis(epochStart.hex, genesis.hex, genesis.height)
        ).to.be.revertedWith("Relay already initialised")
      })
    })
  })
  //
  // end genesis
  //

  //
  // addHeaders
  //
  describe("addHeaders", () => {
    const { chain } = headers
    const headerHex = chain.map((header) => header.hex)

    before(async () => {
      await createSnapshot()
    })

    after(async () => {
      await restoreSnapshot()
    })

    
    context("when called before genesis", () => {
      const newHeaders = concatenateHexStrings(headerHex.slice(0, 7))

      it("should revert", async () => {
        await expect(relay.addHeaders(newHeaders)).to.be.revertedWith(
          "Relay is not initialised"
        )
      })
    })

    context("after genesis (block 741798)", () => {
      before(async () => {
        await createSnapshot()
        await relay.connect(governance).genesis(epochStart.hex, genesis.hex, genesis.height)
      })

      after(async () => {
        await restoreSnapshot()
      })

      context("when called correctly", () => {
        let tx: ContractTransaction
        const newHeaders = concatenateHexStrings(headerHex.slice(0, 7))

        before(async () => {
          await createSnapshot()
          tx = await relay.addHeaders(newHeaders)
        })

        after(async () => {
          await restoreSnapshot()
        })

        it("should store the new height", async () => {
          expect(await relay.getHeight()).to.equal(
            741804
          )
        })

      //   it("should emit the Retarget event", async () => {
      //     await expect(tx)
      //       .to.emit(relay, "Retarget")
      //       .withArgs(genesisDifficulty, nextDifficulty)
      //   })
      })

      context("when called with many headers", () => {
        let tx: ContractTransaction
        const newHeaders = concatenateHexStrings(headerHex.slice(0, 19))

        before(async () => {
          await createSnapshot()
          tx = await relay.addHeaders(newHeaders)
        })

        after(async () => {
          await restoreSnapshot()
        })

        it("should store the new height", async () => {
          expect(await relay.getHeight()).to.equal(
            741816
          )
        })

      //   it("should emit the Retarget event", async () => {
      //     await expect(tx)
      //       .to.emit(relay, "Retarget")
      //       .withArgs(genesisDifficulty, nextDifficulty)
      //   })
      })

      context("with incorrect number of headers", () => {
        const newHeaders = concatenateHexStrings(headerHex.slice(0, 6))
        it("should revert", async () => {
          await expect(
            relay.addHeaders(newHeaders)
          ).to.be.revertedWith("Invalid number of headers")
        })
      })

      context("with invalid ancestor", () => {
        const newHeaders = concatenateHexStrings(headerHex.slice(1, 8))
        it("should revert", async () => {
          await expect(
            relay.addHeaders(newHeaders)
          ).to.be.revertedWith("Ancestor not recorded in relay")
        })
      })

      context("with ancestor that isn't the most recent one", () => {
        const newHeaders = concatenateHexStrings(headerHex.slice(0, 7))
        const newerHeaders = concatenateHexStrings(headerHex.slice(0, 13))

        it("should revert", async () => {
          await relay.addHeaders(newHeaders)
          await expect(
            relay.addHeaders(newerHeaders)
          ).to.be.revertedWith("Invalid ancestor block")
        })
      })
    })

    context("after genesis (block 741876)", () => {
      const lateGenesis = headers.chain[78]

      before(async () => {
        await createSnapshot()
        await relay.connect(governance).genesis(epochStart.hex, lateGenesis.hex, lateGenesis.height)
      })

      after(async () => {
        await restoreSnapshot()
      })

      context("when called correctly", () => {
        let tx: ContractTransaction
        const newHeaders = concatenateHexStrings(headerHex.slice(78, 85))

        before(async () => {
          await createSnapshot()
          tx = await relay.addHeaders(newHeaders)
        })

        after(async () => {
          await restoreSnapshot()
        })

        it("should store the new height", async () => {
          expect(await relay.getHeight()).to.equal(
            741882
          )
        })

      //   it("should emit the Retarget event", async () => {
      //     await expect(tx)
      //       .to.emit(relay, "Retarget")
      //       .withArgs(genesisDifficulty, nextDifficulty)
      //   })
      })

      context("when called with many headers, including a retarget", () => {
        let tx: ContractTransaction
        const newHeaders = concatenateHexStrings(headerHex.slice(78, 97))

        before(async () => {
          await createSnapshot()
          tx = await relay.addHeaders(newHeaders)
        })

        after(async () => {
          await restoreSnapshot()
        })

        it("should store the new height", async () => {
          expect(await relay.getHeight()).to.equal(
            741894
          )
        })

      //   it("should emit the Retarget event", async () => {
      //     await expect(tx)
      //       .to.emit(relay, "Retarget")
      //       .withArgs(genesisDifficulty, nextDifficulty)
      //   })
      })
    })

    context("after genesis (block 741876) with invalid epoch start", () => {
      const lateGenesis = headers.chain[78]

      before(async () => {
        await createSnapshot()
        await relay.connect(governance).genesis(genesis.hex, lateGenesis.hex, lateGenesis.height)
      })

      after(async () => {
        await restoreSnapshot()
      })

      context("when called with many headers, including a retarget", () => {
        const newHeaders = concatenateHexStrings(headerHex.slice(78, 97))

        it("should revert", async () => {
          await expect(
            relay.addHeaders(newHeaders)
          ).to.be.revertedWith("Invalid target")
        })
      })
    })

    context("after genesis with invalid height (block 741875, reported as 741876)", () => {
      const badGenesis = headers.chain[77]

      before(async () => {
        await createSnapshot()
        await relay.connect(governance).genesis(epochStart.hex, badGenesis.hex, badGenesis.height + 1)
      })

      after(async () => {
        await restoreSnapshot()
      })

      context("when called with many headers, including a retarget", () => {
        const newHeaders = concatenateHexStrings(headerHex.slice(77, 96))

        it("should revert", async () => {
          await expect(
            relay.addHeaders(newHeaders)
          ).to.be.revertedWith("Invalid target")
        })
      })
    })

    context("after genesis with invalid height (block 741877, reported as 741876)", () => {
      const badGenesis = headers.chain[79]

      before(async () => {
        await createSnapshot()
        await relay.connect(governance).genesis(epochStart.hex, badGenesis.hex, badGenesis.height - 1)
      })

      after(async () => {
        await restoreSnapshot()
      })

      context("when called with many headers, including a retarget", () => {
        const newHeaders = concatenateHexStrings(headerHex.slice(79, 98))

        it("should revert", async () => {
          await expect(
            relay.addHeaders(newHeaders)
          ).to.be.revertedWith("Invalid target")
        })
      })
    })
  })
  //
  // end addHeaders
  //

  //
  // validate
  //
  describe("validateChain", () => {
    before(async () => {
      await createSnapshot()
    })

    after(async () => {
      await restoreSnapshot()
    })

    /*
    context("when called before genesis", () => {
      const { chain } = headers
      const headerHex = chain.map((header) => header.hex)
      const proofHeaders = concatenateHexStrings(headerHex.slice(0, 4))

      it("should revert", async () => {
        await expect(relay.validateChain(proofHeaders)).to.be.revertedWith(
          "Relay is not ready for use"
        )
      })
    })

    context("when called after genesis (epoch 274)", () => {
      const { chain } = headers
      const headerHex = chain.map((header) => header.hex)

      before(async () => {
        await createSnapshot()
        await relay.connect(governance).genesis(genesisHeader, genesisHeight, 4)
      })

      after(async () => {
        await restoreSnapshot()
      })

      it("should accept valid header chains", async () => {
        const proofHeaders = concatenateHexStrings(headerHex.slice(0, 4))
        const res = await relay.validateChain(proofHeaders)
        expect(res[0]).to.be.above(0)
      })

      it("should accept short header chains", async () => {
        const proofHeaders = concatenateHexStrings(headerHex.slice(0, 3))

        const res = await relay.validateChain(proofHeaders)
        expect(res[0]).to.be.above(0)
      })

      it("should accept long header chains", async () => {
        const proofHeaders = concatenateHexStrings(headerHex.slice(0, 9))

        const res = await relay.validateChain(proofHeaders)
        expect(res[0]).to.be.above(0)
      })

      it("should reject single headers", async () => {
        await expect(relay.validateChain(headerHex[0])).to.be.revertedWith(
          "Invalid number of headers"
        )
      })

      it("should reject header chains with an unknown retarget", async () => {
        const proofHeaders = concatenateHexStrings(headerHex.slice(6, 10))

        await expect(relay.validateChain(proofHeaders)).to.be.revertedWith(
          "Invalid target in header chain"
        )
      })

      it("should reject header chains in a future epoch", async () => {
        const proofHeaders = concatenateHexStrings(headerHex.slice(9, 13))

        await expect(relay.validateChain(proofHeaders)).to.be.revertedWith(
          "Invalid target in header chain"
        )
      })
    })

    context("when called after genesis (epoch 275)", () => {
      const { chain } = headers
      const headerHex = chain.map((header) => header.hex)

      before(async () => {
        await createSnapshot()
        await relay
          .connect(governance)
          .genesis(nextStartHeader, nextEpochHeight, 4)
      })

      after(async () => {
        await restoreSnapshot()
      })

      it("should accept valid header chains", async () => {
        const proofHeaders = concatenateHexStrings(headerHex.slice(9, 13))
        const res = await relay.validateChain(proofHeaders)
        expect(res[0]).to.be.above(0)
      })

      it("should reject header chains partially in a past epoch", async () => {
        const proofHeaders = concatenateHexStrings(headerHex.slice(8, 12))

        await expect(relay.validateChain(proofHeaders)).to.be.revertedWith(
          "Cannot validate chains before relay genesis"
        )
      })

      it("should reject header chains fully in a past epoch", async () => {
        const proofHeaders = concatenateHexStrings(headerHex.slice(5, 9))

        await expect(relay.validateChain(proofHeaders)).to.be.revertedWith(
          "Cannot validate chains before relay genesis"
        )
      })
    })

    context("when called after a retarget", () => {
      const { chain } = headers
      const headerHex = chain.map((header) => header.hex)
      const retargetHeaders = concatenateHexStrings(headerHex.slice(5, 13))

      before(async () => {Chain
        await relay.connect(governance).genesis(genesisHeader, genesisHeight, 4)
        await relay.connect(thirdParty).retarget(retargetHeaders)
      })

      after(async () => {
        await restoreSnapshot()
      })

      context("in the genesis epoch", () => {
        it("should accept valid header chains", async () => {
          const proofHeaders = concatenateHexStrings(headerHex.slice(0, 4))
          const res = await relay.validateChain(proofHeaders)
          expect(res[0]).to.be.above(0)Chain
          expect(res[0]).to.be.above(0)
        })

        it("should accept valid header chains (2 before, 2 after)", async () => {
          const proofHeaders = concatenateHexStrings(headerHex.slice(7, 11))
          const res = await relay.validateChain(proofHeaders)
          expect(res[0]).to.be.above(0)
        })

        it("should accept valid header chains (1 before, 3 after)", async () => {
          const proofHeaders = concatenateHexStrings(headerHex.slice(8, 12))
          const res = await relay.validateChain(proofHeaders)
          expect(res[0]).to.be.above(0)
        })
      })

      context("in the new epoch", () => {
        it("should accept valid header chains", async () => {
          const proofHeaders = concatenateHexStrings(headerHex.slice(9, 13))
          const res = await relay.validateChain(proofHeaders)
          expect(res[0]).to.be.above(0)
        })
      })
    })

    context("with chain reorgs", () => {
      const { postRetargetChain } = reorgHeadersChain
          .genesis(reorgGenesis.hex, reorgGenesis.height, 8)
      })

      after(async () => {
        await restoreSnapshot()
      })

      context("valid chains", () => {
        it("should be accepted", async () => {
          const proofHeaders = concatenateHexStrings(reorgHex)
          const res = await relay.validateChain(proofHeaders)
          expect(res[0]).to.be.above(0)
        })
      })

      context("invalid chains", () => {
        it("should be rejected", async () => {
          const pre = concatenateHexStrings(reorgHex.slice(0, 6))
          const orphan = reorgHeaders.orphan_437478.hex
          const post = reorgHex[7]
          const proofHeaders = concatenateHexStrings([pre, orphan, post])
          await expect(relay.validateChain(proofHeaders)).to.be.revertedWith(
            "Invalid chain"
          )
        })
      })
    })

    context("gas costs", () => {
      const { chain } = headers
      const headerHex = chain.map((header) => header.hex)
      const retargetHeaders = concatenateHexStrings(headerHex.slice(5, 13))

      before(async () => {
        await createSnapshot()
        await relay.connect(governance).genesis(genesisHeader, genesisHeight, 4)
        await relay.connect(thirdParty).retarget(retargetHeaders)
      })

      after(async () => {
        await restoreSnapshot()
      })

      context("with proof length 6", () => {
        it("should accept valid header chains", async () => {
          const proofHeaders = concatenateHexStrings(headerHex.slice(5, 11))
          await relay.connect(governance).setProofLength(6)
          const tx = await relay.validateChainGasReport(proofHeaders)
          const txr = await tx.wait()

          expect(txr.status).to.equal(1)
        })
      })

      context("with proof length 18", () => {
        it("should accept valid header chains", async () => {
          const proofHeaders = concatenateHexStrings(headerHex)
          await relay.connect(governance).setProofLength(18)
          const tx = await relay.validateChainGasReport(proofHeaders)
          const txr = await tx.wait()

          expect(txr.status).to.equal(1)
        })
      })
    })
    */
  })
  //
  // end validate
  //

  //
  // getRelayRange
  //
  describe("getRelayRange", () => {
    before(async () => {
      await createSnapshot()
    })

    after(async () => {
      await restoreSnapshot()
    })

    /*
    context("when called before genesis", () => {
      it("should return nonsense", async () => {
        const res = await relay.getRelayRange()
        expect(res[0]).to.equal(0)
        expect(res[1]).to.equal(2015)
      })
    })

    context("when called after genesis", () => {
      before(async () => {
        await createSnapshot()
        await relay.connect(governance).genesis(genesisHeader, genesisHeight, 4)
      })

      after(async () => {
        await restoreSnapshot()
      })

      it("should return a single epoch", async () => {
        const res = await relay.getRelayRange()
        expect(res[0]).to.equal(552384)
        expect(res[1]).to.equal(554399)
      })
    })

    context("when called after a retarget", () => {
      const { chain } = headers
      const headerHex = chain.map((header) => header.hex)
      const retargetHeaders = concatenateHexStrings(headerHex.slice(5, 13))

      before(async () => {
        await createSnapshot()
        await relay.connect(governance).genesis(genesisHeader, genesisHeight, 4)
        await relay.connect(thirdParty).retarget(retargetHeaders)
      })

      after(async () => {
        await restoreSnapshot()
      })

      it("should return two epochs", async () => {
        const res = await relay.getRelayRange()
        expect(res[0]).to.equal(552384)
        expect(res[1]).to.equal(556415)
      })
    })
    */
  })
  //
  // end getRelayRange
  //
})
