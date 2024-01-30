import { ethers, helpers } from "hardhat"
import { expect } from "chai"
import { BigNumber, ContractTransaction } from "ethers"
import type {
  MockBridge,
  MockTBTCVault,
  TestTBTCDepositorProxy,
} from "../../typechain"
import { to1ePrecision } from "../helpers/contract-test-helpers"

const { createSnapshot, restoreSnapshot } = helpers.snapshot
const { lastBlockTime } = helpers.time

const loadFixture = (vault: string) => ({
  fundingTx: {
    version: "0x01000000",
    inputVector:
      "0x018348cdeb551134fe1f19d378a8adec9b146671cb67b945b71bf56b20d" +
      "c2b952f0100000000ffffffff",
    outputVector:
      "0x021027000000000000220020bfaeddba12b0de6feeb649af76376876bc1" +
      "feb6c2248fbfef9293ba3ac51bb4a10d73b00000000001600147ac2d9378a" +
      "1c47e589dfb8095ca95ed2140d2726",
    locktime: "0x00000000",
  },
  reveal: {
    fundingOutputIndex: 0,
    blindingFactor: "0xf9f0c90d00039523",
    walletPubKeyHash: "0x8db50eb52063ea9d98b3eac91489a90f738986f6",
    refundPubKeyHash: "0x28e081f285138ccbe389c1eb8985716230129f89",
    refundLocktime: "0x60bcea61",
    vault,
  },
  extraData:
    "0xa9b38ea6435c8941d6eda6a46b68e3e2117196995bd154ab55196396b03d9bda",
  expectedDepositKey:
    "0xebff13c2304229ab4a97bfbfabeac82c9c0704e4aae2acf022252ac8dc1101d1",
})

describe("TBTCDepositorProxy", () => {
  let bridge: MockBridge
  let tbtcVault: MockTBTCVault
  let depositorProxy: TestTBTCDepositorProxy

  let fixture

  before(async () => {
    const MockBridge = await ethers.getContractFactory("MockBridge")
    bridge = await MockBridge.deploy()

    const MockTBTCVault = await ethers.getContractFactory("MockTBTCVault")
    tbtcVault = await MockTBTCVault.deploy()

    fixture = loadFixture(tbtcVault.address)

    const TestTBTCDepositorProxy = await ethers.getContractFactory(
      "TestTBTCDepositorProxy"
    )
    depositorProxy = await TestTBTCDepositorProxy.deploy()
    await depositorProxy.initialize(bridge.address, tbtcVault.address)

    // Assert that contract initializer works as expected.
    await expect(
      depositorProxy.initialize(bridge.address, tbtcVault.address)
    ).to.be.revertedWith("TBTCDepositorProxy already initialized")
  })

  describe("initializeDeposit", () => {
    context("when revealed vault does not match", () => {
      it("should revert", async () => {
        // Load the fixture with a different vault address.
        const { fundingTx, reveal, extraData } = loadFixture(
          ethers.constants.AddressZero
        )

        await expect(
          depositorProxy.initializeDepositPublic(fundingTx, reveal, extraData)
        ).to.be.revertedWith("Vault address mismatch")
      })
    })

    context("when revealed vault matches", () => {
      context("when deposit is rejected by the Bridge", () => {
        before(async () => {
          await createSnapshot()

          // Pre-reveal the deposit to cause a revert on the second attempt
          // made by the TBTCDepositorProxy.
          await bridge.revealDepositWithExtraData(
            fixture.fundingTx,
            fixture.reveal,
            fixture.extraData
          )
        })

        after(async () => {
          await restoreSnapshot()
        })

        it("should revert", async () => {
          await expect(
            depositorProxy.initializeDepositPublic(
              fixture.fundingTx,
              fixture.reveal,
              fixture.extraData
            )
          ).to.be.revertedWith("Deposit already revealed")
        })
      })

      context("when deposit is accepted by the Bridge", () => {
        let tx: ContractTransaction

        before(async () => {
          await createSnapshot()

          tx = await depositorProxy.initializeDepositPublic(
            fixture.fundingTx,
            fixture.reveal,
            fixture.extraData
          )
        })

        after(async () => {
          await restoreSnapshot()
        })

        it("should reveal the deposit to the Bridge", async () => {
          await expect(tx)
            .to.emit(bridge, "DepositRevealed")
            .withArgs(fixture.expectedDepositKey)
        })

        it("should store the deposit as pending", async () => {
          // eslint-disable-next-line @typescript-eslint/no-unused-expressions
          expect(
            await depositorProxy.pendingDeposits(fixture.expectedDepositKey)
          ).to.be.true
        })

        it("should emit the DepositInitialized event", async () => {
          await expect(tx)
            .to.emit(depositorProxy, "DepositInitialized")
            .withArgs(fixture.expectedDepositKey, await lastBlockTime())
        })
      })
    })
  })

  describe("finalizeDeposit", () => {
    context("when deposit is not initialized", () => {
      it("should revert", async () => {
        await expect(
          depositorProxy.finalizeDepositPublic(fixture.expectedDepositKey)
        ).to.be.revertedWith("Deposit not initialized")
      })
    })

    context("when deposit is already finalized", () => {
      before(async () => {
        await createSnapshot()

        await depositorProxy.initializeDepositPublic(
          fixture.fundingTx,
          fixture.reveal,
          fixture.extraData
        )

        await bridge.sweepDeposit(fixture.expectedDepositKey)

        await depositorProxy.finalizeDepositPublic(fixture.expectedDepositKey)
      })

      after(async () => {
        await restoreSnapshot()
      })

      it("should revert", async () => {
        await expect(
          depositorProxy.finalizeDepositPublic(fixture.expectedDepositKey)
        ).to.be.revertedWith("Deposit not initialized")
      })
    })

    context("when deposit is initialized but not finalized yet", () => {
      before(async () => {
        await createSnapshot()

        await depositorProxy.initializeDepositPublic(
          fixture.fundingTx,
          fixture.reveal,
          fixture.extraData
        )
      })

      after(async () => {
        await restoreSnapshot()
      })

      context("when deposit is not finalized by the Bridge", () => {
        it("should revert", async () => {
          await expect(
            depositorProxy.finalizeDepositPublic(fixture.expectedDepositKey)
          ).to.be.revertedWith("Deposit not finalized by the bridge")
        })
      })

      context("when deposit is finalized by the Bridge", () => {
        // The expected tbtcAmount is calculated as follows:
        //
        // - Deposited amount = 10 BTC (hardcoded in MockBridge)
        // - Treasury fee = 1 BTC (hardcoded in MockBridge)
        // - Optimistic minting fee = 1%  (hardcoded in MockTBTCVault)
        // - Transaction max fee = 0.1 BTC (hardcoded in MockBridge)
        //
        // ((10 BTC - 1 BTC) * 0.99) - 0.1 BTC = 8.81 BTC = 8.81 * 1e8 sat = 8.81 * 1e18 TBTC
        const expectedTbtcAmount = to1ePrecision(881, 16).toString()

        context("when the deposit is swept", () => {
          let tx: ContractTransaction

          before(async () => {
            await createSnapshot()

            await bridge.sweepDeposit(fixture.expectedDepositKey)

            tx = await depositorProxy.finalizeDepositPublic(
              fixture.expectedDepositKey
            )
          })

          after(async () => {
            await restoreSnapshot()
          })

          it("should remove the deposit from pending", async () => {
            // eslint-disable-next-line @typescript-eslint/no-unused-expressions
            expect(
              await depositorProxy.pendingDeposits(fixture.expectedDepositKey)
            ).to.be.false
          })

          it("should emit the DepositFinalized event", async () => {
            await expect(tx)
              .to.emit(depositorProxy, "DepositFinalized")
              .withArgs(
                fixture.expectedDepositKey,
                expectedTbtcAmount,
                await lastBlockTime()
              )
          })

          it("should call onDepositFinalized with proper params", async () => {
            await expect(tx)
              .to.emit(depositorProxy, "OnDepositFinalizedCalled")
              .withArgs(
                fixture.expectedDepositKey,
                expectedTbtcAmount,
                fixture.extraData
              )
          })
        })

        context("when the deposit is optimistically minted", () => {
          let tx: ContractTransaction

          before(async () => {
            await createSnapshot()

            await tbtcVault.createOptimisticMintingRequest(
              fixture.expectedDepositKey
            )

            await tbtcVault.finalizeOptimisticMintingRequest(
              fixture.expectedDepositKey
            )

            tx = await depositorProxy.finalizeDepositPublic(
              fixture.expectedDepositKey
            )
          })

          after(async () => {
            await restoreSnapshot()
          })

          it("should remove the deposit from pending", async () => {
            // eslint-disable-next-line @typescript-eslint/no-unused-expressions
            expect(
              await depositorProxy.pendingDeposits(fixture.expectedDepositKey)
            ).to.be.false
          })

          it("should emit the DepositFinalized event", async () => {
            await expect(tx)
              .to.emit(depositorProxy, "DepositFinalized")
              .withArgs(
                fixture.expectedDepositKey,
                expectedTbtcAmount,
                await lastBlockTime()
              )
          })

          it("should call onDepositFinalized with proper params", async () => {
            await expect(tx)
              .to.emit(depositorProxy, "OnDepositFinalizedCalled")
              .withArgs(
                fixture.expectedDepositKey,
                expectedTbtcAmount,
                fixture.extraData
              )
          })
        })
      })
    })
  })
})