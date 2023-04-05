import { ethers, deployments, helpers } from "hardhat"
import { expect } from "chai"

import type { SignerWithAddress } from "@nomiclabs/hardhat-ethers/signers"

import type {
  OptimisticTBTC,
  OptimisticWormholeGateway,
  OptimisticWormholeGatewayUpgraded,
} from "../typechain"

const ZERO_ADDRESS = ethers.constants.AddressZero

describe("OptimisticWormholeGatewayUpgraded - Upgrade", async () => {
  let governance: SignerWithAddress
  let optimisticWormholeGateway: OptimisticWormholeGateway

  before(async () => {
    await deployments.fixture()
    ;({ governance } = await helpers.signers.getNamedSigners())

    optimisticWormholeGateway = (await helpers.contracts.getContract(
      "OptimisticWormholeGateway"
    )) as OptimisticWormholeGateway
  })

  describe("when a new contract is valid", () => {
    let optimisticWormholeGatewayUpgraded: OptimisticWormholeGatewayUpgraded
    let OptimisticTBTC: OptimisticTBTC

    before(async () => {
      OptimisticTBTC = (await helpers.contracts.getContract(
        "OptimisticTBTC"
      )) as OptimisticTBTC

      const [upgradedContract] = await helpers.upgrades.upgradeProxy(
        "OptimisticWormholeGateway",
        "OptimisticWormholeGatewayUpgraded",
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
      optimisticWormholeGatewayUpgraded =
        upgradedContract as OptimisticWormholeGatewayUpgraded
    })

    it("new instance should have the same address as the old one", async () => {
      expect(optimisticWormholeGatewayUpgraded.address).equal(
        optimisticWormholeGateway.address
      )
    })

    it("should initialize new variable", async () => {
      expect(await optimisticWormholeGatewayUpgraded.newVar()).to.be.equal(
        "Hello darkness my old friend"
      )
    })

    it("should not update already set variable", async () => {
      expect(await optimisticWormholeGatewayUpgraded.tbtc()).to.be.equal(
        OptimisticTBTC.address
      )
    })

    it("should revert when V1's initializer is called", async () => {
      await expect(
        optimisticWormholeGatewayUpgraded.initialize(
          ZERO_ADDRESS,
          ZERO_ADDRESS,
          ZERO_ADDRESS
        )
      ).to.be.revertedWith("Initializable: contract is already initialized")
    })
  })
})
