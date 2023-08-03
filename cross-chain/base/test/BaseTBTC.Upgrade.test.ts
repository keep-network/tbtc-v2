import { deployments, helpers } from "hardhat"
import { expect } from "chai"

import type { SignerWithAddress } from "@nomiclabs/hardhat-ethers/signers"

import type { BaseTBTC, BaseTBTCUpgraded } from "../typechain"

describe("BaseTBTC - Upgrade", async () => {
  let governance: SignerWithAddress
  let baseTBTC: BaseTBTC

  before(async () => {
    await deployments.fixture()
    ;({ governance } = await helpers.signers.getNamedSigners())

    baseTBTC = (await helpers.contracts.getContract("BaseTBTC")) as BaseTBTC
  })

  describe("when a new contract is valid", () => {
    let baseTBTCUpgraded: BaseTBTCUpgraded

    before(async () => {
      const [upgradedContract] = await helpers.upgrades.upgradeProxy(
        "BaseTBTC",
        "BaseTBTCUpgraded",
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
      baseTBTCUpgraded = upgradedContract as BaseTBTCUpgraded
    })

    it("new instance should have the same address as the old one", async () => {
      expect(baseTBTCUpgraded.address).equal(baseTBTC.address)
    })

    it("should initialize new variable", async () => {
      expect(await baseTBTCUpgraded.newVar()).to.be.equal(
        "Hello darkness my old friend"
      )
    })

    it("should not update already set name", async () => {
      expect(await baseTBTCUpgraded.name()).to.be.equal("Base tBTC v2")
    })

    it("should not update already set symbol", async () => {
      expect(await baseTBTCUpgraded.symbol()).to.be.equal("tBTC")
    })

    it("should revert when V1's initializer is called", async () => {
      await expect(
        baseTBTCUpgraded.initialize("BaseTBTCv2", "BaseTBTCv2")
      ).to.be.revertedWith("Initializable: contract is already initialized")
    })
  })
})
