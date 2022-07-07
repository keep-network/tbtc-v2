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

const { epochStart } = headers
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

      it("should record the genesis height correctly", async () => {
        expect(await relay.getHeight()).to.equal(genesis.height)
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
          relay
            .connect(governance)
            .genesis(epochStart.hex, genesis.hex, genesis.height)
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
    const heightOf = chain.map((header) => header.height)

    before(async () => {
      await createSnapshot()
    })

    after(async () => {
      await restoreSnapshot()
    })

    context("when called before genesis", () => {
      const newHeaders = concatenateHexStrings(headerHex.slice(0, 7))

      it("should revert", async () => {
        await expect(
          relay.addHeaders(heightOf[0], newHeaders)
        ).to.be.revertedWith("Relay is not initialised")
      })
    })

    context("after genesis (block 741798)", () => {
      before(async () => {
        await createSnapshot()
        await relay
          .connect(governance)
          .genesis(epochStart.hex, genesis.hex, genesis.height)
      })

      after(async () => {
        await restoreSnapshot()
      })

      context("when called correctly", () => {
        let tx: ContractTransaction
        const newHeaders = concatenateHexStrings(headerHex.slice(0, 7))

        before(async () => {
          await createSnapshot()
          tx = await relay.addHeaders(heightOf[0], newHeaders)
        })

        after(async () => {
          await restoreSnapshot()
        })

        it("should store the new height", async () => {
          expect(await relay.getHeight()).to.equal(741804)
        })
      })

      context("when called with many headers", () => {
        const newHeaders = concatenateHexStrings(headerHex.slice(0, 19))

        before(async () => {
          await createSnapshot()
          await relay.addHeaders(heightOf[0], newHeaders)
        })

        after(async () => {
          await restoreSnapshot()
        })

        it("should store the new height", async () => {
          expect(await relay.getHeight()).to.equal(741816)
        })
      })

      context("with full buffer", () => {
        const newHeaders = concatenateHexStrings(headerHex.slice(0, 7))

        before(async () => {
          await createSnapshot()
          await relay.fillBuffer(heightOf[0], 20)
        })

        after(async () => {
          await restoreSnapshot()
        })

        it("should store the new height with 6 added blocks", async () => {
          await relay.addHeaders(heightOf[0], newHeaders)
          expect(await relay.getHeight()).to.equal(741804)
        })
      })

      context("with full buffer and many headers", () => {
        const newHeaders = concatenateHexStrings(headerHex.slice(0, 19))

        before(async () => {
          await createSnapshot()
          await relay.fillBuffer(heightOf[0], 20)
        })

        after(async () => {
          await restoreSnapshot()
        })

        it("should store the new height with 6 added blocks", async () => {
          await relay.addHeaders(heightOf[0], newHeaders)
          expect(await relay.getHeight()).to.equal(741816)
        })
      })

      context("with incorrect number of headers", () => {
        before(async () => {
          await createSnapshot()
        })

        after(async () => {
          await restoreSnapshot()
        })

        const newHeaders = concatenateHexStrings(headerHex.slice(0, 6))
        it("should revert", async () => {
          await expect(
            relay.addHeaders(heightOf[0], newHeaders)
          ).to.be.revertedWith("Invalid number of headers")
        })
      })

      context("with invalid ancestor", () => {
        before(async () => {
          await createSnapshot()
        })

        after(async () => {
          await restoreSnapshot()
        })

        const newHeaders = concatenateHexStrings(headerHex.slice(1, 8))
        it("should revert", async () => {
          await expect(
            relay.addHeaders(heightOf[1], newHeaders)
          ).to.be.revertedWith("Invalid ancestor height")
        })

        it("should revert when we lie about the ancestor height", async () => {
          await expect(
            relay.addHeaders(heightOf[0], newHeaders)
          ).to.be.revertedWith("Ancestor not recorded in relay")
        })
      })

      context("with ancestor that isn't the most recent one", () => {
        before(async () => {
          await createSnapshot()
        })

        after(async () => {
          await restoreSnapshot()
        })

        const newHeaders = concatenateHexStrings(headerHex.slice(0, 7))
        const newerHeaders = concatenateHexStrings(headerHex.slice(0, 13))

        it("should revert", async () => {
          await relay.addHeaders(heightOf[0], newHeaders)
          await expect(
            relay.addHeaders(heightOf[0], newerHeaders)
          ).to.be.revertedWith("Invalid ancestor block")
        })
      })

      context("with zero new headers", () => {
        before(async () => {
          await createSnapshot()
        })

        after(async () => {
          await restoreSnapshot()
        })

        it("should revert", async () => {
          await expect(
            relay.addHeaders(heightOf[0], headerHex[0])
          ).to.be.revertedWith("Invalid number of headers")
        })
      })
    })

    context("after genesis (block 741876)", () => {
      const lateGenesis = headers.chain[78]

      before(async () => {
        await createSnapshot()
        await relay
          .connect(governance)
          .genesis(epochStart.hex, lateGenesis.hex, lateGenesis.height)
      })

      after(async () => {
        await restoreSnapshot()
      })

      context("when called correctly", () => {
        let tx: ContractTransaction
        const newHeaders = concatenateHexStrings(headerHex.slice(78, 85))

        before(async () => {
          await createSnapshot()
          tx = await relay.addHeaders(heightOf[78], newHeaders)
        })

        after(async () => {
          await restoreSnapshot()
        })

        it("should store the new height", async () => {
          expect(await relay.getHeight()).to.equal(741882)
        })
      })

      context("when called with many headers, including a retarget", () => {
        const newHeaders = concatenateHexStrings(headerHex.slice(78, 97))

        before(async () => {
          await createSnapshot()
          await relay.fillBuffer(heightOf[78], 20)
          await relay.addHeaders(heightOf[78], newHeaders)
        })

        after(async () => {
          await restoreSnapshot()
        })

        it("should store the new height", async () => {
          expect(await relay.getHeight()).to.equal(741894)
        })
      })
    })

    context("after genesis (block 741876) with invalid epoch start", () => {
      const lateGenesis = headers.chain[78]

      before(async () => {
        await createSnapshot()
        await relay
          .connect(governance)
          .genesis(genesis.hex, lateGenesis.hex, lateGenesis.height)
      })

      after(async () => {
        await restoreSnapshot()
      })

      context("when called with many headers, including a retarget", () => {
        const newHeaders = concatenateHexStrings(headerHex.slice(78, 97))

        it("should revert", async () => {
          await expect(
            relay.addHeaders(heightOf[78], newHeaders)
          ).to.be.revertedWith("Invalid target")
        })
      })
    })

    context(
      "after genesis with invalid height (block 741875, reported as 741876)",
      () => {
        const badGenesis = headers.chain[77]

        before(async () => {
          await createSnapshot()
          await relay
            .connect(governance)
            .genesis(epochStart.hex, badGenesis.hex, badGenesis.height + 1)
        })

        after(async () => {
          await restoreSnapshot()
        })

        context("when called with many headers, including a retarget", () => {
          const newHeaders = concatenateHexStrings(headerHex.slice(77, 96))

          it("should revert", async () => {
            await expect(
              relay.addHeaders(heightOf[78], newHeaders)
            ).to.be.revertedWith("Invalid target")
          })
        })
      }
    )

    context(
      "after genesis with invalid height (block 741877, reported as 741876)",
      () => {
        const badGenesis = headers.chain[79]

        before(async () => {
          await createSnapshot()
          await relay
            .connect(governance)
            .genesis(epochStart.hex, badGenesis.hex, badGenesis.height - 1)
        })

        after(async () => {
          await restoreSnapshot()
        })

        context("when called with many headers, including a retarget", () => {
          const newHeaders = concatenateHexStrings(headerHex.slice(79, 98))

          it("should revert", async () => {
            await expect(
              relay.addHeaders(heightOf[78], newHeaders)
            ).to.be.revertedWith("Invalid target")
          })
        })
      }
    )
  })
  //
  // end addHeaders
  //

  //
  // validate
  //
  describe("validate", () => {
    const { chain } = headers
    const heightOf = chain.map((header) => header.height)

    before(async () => {
      await createSnapshot()
    })

    after(async () => {
      await restoreSnapshot()
    })

    context("when called before genesis", () => {
      const proofHeaders = concatenateHexStrings(headerHex.slice(0, 6))

      it("should revert", async () => {
        await expect(
          relay.validate(heightOf[0], proofHeaders)
        ).to.be.revertedWith("Headers not part of the longest chain")
      })
    })

    context("when called after genesis (block 741798)", () => {
      const storedHeaders = concatenateHexStrings(headerHex.slice(0, 7))

      before(async () => {
        await createSnapshot()
        await relay
          .connect(governance)
          .genesis(epochStart.hex, genesis.hex, genesis.height)
        await relay.addHeaders(heightOf[0], storedHeaders)
      })

      after(async () => {
        await restoreSnapshot()
      })

      it("should accept valid header chains 0..5", async () => {
        const proofHeaders = concatenateHexStrings(headerHex.slice(0, 6))
        expect(await relay.validate(heightOf[0], proofHeaders)).to.be.true
      })

      it("should accept valid header chains 1..6", async () => {
        const proofHeaders = concatenateHexStrings(headerHex.slice(1, 7))
        expect(await relay.validate(heightOf[1], proofHeaders)).to.be.true
      })

      it("should accept valid header chains 6..11", async () => {
        const proofHeaders = concatenateHexStrings(headerHex.slice(6, 12))
        expect(await relay.validate(heightOf[6], proofHeaders)).to.be.true
      })

      it("should reject single headers", async () => {
        await expect(
          relay.validate(heightOf[0], headerHex[0])
        ).to.be.revertedWith("Invalid header length")
      })

      it("should reject 5 headers", async () => {
        const proofHeaders = concatenateHexStrings(headerHex.slice(0, 5))

        await expect(
          relay.validate(heightOf[0], proofHeaders)
        ).to.be.revertedWith("Invalid header length")
      })

      it("should reject 7 headers", async () => {
        const proofHeaders = concatenateHexStrings(headerHex.slice(0, 7))

        await expect(
          relay.validate(heightOf[0], proofHeaders)
        ).to.be.revertedWith("Invalid header length")
      })

      it("should reject header chains not anchored to the relay", async () => {
        const proofHeaders = concatenateHexStrings(headerHex.slice(7, 13))

        await expect(
          relay.validate(heightOf[7], proofHeaders)
        ).to.be.revertedWith("Headers not part of the longest chain")
      })

      it("should reject header chains with misreported height", async () => {
        const proofHeaders = concatenateHexStrings(headerHex.slice(1, 7))

        await expect(
          relay.validate(heightOf[0], proofHeaders)
        ).to.be.revertedWith("Headers not part of the longest chain")
      })
    })

    context("gas costs", () => {
      const storedHeaders = concatenateHexStrings(headerHex.slice(0, 13))

      before(async () => {
        await createSnapshot()
        await relay
          .connect(governance)
          .genesis(epochStart.hex, genesis.hex, genesis.height)
        await relay.addHeaders(heightOf[0], storedHeaders)
      })

      after(async () => {
        await restoreSnapshot()
      })

      it("should accept valid header chains 0..5", async () => {
        const proofHeaders = concatenateHexStrings(headerHex.slice(0, 6))
        const tx = await relay.validateGasReport(heightOf[0], proofHeaders)
        const txr = await tx.wait()
        expect(txr.status).to.equal(1)
      })

      it("should accept valid header chains 1..6", async () => {
        const proofHeaders = concatenateHexStrings(headerHex.slice(1, 7))

        const tx = await relay.validateGasReport(heightOf[1], proofHeaders)
        const txr = await tx.wait()
        expect(txr.status).to.equal(1)
      })

      it("should accept valid header chains 3..8", async () => {
        const proofHeaders = concatenateHexStrings(headerHex.slice(3, 9))

        const tx = await relay.validateGasReport(heightOf[3], proofHeaders)
        const txr = await tx.wait()
        expect(txr.status).to.equal(1)
      })

      it("should accept valid header chains 12..17", async () => {
        const proofHeaders = concatenateHexStrings(headerHex.slice(12, 18))

        const tx = await relay.validateGasReport(heightOf[12], proofHeaders)
        const txr = await tx.wait()
        expect(txr.status).to.equal(1)
      })
    })
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
