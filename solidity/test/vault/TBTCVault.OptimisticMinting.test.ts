import { SignerWithAddress } from "@nomiclabs/hardhat-ethers/signers"
import { ethers, getUnnamedAccounts, helpers, waffle } from "hardhat"
import { expect } from "chai"
import { ContractTransaction } from "ethers"

import { walletState } from "../fixtures"
import bridgeFixture from "../fixtures/bridge"

import type {
  Bridge,
  BridgeStub,
  BridgeGovernance,
  TBTCVault,
} from "../../typechain"

const { createSnapshot, restoreSnapshot } = helpers.snapshot
const { lastBlockTime } = helpers.time

describe("TBTCVault - OptimisticMinting", () => {
  const walletPubKeyHash = "0x8db50eb52063ea9d98b3eac91489a90f738986f6"

  const mainUtxo = {
    txHash:
      "0x3835ecdee2daa83c9a19b5012104ace55ecab197b5e16489c26d372e475f5d2a",
    txOutputIndex: 0,
    txOutputValue: 10000000,
  }

  // Data of a proper P2SH deposit funding transaction. Little-endian hash is:
  // 0x17350f81cdb61cd8d7014ad1507d4af8d032b75812cf88d2c636c1c022991af2 and
  // this is the same as `expectedP2SHDeposit.transaction` mentioned in
  // tbtc-ts/test/deposit.test.ts file.
  const P2SHFundingTx = {
    version: "0x01000000",
    inputVector:
      "0x018348cdeb551134fe1f19d378a8adec9b146671cb67b945b71bf56b20d" +
      "c2b952f0100000000ffffffff",
    outputVector:
      "0x02102700000000000017a9142c1444d23936c57bdd8b3e67e5938a5440c" +
      "da455877ed73b00000000001600147ac2d9378a1c47e589dfb8095ca95ed2" +
      "140d2726",
    locktime: "0x00000000",
  }

  // Data matching the redeem script locking the funding output of
  // P2SHFundingTx.
  let depositReveal
  let depositKey

  let bridge: Bridge & BridgeStub
  let bridgeGovernance: BridgeGovernance
  let tbtcVault: TBTCVault

  let governance: SignerWithAddress

  let account1: SignerWithAddress
  let account2: SignerWithAddress

  before(async () => {
    // eslint-disable-next-line @typescript-eslint/no-extra-semi
    ;({ governance, bridge, bridgeGovernance, tbtcVault } =
      await waffle.loadFixture(bridgeFixture))

    await bridgeGovernance
      .connect(governance)
      .setVaultStatus(tbtcVault.address, true)

    const accounts = await getUnnamedAccounts()
    account1 = await ethers.getSigner(accounts[0])
    account2 = await ethers.getSigner(accounts[1])

    await bridge.setWallet(walletPubKeyHash, {
      ecdsaWalletID: ethers.constants.HashZero,
      mainUtxoHash: ethers.constants.HashZero,
      pendingRedemptionsValue: 0,
      createdAt: await lastBlockTime(),
      movingFundsRequestedAt: 0,
      closingStartedAt: 0,
      pendingMovedFundsSweepRequestsCount: 0,
      state: walletState.Live,
      movingFundsTargetWalletsCommitmentHash: ethers.constants.HashZero,
    })
    await bridge.setWalletMainUtxo(walletPubKeyHash, mainUtxo)

    // Set the deposit dust threshold to 0.0001 BTC, i.e. 100x smaller than
    // the initial value in the Bridge; we had to save test Bitcoins when
    // generating test data.
    await bridge.setDepositDustThreshold(10000)
    // Disable the reveal ahead period since refund locktimes are fixed
    // within transactions used in this test suite.
    await bridge.setDepositRevealAheadPeriod(0)

    depositReveal = {
      fundingOutputIndex: 0,
      depositor: "0x934B98637cA318a4D6E7CA6ffd1690b8e77df637",
      blindingFactor: "0xf9f0c90d00039523",
      // HASH160 of 03989d253b17a6a0f41838b84ff0d20e8898f9d7b1a98f2564da4cc29dcf8581d9.
      walletPubKeyHash: "0x8db50eb52063ea9d98b3eac91489a90f738986f6",
      // HASH160 of 0300d6f28a2f6bf9836f57fcda5d284c9a8f849316119779f0d6090830d97763a9.
      refundPubKeyHash: "0x28e081f285138ccbe389c1eb8985716230129f89",
      refundLocktime: "0x60bcea61",
      vault: tbtcVault.address,
    }

    // Deposit key is keccak256(fundingTxHash | fundingOutputIndex).
    depositKey = ethers.utils.solidityKeccak256(
      ["bytes32", "uint32"],
      [
        "0x17350f81cdb61cd8d7014ad1507d4af8d032b75812cf88d2c636c1c022991af2",
        depositReveal.fundingOutputIndex,
      ]
    )
  })

  describe("addMinter", () => {
    context("when called not by the governance", () => {
      it("should revert", async () => {
        await expect(
          tbtcVault.connect(account1).addMinter(account1.address)
        ).to.be.revertedWith("Ownable: caller is not the owner")
      })
    })

    context("when called by the governance", () => {
      context("when address is not a minter", () => {
        let tx: ContractTransaction

        before(async () => {
          await createSnapshot()

          tx = await tbtcVault.connect(governance).addMinter(account1.address)
        })

        after(async () => {
          await restoreSnapshot()
        })

        it("should add address as a minter", async () => {
          // eslint-disable-next-line @typescript-eslint/no-unused-expressions
          expect(await tbtcVault.isMinter(account1.address)).to.be.true
        })

        it("should emit an event", async () => {
          await expect(tx)
            .to.emit(tbtcVault, "MinterAdded")
            .withArgs(account1.address)
        })
      })

      context("when address is a minter", () => {
        before(async () => {
          await createSnapshot()

          await tbtcVault.connect(governance).addMinter(account1.address)
        })

        after(async () => {
          await restoreSnapshot()
        })

        it("should revert", async () => {
          await expect(
            tbtcVault.connect(governance).addMinter(account1.address)
          ).to.be.revertedWith("This address is already a minter")
        })
      })
    })
  })

  describe("removeMinter", () => {
    context("when called not by the governance", () => {
      it("should revert", async () => {
        await expect(
          tbtcVault.connect(account1).removeMinter(account1.address)
        ).to.be.revertedWith("Ownable: caller is not the owner")
      })
    })

    context("when called by the governance", () => {
      context("when address is a minter", () => {
        let tx: ContractTransaction

        before(async () => {
          await createSnapshot()

          await tbtcVault.connect(governance).addMinter(account1.address)
          tx = await tbtcVault
            .connect(governance)
            .removeMinter(account1.address)
        })

        after(async () => {
          await restoreSnapshot()
        })

        it("should take minter role from the address", async () => {
          // eslint-disable-next-line @typescript-eslint/no-unused-expressions
          expect(await tbtcVault.isMinter(account1.address)).to.be.false
        })

        it("should emit an event", async () => {
          await expect(tx)
            .to.emit(tbtcVault, "MinterRemoved")
            .withArgs(account1.address)
        })
      })

      context("when address is not a minter", () => {
        it("should revert", async () => {
          await expect(
            tbtcVault.connect(governance).removeMinter(account1.address)
          ).to.be.revertedWith("This address is not a minter")
        })
      })
    })
  })

  describe("addGuard", () => {
    context("when called not by the governance", () => {
      it("should revert", async () => {
        await expect(
          tbtcVault.connect(account1).addGuard(account1.address)
        ).to.be.revertedWith("Ownable: caller is not the owner")
      })
    })

    context("when called by the governance", () => {
      context("when address is not a guard", () => {
        let tx: ContractTransaction

        before(async () => {
          await createSnapshot()

          tx = await tbtcVault.connect(governance).addGuard(account1.address)
        })

        after(async () => {
          await restoreSnapshot()
        })

        it("should add address as a guard", async () => {
          // eslint-disable-next-line @typescript-eslint/no-unused-expressions
          expect(await tbtcVault.isGuard(account1.address)).to.be.true
        })

        it("should emit an event", async () => {
          await expect(tx)
            .to.emit(tbtcVault, "GuardAdded")
            .withArgs(account1.address)
        })
      })

      context("when address is a guard", () => {
        before(async () => {
          await createSnapshot()

          await tbtcVault.connect(governance).addGuard(account1.address)
        })

        after(async () => {
          await restoreSnapshot()
        })

        it("should revert", async () => {
          await expect(
            tbtcVault.connect(governance).addGuard(account1.address)
          ).to.be.revertedWith("This address is already a guard")
        })
      })
    })
  })

  describe("removeGuard", () => {
    context("when called not by the governance", () => {
      it("should revert", async () => {
        await expect(
          tbtcVault.connect(account1).removeGuard(account1.address)
        ).to.be.revertedWith("Ownable: caller is not the owner")
      })
    })

    context("when called by the governance", () => {
      context("when address is a guard", () => {
        let tx: ContractTransaction

        before(async () => {
          await createSnapshot()

          await tbtcVault.connect(governance).addGuard(account1.address)
          tx = await tbtcVault.connect(governance).removeGuard(account1.address)
        })

        after(async () => {
          await restoreSnapshot()
        })

        it("should take guard role from the address", async () => {
          // eslint-disable-next-line @typescript-eslint/no-unused-expressions
          expect(await tbtcVault.isGuard(account1.address)).to.be.false
        })

        it("should emit an event", async () => {
          await expect(tx)
            .to.emit(tbtcVault, "GuardRemoved")
            .withArgs(account1.address)
        })
      })

      context("when address is not a guard", () => {
        it("should revert", async () => {
          await expect(
            tbtcVault.connect(governance).removeGuard(account1.address)
          ).to.be.revertedWith("This address is not a guard")
        })
      })
    })
  })

  describe("optimisticMint", () => {
    context("when called not by a minter", () => {
      it("should revert", async () => {
        await expect(
          tbtcVault.connect(account1).optimisticMint(1)
        ).to.be.revertedWith("Caller is not a minter")
      })
    })

    context("when called by a minter", () => {
      let minter: SignerWithAddress

      before(async () => {
        await createSnapshot()

        minter = account1
        await tbtcVault.connect(governance).addMinter(minter.address)
      })

      after(async () => {
        await restoreSnapshot()
      })

      context("when the deposit has not been revealed", () => {
        it("should revert", async () => {
          await expect(
            tbtcVault.connect(minter).optimisticMint(1)
          ).to.be.revertedWith("The deposit has not been revealed")
        })
      })

      context("when the deposit has been revealed", () => {
        context("when the deposit is targeted to another vault", () => {
          before(async () => {
            await createSnapshot()

            const anotherVault = "0x42B2bCa0377cEF0027BF308f2a84343D44338Bd9"

            await bridgeGovernance
              .connect(governance)
              .setVaultStatus(anotherVault, true)

            const revealToAnotherVault = JSON.parse(
              JSON.stringify(depositReveal)
            )
            revealToAnotherVault.vault = anotherVault

            await bridge.revealDeposit(P2SHFundingTx, revealToAnotherVault)
          })

          after(async () => {
            await restoreSnapshot()
          })

          it("should revert", async () => {
            await expect(
              tbtcVault.connect(minter).optimisticMint(depositKey)
            ).to.be.revertedWith("Unexpected vault address")
          })
        })

        context("when all conditions are met", () => {
          let tx: ContractTransaction

          before(async () => {
            await createSnapshot()

            await bridge.revealDeposit(P2SHFundingTx, depositReveal)
            tx = await tbtcVault.connect(minter).optimisticMint(depositKey)
          })

          after(async () => {
            await restoreSnapshot()
          })

          it("should register pending optimistic mint", async () => {
            expect(
              await tbtcVault.pendingOptimisticMints(depositKey)
            ).to.be.equal(await lastBlockTime())
          })

          it("should emit an event", async () => {
            await expect(tx)
              .to.emit(tbtcVault, "OptimisticMintingRequested")
              .withArgs(minter.address, depositKey)
          })
        })
      })
    })
  })
})
