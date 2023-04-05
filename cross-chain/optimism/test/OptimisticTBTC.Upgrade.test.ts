import { deployments, helpers } from "hardhat"
import { expect } from "chai"

import type { SignerWithAddress } from "@nomiclabs/hardhat-ethers/signers"

import type { OptimisticTBTC, OptimisticTBTCUpgraded } from "../typechain"

describe("OptimisticTBTC - Upgrade", async () => {
  let governance: SignerWithAddress
  let optimisticTBTC: OptimisticTBTC

  before(async () => {
    await deployments.fixture()
    ;({ governance } = await helpers.signers.getNamedSigners())

    optimisticTBTC = (await helpers.contracts.getContract(
      "OptimisticTBTC"
    )) as OptimisticTBTC
  })

  describe("when a new contract is valid", () => {
    let optimisticTBTCUpgraded: OptimisticTBTCUpgraded

    before(async () => {
      const [upgradedContract] = await helpers.upgrades.upgradeProxy(
        "OptimisticTBTC",
        "OptimisticTBTCUpgraded",
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
      optimisticTBTCUpgraded = upgradedContract as OptimisticTBTCUpgraded
    })

    it("new instance should have the same address as the old one", async () => {
      expect(optimisticTBTCUpgraded.address).equal(optimisticTBTC.address)
    })

    it("should initialize new variable", async () => {
      expect(await optimisticTBTCUpgraded.newVar()).to.be.equal(
        "Hello darkness my old friend"
      )
    })

    it("should not update already set name", async () => {
      expect(await optimisticTBTCUpgraded.name()).to.be.equal(
        "Optimism tBTC v2"
      )
    })

    it("should not update already set symbol", async () => {
      expect(await optimisticTBTCUpgraded.symbol()).to.be.equal("tBTC")
    })

    it("should revert when V1's initializer is called", async () => {
      await expect(
        optimisticTBTCUpgraded.initialize("OptimisticTBTCv2", "ArbTBTCv2")
      ).to.be.revertedWith("Initializable: contract is already initialized")
    })
  })
})
