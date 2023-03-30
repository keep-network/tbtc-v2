import { deployments, helpers } from "hardhat"
import { expect } from "chai"

import type { SignerWithAddress } from "@nomiclabs/hardhat-ethers/signers"

import type { ArbitrumTBTC, ArbitrumTBTCUpgraded } from "../typechain"

describe("ArbitrumTBTC - Upgrade", async () => {
  let governance: SignerWithAddress
  let arbitrumTBTC: ArbitrumTBTC

  before(async () => {
    await deployments.fixture()
    ;({ governance } = await helpers.signers.getNamedSigners())

    arbitrumTBTC = (await helpers.contracts.getContract(
      "ArbitrumTBTC"
    )) as ArbitrumTBTC
  })

  describe("when a new contract is valid", () => {
    let arbitrumTBTCUpgraded: ArbitrumTBTCUpgraded

    before(async () => {
      const [upgradedContract] = await helpers.upgrades.upgradeProxy(
        "ArbitrumTBTC",
        "ArbitrumTBTCUpgraded",
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
      arbitrumTBTCUpgraded = upgradedContract as ArbitrumTBTCUpgraded
    })

    it("new instance should have the same address as the old one", async () => {
      expect(arbitrumTBTCUpgraded.address).equal(arbitrumTBTC.address)
    })

    it("should initialize new variable", async () => {
      expect(await arbitrumTBTCUpgraded.newVar()).to.be.equal(
        "Hello darkness my old friend"
      )
    })

    it("should not update already set name", async () => {
      expect(await arbitrumTBTCUpgraded.name()).to.be.equal("Arbitrum tBTC v2")
    })

    it("should not update already set symbol", async () => {
      expect(await arbitrumTBTCUpgraded.symbol()).to.be.equal("tBTC")
    })

    it("should revert when V1's initializer is called", async () => {
      await expect(
        arbitrumTBTCUpgraded.initialize("ArbitrumTBTCv2", "ArbTBTCv2")
      ).to.be.revertedWith("Initializable: contract is already initialized")
    })
  })
})
