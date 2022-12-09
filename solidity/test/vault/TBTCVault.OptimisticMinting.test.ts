import { SignerWithAddress } from "@nomiclabs/hardhat-ethers/signers"
import { ethers, getUnnamedAccounts, helpers, waffle } from "hardhat"
import { expect } from "chai"
import { ContractTransaction } from "ethers"
import { FakeContract } from "@defi-wonderland/smock"

import { walletState } from "../fixtures"
import bridgeFixture from "../fixtures/bridge"

import type {
  Bridge,
  BridgeStub,
  BridgeGovernance,
  TBTCVault,
  IRelay,
  VendingMachine,
} from "../../typechain"
import { DepositSweepTestData, SingleP2SHDeposit } from "../data/deposit-sweep"

const { createSnapshot, restoreSnapshot } = helpers.snapshot
const { increaseTime, lastBlockTime } = helpers.time

describe("TBTCVault - OptimisticMinting", () => {
  let bridge: Bridge & BridgeStub
  let bridgeGovernance: BridgeGovernance
  let tbtcVault: TBTCVault
  let vendingMachine: VendingMachine
  let relay: FakeContract<IRelay>

  let governance: SignerWithAddress
  let spvMaintainer: SignerWithAddress

  let account1: SignerWithAddress
  let account2: SignerWithAddress

  // used by bridge.revealDeposit(fundingTx, depositRevealInfo)
  let fundingTx
  let depositRevealInfo

  // used by bridge.submitDepositSweepProof(sweepTx, sweepProof, mainUtxo)
  let sweepTx
  let sweepProof
  let mainUtxo
  let chainDifficulty: number

  // used by tbtcVault.optimisticMint(fundingTxHash, fundingOutputIndex)
  let fundingTxHash: string
  let fundingOutputIndex: number

  let depositKey: string

  before(async () => {
    // eslint-disable-next-line @typescript-eslint/no-extra-semi
    ;({
      governance,
      spvMaintainer,
      relay,
      bridge,
      bridgeGovernance,
      tbtcVault,
      vendingMachine,
    } = await waffle.loadFixture(bridgeFixture))

    // Deployment scripts deploy both `VendingMachine` and `TBTCVault` but they
    // do not transfer the ownership of `TBTC` token to `TBTCVault`.
    // We need to do it manually in tests covering `TBTCVault` behavior.
    const { keepTechnicalWalletTeam, keepCommunityMultiSig } =
      await helpers.signers.getNamedSigners()
    await vendingMachine
      .connect(keepTechnicalWalletTeam)
      .initiateVendingMachineUpgrade(tbtcVault.address)
    await increaseTime(await vendingMachine.GOVERNANCE_DELAY())
    await vendingMachine
      .connect(keepCommunityMultiSig)
      .finalizeVendingMachineUpgrade()

    await bridgeGovernance
      .connect(governance)
      .setVaultStatus(tbtcVault.address, true)

    const accounts = await getUnnamedAccounts()
    account1 = await ethers.getSigner(accounts[0])
    account2 = await ethers.getSigner(accounts[1])

    const bitcoinTestData: DepositSweepTestData = JSON.parse(
      JSON.stringify(SingleP2SHDeposit)
    )
    depositRevealInfo = bitcoinTestData.deposits[0].reveal
    depositRevealInfo.vault = tbtcVault.address
    fundingTx = bitcoinTestData.deposits[0].fundingTx
    fundingTxHash = fundingTx.hash
    fundingOutputIndex = depositRevealInfo.fundingOutputIndex
    // Deposit key is keccak256(fundingTxHash | fundingOutputIndex).
    depositKey = ethers.utils.solidityKeccak256(
      ["bytes32", "uint32"],
      [fundingTxHash, fundingOutputIndex]
    )

    sweepTx = bitcoinTestData.sweepTx
    sweepProof = bitcoinTestData.sweepProof
    mainUtxo = bitcoinTestData.mainUtxo
    chainDifficulty = bitcoinTestData.chainDifficulty

    const { walletPubKeyHash } = depositRevealInfo
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
          tbtcVault
            .connect(account1)
            .optimisticMint(fundingTxHash, fundingOutputIndex)
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
            tbtcVault.connect(minter).optimisticMint(fundingTxHash, 10)
          ).to.be.revertedWith("The deposit has not been revealed")
        })
      })

      context("when the deposit has been revealed", () => {
        context("when the deposit has been swept", () => {
          before(async () => {
            await createSnapshot()

            await bridge.revealDeposit(fundingTx, depositRevealInfo)

            // Necessary to pass the proof validation.
            relay.getPrevEpochDifficulty.returns(chainDifficulty)
            relay.getCurrentEpochDifficulty.returns(chainDifficulty)
            await bridge
              .connect(spvMaintainer)
              .submitDepositSweepProof(
                sweepTx,
                sweepProof,
                mainUtxo,
                tbtcVault.address
              )
          })

          after(async () => {
            await restoreSnapshot()
          })

          it("should revert", async () => {
            await expect(
              tbtcVault
                .connect(minter)
                .optimisticMint(fundingTxHash, fundingOutputIndex)
            ).to.be.revertedWith("The deposit is already swept")
          })
        })

        context("when the deposit is targeted to another vault", () => {
          before(async () => {
            await createSnapshot()

            const anotherVault = "0x42B2bCa0377cEF0027BF308f2a84343D44338Bd9"

            await bridgeGovernance
              .connect(governance)
              .setVaultStatus(anotherVault, true)

            const revealToAnotherVault = JSON.parse(
              JSON.stringify(depositRevealInfo)
            )
            revealToAnotherVault.vault = anotherVault

            await bridge.revealDeposit(fundingTx, revealToAnotherVault)
          })

          after(async () => {
            await restoreSnapshot()
          })

          it("should revert", async () => {
            await expect(
              tbtcVault
                .connect(minter)
                .optimisticMint(fundingTxHash, fundingOutputIndex)
            ).to.be.revertedWith("Unexpected vault address")
          })
        })

        context("when all conditions are met", () => {
          let tx: ContractTransaction

          before(async () => {
            await createSnapshot()

            await bridge.revealDeposit(fundingTx, depositRevealInfo)
            tx = await tbtcVault
              .connect(minter)
              .optimisticMint(fundingTxHash, fundingOutputIndex)
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
              .withArgs(
                minter.address,
                fundingTxHash,
                fundingOutputIndex,
                depositKey
              )
          })
        })
      })
    })
  })
})
