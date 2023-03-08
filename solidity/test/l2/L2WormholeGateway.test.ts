import { SignerWithAddress } from "@nomiclabs/hardhat-ethers/signers"

import { randomBytes } from "crypto"
import { expect } from "chai"
import { ethers, getUnnamedAccounts, helpers, waffle } from "hardhat"
import { ContractTransaction } from "ethers"

import type {
  L2TBTC,
  WormholeBridgeStub,
  TestERC20,
  L2WormholeGateway,
} from "../../typechain"

const { createSnapshot, restoreSnapshot } = helpers.snapshot

const ZERO_ADDRESS = ethers.constants.AddressZero

describe("L2WormholeGateway", () => {
  const fixture = async () => {
    const { deployer, governance } = await helpers.signers.getNamedSigners()

    //
    // Deploy L2 canonical tBTC token.
    //
    let deployment = await helpers.upgrades.deployProxy(
      // Hacky workaround allowing to deploy proxy contract any number of times
      // without clearing `deployments/hardhat` directory.
      // See: https://github.com/keep-network/hardhat-helpers/issues/38
      `L2TBTC_${randomBytes(8).toString("hex")}`,
      {
        contractName: "L2TBTC",
        initializerArgs: ["Arbitrum TBTC", "ArbTBTC"],
        factoryOpts: { signer: deployer },
        proxyOpts: {
          kind: "transparent",
        },
      }
    )
    const canonicalTbtc = deployment[0] as L2TBTC

    //
    // Deploy test token as the Wormhole Bridge L2 tBTC representation.
    //
    const TestERC20 = await ethers.getContractFactory("TestERC20")
    const wormholeTbtc = await TestERC20.deploy()
    await wormholeTbtc.deployed()

    //
    // Deploy stub of the Wormhole Bridge contract.
    // Stub contract is used instead of a smock because of the token transfer
    // that needs to happen in completeTransferWithPayload function.
    //
    const WormholeBridgeStub = await ethers.getContractFactory(
      "WormholeBridgeStub"
    )
    const wormholeBridgeStub = await WormholeBridgeStub.deploy(
      wormholeTbtc.address
    )
    await wormholeBridgeStub.deployed()

    //
    // Deploy the L2WormholeGateway.
    //
    deployment = await helpers.upgrades.deployProxy(
      // Hacky workaround allowing to deploy proxy contract any number of times
      // without clearing `deployments/hardhat` directory.
      // See: https://github.com/keep-network/hardhat-helpers/issues/38
      `L2WormholeGateway_${randomBytes(8).toString("hex")}`,
      {
        contractName: "L2WormholeGateway",
        initializerArgs: [
          wormholeBridgeStub.address,
          wormholeTbtc.address,
          canonicalTbtc.address,
        ],
        factoryOpts: { signer: deployer },
        proxyOpts: {
          kind: "transparent",
        },
      }
    )
    const gateway = deployment[0] as L2WormholeGateway

    //
    // Wire up contracts.
    //
    await canonicalTbtc.addMinter(gateway.address)
    await wormholeTbtc.transferOwnership(wormholeBridgeStub.address)

    const accounts = await getUnnamedAccounts()
    depositor = await ethers.getSigner(accounts[1])

    return {
      governance,
      depositor,
      wormholeTbtc,
      canonicalTbtc,
      wormholeBridgeStub,
      gateway,
    }
  }

  // We use IWormholeTokenBridge stub in unit tests so the encodedVM content
  // does not matter. Using an arbitrary array of bytes.
  const encodedVm =
    "0x1230000000000000000000000000000000000000000000000000000000000321"

  let governance: SignerWithAddress
  let depositor: SignerWithAddress
  let wormholeTbtc: TestERC20
  let canonicalTbtc: L2TBTC
  let wormholeBridgeStub: WormholeBridgeStub
  let gateway: L2WormholeGateway

  before(async () => {
    // eslint-disable-next-line @typescript-eslint/no-extra-semi
    ;({
      governance,
      depositor,
      wormholeTbtc,
      canonicalTbtc,
      wormholeBridgeStub,
      gateway,
    } = await waffle.loadFixture(fixture))
  })

  describe("initialization", () => {
    it("should set the wormhole bridge address", async () => {
      expect(await gateway.bridge()).to.equal(wormholeBridgeStub.address)
    })

    it("should set the wormhole bridge token address", async () => {
      expect(await gateway.bridgeToken()).to.equal(wormholeTbtc.address)
    })

    it("should set the canonical tBTC address", async () => {
      expect(await gateway.tbtc()).to.equal(canonicalTbtc.address)
    })
  })

  describe("receiveWormhole", () => {
    context("when receiver is the zero address", () => {
      before(async () => {
        await createSnapshot()

        await wormholeBridgeStub.setReceiverAddress(ZERO_ADDRESS)
        await wormholeBridgeStub.setTransferAmount(10)
      })

      after(async () => {
        await restoreSnapshot()
      })

      it("should revert", async () => {
        await expect(gateway.receiveWormhole(encodedVm)).to.be.revertedWith(
          "0x0 receiver not allowed"
        )
      })
    })

    context("when receiver is non-zero address", () => {
      const transferAmount = 13373

      let tx: ContractTransaction

      before(async () => {
        await createSnapshot()
        await wormholeBridgeStub.setReceiverAddress(depositor.address)
        await wormholeBridgeStub.setTransferAmount(transferAmount)

        tx = await gateway.receiveWormhole(encodedVm)
      })

      after(async () => {
        await restoreSnapshot()
      })

      it("should transfer wormhole tBTC to the contract", async () => {
        expect(await wormholeTbtc.balanceOf(gateway.address)).to.equal(
          transferAmount
        )
      })

      it("should mint tBTC to the receiver", async () => {
        expect(await canonicalTbtc.balanceOf(depositor.address)).to.equal(
          transferAmount
        )
      })

      it("should complete transfer with the bridge", async () => {
        await expect(tx)
          .to.emit(
            wormholeBridgeStub,
            "WormholeBridgeStub_completeTransferWithPayload"
          )
          .withArgs(encodedVm)
      })
    })
  })

  describe("sendWormhole", () => {
    const recipientChain = 2
    const recipient =
      "0x0000000000000000000000003e7e00b99c98b79c191b0065d177dacf8821f2a7"
    const arbiterFee = 3
    const nonce = 4

    const liquidity = 1100

    before(async () => {
      await createSnapshot()

      await wormholeBridgeStub.setReceiverAddress(depositor.address)
      await wormholeBridgeStub.setTransferAmount(liquidity)

      await gateway.receiveWormhole(encodedVm)
    })

    after(async () => {
      await restoreSnapshot()
    })

    context("when there is not enough liquidity in wormhole", () => {
      it("should revert", async () => {
        await expect(
          gateway
            .connect(depositor)
            .sendWormhole(
              liquidity + 1,
              recipientChain,
              recipient,
              arbiterFee,
              nonce
            )
        ).to.be.revertedWith("Not enough liquidity in wormhole to bridge")
      })
    })

    context("when there is enough liquidity in wormhole", () => {
      const amount = 997

      let tx: ContractTransaction

      before(async () => {
        await createSnapshot()

        await canonicalTbtc.connect(depositor).approve(gateway.address, amount)
        tx = await gateway
          .connect(depositor)
          .sendWormhole(amount, recipientChain, recipient, arbiterFee, nonce)
      })

      after(async () => {
        await restoreSnapshot()
      })

      it("should burn canonical tBTC from the caller", async () => {
        expect(tx)
          .to.emit(canonicalTbtc, "Transfer")
          .withArgs(depositor.address, ZERO_ADDRESS, amount)
      })

      it("should approve burned amount of wormhole tBTC to the bridge", async () => {
        expect(tx)
          .to.emit(wormholeTbtc, "Approved")
          .withArgs(wormholeBridgeStub.address, amount)
      })

      it("should sent tokens through the bridge", async () => {
        await expect(tx)
          .to.emit(wormholeBridgeStub, "WormholeBridgeStub_transferTokens")
          .withArgs(
            wormholeTbtc.address,
            amount,
            recipientChain,
            recipient,
            arbiterFee,
            nonce
          )
      })
    })
  })
})
