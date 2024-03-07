import { ethers, getUnnamedAccounts, helpers, waffle } from "hardhat"
import { randomBytes } from "crypto"
import chai, { expect } from "chai"
import { FakeContract, smock } from "@defi-wonderland/smock"
import { SignerWithAddress } from "@nomiclabs/hardhat-ethers/signers"
import { ContractTransaction } from "ethers"
import {
  IL2WormholeGateway,
  IWormholeRelayer,
  L2BitcoinDepositor,
} from "../../typechain"
import type {
  DepositRevealInfoStruct,
  BitcoinTxInfoStruct,
} from "../../typechain/L2BitcoinDepositor"

chai.use(smock.matchers)

const { impersonateAccount } = helpers.account
const { createSnapshot, restoreSnapshot } = helpers.snapshot

describe("L2BitcoinDepositor", () => {
  const contractsFixture = async () => {
    const { deployer, governance } = await helpers.signers.getNamedSigners()

    const accounts = await getUnnamedAccounts()
    const relayer = await ethers.getSigner(accounts[1])

    const wormholeRelayer = await smock.fake<IWormholeRelayer>(
      "IWormholeRelayer"
    )
    const l2WormholeGateway = await smock.fake<IL2WormholeGateway>(
      "IL2WormholeGateway"
    )
    // Just an arbitrary chain ID.
    const l1ChainId = 2
    // Just an arbitrary L1BitcoinDepositor address.
    const l1BitcoinDepositor = "0xeE6F5f69860f310114185677D017576aed0dEC83"

    const deployment = await helpers.upgrades.deployProxy(
      // Hacky workaround allowing to deploy proxy contract any number of times
      // without clearing `deployments/hardhat` directory.
      // See: https://github.com/keep-network/hardhat-helpers/issues/38
      `L2BitcoinDepositor_${randomBytes(8).toString("hex")}`,
      {
        contractName: "L2BitcoinDepositor",
        initializerArgs: [
          wormholeRelayer.address,
          l2WormholeGateway.address,
          l1ChainId,
        ],
        factoryOpts: { signer: deployer },
        proxyOpts: {
          kind: "transparent",
        },
      }
    )
    const l2BitcoinDepositor = deployment[0] as L2BitcoinDepositor

    await l2BitcoinDepositor
      .connect(deployer)
      .transferOwnership(governance.address)

    return {
      governance,
      relayer,
      wormholeRelayer,
      l2WormholeGateway,
      l1BitcoinDepositor,
      l2BitcoinDepositor,
    }
  }

  type InitializeDepositFixture = {
    fundingTx: BitcoinTxInfoStruct
    reveal: DepositRevealInfoStruct
    l2DepositOwner: string
  }

  // Fixture used for initializeDeposit test scenario.
  const initializeDepositFixture: InitializeDepositFixture = {
    fundingTx: {
      version: "0x01000000",
      inputVector:
        "0x01dfe39760a5edabdab013114053d789ada21e356b59fea41d980396" +
        "c1a4474fad0100000023220020e57edf10136b0434e46bc08c5ac5a1e4" +
        "5f64f778a96f984d0051873c7a8240f2ffffffff",
      outputVector:
        "0x02804f1200000000002200202f601522e7bb1f7de5c56bdbd45590b3" +
        "499bad09190581dcaa17e152d8f0c2a9b7e837000000000017a9148688" +
        "4e6be1525dab5ae0b451bd2c72cee67dcf4187",
      locktime: "0x00000000",
    },
    reveal: {
      fundingOutputIndex: 0,
      blindingFactor: "0xba863847d2d0fee3",
      walletPubKeyHash: "0xf997563fee8610ca28f99ac05bd8a29506800d4d",
      refundPubKeyHash: "0x7ac2d9378a1c47e589dfb8095ca95ed2140d2726",
      refundLocktime: "0xde2b4c67",
      vault: "0xB5679dE944A79732A75CE556191DF11F489448d5",
    },
    l2DepositOwner: "0x23b82a7108F9CEb34C3CDC44268be21D151d4124",
  }

  let governance: SignerWithAddress
  let relayer: SignerWithAddress

  let wormholeRelayer: FakeContract<IWormholeRelayer>
  let l2WormholeGateway: FakeContract<IL2WormholeGateway>
  let l1BitcoinDepositor: string
  let l2BitcoinDepositor: L2BitcoinDepositor

  before(async () => {
    // eslint-disable-next-line @typescript-eslint/no-extra-semi
    ;({
      governance,
      relayer,
      wormholeRelayer,
      l2WormholeGateway,
      l1BitcoinDepositor,
      l2BitcoinDepositor,
    } = await waffle.loadFixture(contractsFixture))
  })

  describe("attachL1BitcoinDepositor", () => {
    context("when the caller is not the owner", () => {
      it("should revert", async () => {
        await expect(
          l2BitcoinDepositor
            .connect(relayer)
            .attachL1BitcoinDepositor(l1BitcoinDepositor)
        ).to.be.revertedWith("Ownable: caller is not the owner")
      })
    })

    context("when the caller is the owner", () => {
      context("when the L1BitcoinDepositor is already attached", () => {
        before(async () => {
          await createSnapshot()

          await l2BitcoinDepositor
            .connect(governance)
            .attachL1BitcoinDepositor(l1BitcoinDepositor)
        })

        after(async () => {
          await restoreSnapshot()
        })

        it("should revert", async () => {
          await expect(
            l2BitcoinDepositor
              .connect(governance)
              .attachL1BitcoinDepositor(l1BitcoinDepositor)
          ).to.be.revertedWith("L1 Bitcoin Depositor already set")
        })
      })

      context("when the L1BitcoinDepositor is not attached", () => {
        context("when new L1BitcoinDepositor is zero", () => {
          it("should revert", async () => {
            await expect(
              l2BitcoinDepositor
                .connect(governance)
                .attachL1BitcoinDepositor(ethers.constants.AddressZero)
            ).to.be.revertedWith("L1 Bitcoin Depositor must not be 0x0")
          })
        })

        context("when new L1BitcoinDepositor is non-zero", () => {
          before(async () => {
            await createSnapshot()

            await l2BitcoinDepositor
              .connect(governance)
              .attachL1BitcoinDepositor(l1BitcoinDepositor)
          })

          after(async () => {
            await restoreSnapshot()
          })

          it("should set the l1BitcoinDepositor address properly", async () => {
            expect(await l2BitcoinDepositor.l1BitcoinDepositor()).to.equal(
              l1BitcoinDepositor
            )
          })
        })
      })
    })
  })

  describe("initializeDeposit", () => {
    let tx: ContractTransaction

    before(async () => {
      await createSnapshot()

      tx = await l2BitcoinDepositor
        .connect(relayer)
        .initializeDeposit(
          initializeDepositFixture.fundingTx,
          initializeDepositFixture.reveal,
          initializeDepositFixture.l2DepositOwner
        )
    })

    after(async () => {
      await restoreSnapshot()
    })

    it("should emit DepositInitialized event", async () => {
      const { fundingTx, reveal, l2DepositOwner } = initializeDepositFixture

      // The `expect.to.emit.withArgs` assertion has troubles with
      // matching complex event arguments as it uses strict equality
      // underneath. To overcome that problem, we manually get event's
      // arguments and check it against the expected ones using deep
      // equality assertion (eql).
      const receipt = await ethers.provider.getTransactionReceipt(tx.hash)
      expect(receipt.logs.length).to.be.equal(1)
      expect(
        l2BitcoinDepositor.interface.parseLog(receipt.logs[0]).args
      ).to.be.eql([
        [
          fundingTx.version,
          fundingTx.inputVector,
          fundingTx.outputVector,
          fundingTx.locktime,
        ],
        [
          reveal.fundingOutputIndex,
          reveal.blindingFactor,
          reveal.walletPubKeyHash,
          reveal.refundPubKeyHash,
          reveal.refundLocktime,
          reveal.vault,
        ],
        l2DepositOwner,
        relayer.address,
      ])
    })
  })

  describe("receiveWormholeMessages", () => {
    before(async () => {
      await createSnapshot()

      await l2BitcoinDepositor
        .connect(governance)
        .attachL1BitcoinDepositor(l1BitcoinDepositor)
    })

    after(async () => {
      await restoreSnapshot()
    })

    context("when the caller is not the WormholeRelayer", () => {
      it("should revert", async () => {
        await expect(
          l2BitcoinDepositor
            .connect(relayer)
            // Parameters don't matter as the call should revert before.
            .receiveWormholeMessages(
              ethers.constants.HashZero,
              [],
              ethers.constants.HashZero,
              0,
              ethers.constants.HashZero
            )
        ).to.be.revertedWith("Caller is not Wormhole Relayer")
      })
    })

    context("when the caller is the WormholeRelayer", () => {
      let wormholeRelayerSigner: SignerWithAddress

      before(async () => {
        await createSnapshot()

        wormholeRelayerSigner = await impersonateAccount(
          wormholeRelayer.address,
          {
            from: governance,
            value: 10,
          }
        )
      })

      after(async () => {
        await restoreSnapshot()
      })

      context("when the source chain is not the expected L1", () => {
        it("should revert", async () => {
          await expect(
            l2BitcoinDepositor
              .connect(wormholeRelayerSigner)
              .receiveWormholeMessages(
                ethers.constants.HashZero,
                [],
                ethers.constants.HashZero,
                0,
                ethers.constants.HashZero
              )
          ).to.be.revertedWith("Source chain is not the expected L1 chain")
        })
      })

      context("when the source chain is the expected L1", () => {
        context("when the source address is not the L1BitcoinDepositor", () => {
          it("should revert", async () => {
            await expect(
              l2BitcoinDepositor
                .connect(wormholeRelayerSigner)
                .receiveWormholeMessages(
                  ethers.constants.HashZero,
                  [],
                  toWormholeAddress(relayer.address),
                  await l2BitcoinDepositor.l1ChainId(),
                  ethers.constants.HashZero
                )
            ).to.be.revertedWith(
              "Source address is not the expected L1 Bitcoin depositor"
            )
          })
        })

        context("when the source address is the L1BitcoinDepositor", () => {
          context("when the number of additional VAAs is not 1", () => {
            it("should revert", async () => {
              await expect(
                l2BitcoinDepositor
                  .connect(wormholeRelayerSigner)
                  .receiveWormholeMessages(
                    ethers.constants.HashZero,
                    [],
                    toWormholeAddress(l1BitcoinDepositor),
                    await l2BitcoinDepositor.l1ChainId(),
                    ethers.constants.HashZero
                  )
              ).to.be.revertedWith(
                "Expected 1 additional VAA key for token transfer"
              )
            })
          })

          context("when the number of additional VAAs is 1", () => {
            before(async () => {
              await createSnapshot()

              l2WormholeGateway.receiveTbtc.returns()

              await l2BitcoinDepositor
                .connect(wormholeRelayerSigner)
                .receiveWormholeMessages(
                  ethers.constants.HashZero,
                  ["0x1234"],
                  toWormholeAddress(l1BitcoinDepositor),
                  await l2BitcoinDepositor.l1ChainId(),
                  ethers.constants.HashZero
                )
            })

            after(async () => {
              l2WormholeGateway.receiveTbtc.reset()

              await restoreSnapshot()
            })

            it("should pass the VAA to the L2WormholeGateway", async () => {
              expect(l2WormholeGateway.receiveTbtc).to.have.been.calledOnceWith(
                "0x1234"
              )
            })
          })
        })
      })
    })
  })
})

// eslint-disable-next-line import/prefer-default-export
export function toWormholeAddress(address: string): string {
  return `0x000000000000000000000000${address.slice(2)}`
}
