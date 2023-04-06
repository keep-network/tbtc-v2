import { deployments, helpers } from "hardhat"
import { expect } from "chai"

import type { SignerWithAddress } from "@nomiclabs/hardhat-ethers/signers"

import type { OptimismTBTC, OptimismTBTCUpgraded } from "../typechain"

describe("OptimismTBTC - Upgrade", async () => {
  let governance: SignerWithAddress
  let optimismTBTC: OptimismTBTC

  before(async () => {
    await deployments.fixture()
    ;({ governance } = await helpers.signers.getNamedSigners())

    optimismTBTC = (await helpers.contracts.getContract(
      "OptimismTBTC"
    )) as OptimismTBTC
  })

  describe("when a new contract is valid", () => {
    let optimismTBTCUpgraded: OptimismTBTCUpgraded

    before(async () => {
      const [upgradedContract] = await helpers.upgrades.upgradeProxy(
        "OptimismTBTC",
        "OptimismTBTCUpgraded",
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
      optimismTBTCUpgraded = upgradedContract as OptimismTBTCUpgraded
    })

    it("new instance should have the same address as the old one", async () => {
      expect(optimismTBTCUpgraded.address).equal(optimismTBTC.address)
    })

    it("should initialize new variable", async () => {
      expect(await optimismTBTCUpgraded.newVar()).to.be.equal(
        "Hello darkness my old friend"
      )
    })

    it("should not update already set name", async () => {
      expect(await optimismTBTCUpgraded.name()).to.be.equal("Optimism tBTC v2")
    })

    it("should not update already set symbol", async () => {
      expect(await optimismTBTCUpgraded.symbol()).to.be.equal("tBTC")
    })

    it("should revert when V1's initializer is called", async () => {
      await expect(
        optimismTBTCUpgraded.initialize("OptimismTBTCv2", "ArbTBTCv2")
      ).to.be.revertedWith("Initializable: contract is already initialized")
    })
  })
})
