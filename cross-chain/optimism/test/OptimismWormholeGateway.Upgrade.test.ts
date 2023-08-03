import { ethers, deployments, helpers } from "hardhat"
import { expect } from "chai"

import type { SignerWithAddress } from "@nomiclabs/hardhat-ethers/signers"

import type {
  OptimismTBTC,
  OptimismWormholeGateway,
  OptimismWormholeGatewayUpgraded,
} from "../typechain"

const ZERO_ADDRESS = ethers.constants.AddressZero

describe("OptimismWormholeGatewayUpgraded - Upgrade", async () => {
  let governance: SignerWithAddress
  let optimismWormholeGateway: OptimismWormholeGateway

  before(async () => {
    await deployments.fixture()
    ;({ governance } = await helpers.signers.getNamedSigners())

    optimismWormholeGateway = (await helpers.contracts.getContract(
      "OptimismWormholeGateway"
    )) as OptimismWormholeGateway
  })

  describe("when a new contract is valid", () => {
    let optimismWormholeGatewayUpgraded: OptimismWormholeGatewayUpgraded
    let OptimismTBTC: OptimismTBTC

    before(async () => {
      OptimismTBTC = (await helpers.contracts.getContract(
        "OptimismTBTC"
      )) as OptimismTBTC

      const [upgradedContract] = await helpers.upgrades.upgradeProxy(
        "OptimismWormholeGateway",
        "OptimismWormholeGatewayUpgraded",
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
      optimismWormholeGatewayUpgraded =
        upgradedContract as OptimismWormholeGatewayUpgraded
    })

    it("new instance should have the same address as the old one", async () => {
      expect(optimismWormholeGatewayUpgraded.address).equal(
        optimismWormholeGateway.address
      )
    })

    it("should initialize new variable", async () => {
      expect(await optimismWormholeGatewayUpgraded.newVar()).to.be.equal(
        "Hello darkness my old friend"
      )
    })

    it("should not update already set variable", async () => {
      expect(await optimismWormholeGatewayUpgraded.tbtc()).to.be.equal(
        OptimismTBTC.address
      )
    })

    it("should revert when V1's initializer is called", async () => {
      await expect(
        optimismWormholeGatewayUpgraded.initialize(
          ZERO_ADDRESS,
          ZERO_ADDRESS,
          ZERO_ADDRESS
        )
      ).to.be.revertedWith("Initializable: contract is already initialized")
    })
  })
})
