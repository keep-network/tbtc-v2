import { deployments, helpers } from "hardhat"
import { expect } from "chai"

import type { SignerWithAddress } from "@nomiclabs/hardhat-ethers/signers"

import type { PolygonTBTC, PolygonTBTCUpgraded } from "../typechain"

describe("PolygonTBTC - Upgrade", async () => {
  let governance: SignerWithAddress
  let polygonTBTC: PolygonTBTC

  before(async () => {
    await deployments.fixture()
    ;({ governance } = await helpers.signers.getNamedSigners())

    polygonTBTC = (await helpers.contracts.getContract(
      "PolygonTBTC"
    )) as PolygonTBTC
  })

  describe("when a new contract is valid", () => {
    let polygonTBTCUpgraded: PolygonTBTCUpgraded

    before(async () => {
      const [upgradedContract] = await helpers.upgrades.upgradeProxy(
        "PolygonTBTC",
        "PolygonTBTCUpgraded",
        {
          proxyOpts: {
            call: {
              fn: "initializeV2",
              args: ["Hello darkness my old friend"],
            },
          },
          factoryOpts: {
            signer: governance,
          },
        }
      )
      polygonTBTCUpgraded = upgradedContract as PolygonTBTCUpgraded
    })

    it("new instance should have the same address as the old one", async () => {
      expect(polygonTBTCUpgraded.address).equal(polygonTBTC.address)
    })

    it("should initialize new variable", async () => {
      expect(await polygonTBTCUpgraded.newVar()).to.be.equal(
        "Hello darkness my old friend"
      )
    })

    it("should not update already set name", async () => {
      expect(await polygonTBTCUpgraded.name()).to.be.equal("Polygon tBTC v2")
    })

    it("should not update already set symbol", async () => {
      expect(await polygonTBTCUpgraded.symbol()).to.be.equal("tBTC")
    })

    it("should revert when V1's initializer is called", async () => {
      await expect(
        polygonTBTCUpgraded.initialize("PolygonTBTCv2", "PolTBTCv2")
      ).to.be.revertedWith("Initializable: contract is already initialized")
    })
  })
})
