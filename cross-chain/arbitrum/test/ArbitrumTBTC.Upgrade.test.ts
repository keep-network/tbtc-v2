import { deployments, helpers } from "hardhat"
import { expect } from "chai"

import type { SignerWithAddress } from "@nomiclabs/hardhat-ethers/signers"
import { upgradeProxy } from "./utils/upgrades"

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
      arbitrumTBTCUpgraded = (await upgradeProxy(
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
      )) as ArbitrumTBTCUpgraded
    })

    it("new instance should have the same address as the old one", async () => {
      expect(arbitrumTBTCUpgraded.address).equal(arbitrumTBTC.address)
    })

    it("should initialize new variable", async () => {
      expect(await arbitrumTBTCUpgraded.newVar()).to.be.equal(
        "Hello darkness my old friend"
      )
    })

    it("should not update already set variable", async () => {
      expect(await arbitrumTBTCUpgraded.name()).to.be.equal("ArbitrumTBTC")
    })

    it("should revert when V1's initializer is called", async () => {
      await expect(
        arbitrumTBTCUpgraded.initialize("ArbitrumTBTCv2", "ArbTBTCv2")
      ).to.be.revertedWith("Initializable: contract is already initialized")
    })
  })
})
