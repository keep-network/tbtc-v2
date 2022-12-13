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
  TBTC,
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
  let tbtc: TBTC
  let vendingMachine: VendingMachine
  let relay: FakeContract<IRelay>

  let governance: SignerWithAddress
  let spvMaintainer: SignerWithAddress

  let minter: SignerWithAddress
  let guardian: SignerWithAddress
  let thirdParty: SignerWithAddress

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
    const accounts = await getUnnamedAccounts()
    minter = await ethers.getSigner(accounts[0])
    guardian = await ethers.getSigner(accounts[1])
    thirdParty = await ethers.getSigner(accounts[2])

    // eslint-disable-next-line @typescript-eslint/no-extra-semi
    ;({
      governance,
      spvMaintainer,
      relay,
      bridge,
      bridgeGovernance,
      tbtcVault,
      tbtc,
      vendingMachine,
    } = await waffle.loadFixture(bridgeFixture))

    // Deployment scripts deploy both `VendingMachine` and `TBTCVault` but they
    // do not transfer the ownership of `TBTC` token to `TBTCVault`.
    // We need to do it manually in tests covering `TBTCVault`'s behavior.
    const { keepTechnicalWalletTeam, keepCommunityMultiSig } =
      await helpers.signers.getNamedSigners()
    await vendingMachine
      .connect(keepTechnicalWalletTeam)
      .initiateVendingMachineUpgrade(tbtcVault.address)
    await increaseTime(await vendingMachine.GOVERNANCE_DELAY())
    await vendingMachine
      .connect(keepCommunityMultiSig)
      .finalizeVendingMachineUpgrade()

    // Deployment scripts to not set the vault's status as trusted. We need to
    // do it manually in tests covering `TBTCVault`'s behavior.
    await bridgeGovernance
      .connect(governance)
      .setVaultStatus(tbtcVault.address, true)

    // Set up test data needed to reveal a deposit via
    // bridge.revealDeposit(fundingTx, depositRevealInfo)
    const bitcoinTestData: DepositSweepTestData = JSON.parse(
      JSON.stringify(SingleP2SHDeposit)
    )
    fundingTx = bitcoinTestData.deposits[0].fundingTx
    depositRevealInfo = bitcoinTestData.deposits[0].reveal
    depositRevealInfo.vault = tbtcVault.address

    // Set the deposit dust threshold to 0.0001 BTC, i.e. 100x smaller than
    // the initial value in the Bridge; we had to save test Bitcoins when
    // generating test data.
    await bridge.setDepositDustThreshold(10000)
    // Disable the reveal ahead period since refund locktimes are fixed
    // within transactions used in this test suite.
    await bridge.setDepositRevealAheadPeriod(0)

    // Set up test data needed to submit deposit sweep proof via
    // bridge.submitDepositSweepProof(sweepTx, sweepProof, mainUtxo)
    chainDifficulty = bitcoinTestData.chainDifficulty
    sweepTx = bitcoinTestData.sweepTx
    sweepProof = bitcoinTestData.sweepProof
    mainUtxo = bitcoinTestData.mainUtxo
    relay.getPrevEpochDifficulty.returns(chainDifficulty)
    relay.getCurrentEpochDifficulty.returns(chainDifficulty)

    // Set up test data needed to request optimistic minting via
    // tbtcVault.optimisticMint(fundingTxHash, fundingOutputIndex)
    fundingTxHash = fundingTx.hash
    fundingOutputIndex = depositRevealInfo.fundingOutputIndex

    // Calculate the key of revealed deposit. This value is used in tests so we
    // calculate it once, in the setup.
    depositKey = ethers.utils.solidityKeccak256(
      ["bytes32", "uint32"],
      [fundingTxHash, fundingOutputIndex]
    )

    // Use the BridgeStubs' test utility functions to register a wallet. We do
    // not want to execute the entire DKG in the setup for this test.
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
  })

  describe("optimisticMint", () => {
    context("when called not by a minter", () => {
      it("should revert", async () => {
        await expect(
          tbtcVault
            .connect(thirdParty)
            .optimisticMint(fundingTxHash, fundingOutputIndex)
        ).to.be.revertedWith("Caller is not a minter")
      })
    })

    context("when called by a minter", () => {
      before(async () => {
        await createSnapshot()
        await tbtcVault.connect(governance).addMinter(minter.address)
      })

      after(async () => {
        await restoreSnapshot()
      })

      context("when optimistic minting is paused", () => {
        before(async () => {
          await createSnapshot()
          await tbtcVault.connect(governance).pauseOptimisticMinting()
        })

        after(async () => {
          await restoreSnapshot()
        })

        it("should revert", async () => {
          await expect(
            tbtcVault
              .connect(minter)
              .optimisticMint(fundingTxHash, fundingOutputIndex)
          ).to.be.revertedWith("Optimistic minting paused")
        })
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
                depositRevealInfo.depositor,
                20000,
                fundingTxHash,
                fundingOutputIndex,
                depositKey
              )
          })
        })
      })
    })
  })

  describe("finalizeOptimisticMint", () => {
    context("when called not by a minter", () => {
      it("should revert", async () => {
        await expect(
          tbtcVault
            .connect(thirdParty)
            .finalizeOptimisticMint(fundingTxHash, fundingOutputIndex)
        ).to.be.revertedWith("Caller is not a minter")
      })
    })

    context("when called by a minter", () => {
      before(async () => {
        await createSnapshot()
        await tbtcVault.connect(governance).addMinter(minter.address)

        await bridge.revealDeposit(fundingTx, depositRevealInfo)
      })

      after(async () => {
        await restoreSnapshot()
      })

      context("when optimistic minting is paused", () => {
        before(async () => {
          await createSnapshot()
          await tbtcVault.connect(governance).pauseOptimisticMinting()
        })

        after(async () => {
          await restoreSnapshot()
        })

        it("should revert", async () => {
          await expect(
            tbtcVault
              .connect(minter)
              .finalizeOptimisticMint(fundingTxHash, fundingOutputIndex)
          ).to.be.revertedWith("Optimistic minting paused")
        })
      })

      context("when minting has not been requested", () => {
        it("should revert", async () => {
          await expect(
            tbtcVault
              .connect(minter)
              .finalizeOptimisticMint(fundingTxHash, fundingOutputIndex)
          ).to.be.revertedWith(
            "Optimistic minting not requested or already finalized"
          )
        })
      })

      context("when the minting delay has not passed yet", () => {
        before(async () => {
          await createSnapshot()

          await tbtcVault
            .connect(minter)
            .optimisticMint(fundingTxHash, fundingOutputIndex)
          await increaseTime(
            (await tbtcVault.OPTIMISTIC_MINTING_DELAY()).sub(1)
          )
        })

        after(async () => {
          await restoreSnapshot()
        })

        it("should revert", async () => {
          await expect(
            tbtcVault
              .connect(minter)
              .finalizeOptimisticMint(fundingTxHash, fundingOutputIndex)
          ).to.be.revertedWith("Optimistic minting delay has not passed yet")
        })
      })

      context("when requested minting has been already finalized", () => {
        before(async () => {
          await createSnapshot()

          await tbtcVault
            .connect(minter)
            .optimisticMint(fundingTxHash, fundingOutputIndex)
          await increaseTime(await tbtcVault.OPTIMISTIC_MINTING_DELAY())
          await tbtcVault
            .connect(minter)
            .finalizeOptimisticMint(fundingTxHash, fundingOutputIndex)
        })

        after(async () => {
          await restoreSnapshot()
        })

        it("should revert", async () => {
          await expect(
            tbtcVault
              .connect(minter)
              .finalizeOptimisticMint(fundingTxHash, fundingOutputIndex)
          ).to.be.revertedWith(
            "Optimistic minting not requested or already finalized"
          )
        })
      })

      context("when the deposit has been already swept", () => {
        before(async () => {
          await createSnapshot()

          await tbtcVault
            .connect(minter)
            .optimisticMint(fundingTxHash, fundingOutputIndex)
          await increaseTime(await tbtcVault.OPTIMISTIC_MINTING_DELAY())

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
              .finalizeOptimisticMint(fundingTxHash, fundingOutputIndex)
          ).to.be.revertedWith("The deposit is already swept")
        })
      })

      context("when all conditions are met", () => {
        let tx: ContractTransaction

        before(async () => {
          await createSnapshot()

          await tbtcVault
            .connect(minter)
            .optimisticMint(fundingTxHash, fundingOutputIndex)
          await increaseTime(await tbtcVault.OPTIMISTIC_MINTING_DELAY())

          tx = await tbtcVault
            .connect(minter)
            .finalizeOptimisticMint(fundingTxHash, fundingOutputIndex)
        })

        after(async () => {
          await restoreSnapshot()
        })

        it("should mint TBTC", async () => {
          // Deposit treasury fee is 0.05%. The output value is 0.0002 BTC.
          // Treasury fee is deducted so we should mint 19990 sat.
          expect(await tbtc.balanceOf(depositRevealInfo.depositor)).to.be.equal(
            19990
          )
        })

        it("should incur optimistic mint debt", async () => {
          expect(
            await tbtcVault.optimisticMintingDebt(depositRevealInfo.depositor)
          ).to.be.equal(19990)
        })

        it("should remove the request", async () => {
          expect(await tbtcVault.pendingOptimisticMints(depositKey)).to.equal(0)
        })

        it("should emit an event", async () => {
          await expect(tx)
            .to.emit(tbtcVault, "OptimisticMintingFinalized")
            .withArgs(
              minter.address,
              depositRevealInfo.depositor,
              19990,
              fundingTxHash,
              fundingOutputIndex,
              depositKey
            )
        })
      })
    })
  })

  describe("cancelOptimisticMint", () => {
    context("when called not by a guardian", () => {
      it("should revert", async () => {
        await expect(
          tbtcVault
            .connect(thirdParty)
            .cancelOptimisticMint(fundingTxHash, fundingOutputIndex)
        ).to.be.revertedWith("Caller is not a guardian")
      })
    })

    context("when called by a guardian", () => {
      before(async () => {
        await createSnapshot()
        await tbtcVault.connect(governance).addMinter(minter.address)
        await tbtcVault.connect(governance).addGuardian(guardian.address)

        await bridge.revealDeposit(fundingTx, depositRevealInfo)
      })

      after(async () => {
        await restoreSnapshot()
      })

      context("when minting has not been requested", () => {
        it("should revert", async () => {
          await expect(
            tbtcVault.connect(guardian).cancelOptimisticMint(fundingTxHash, 99)
          ).to.be.revertedWith(
            "Optimistic minting not requested of already finalized"
          )
        })
      })

      context("when requested minting has been finalized", () => {
        before(async () => {
          await createSnapshot()

          await tbtcVault
            .connect(minter)
            .optimisticMint(fundingTxHash, fundingOutputIndex)
          await increaseTime(await tbtcVault.OPTIMISTIC_MINTING_DELAY())
          await tbtcVault
            .connect(minter)
            .finalizeOptimisticMint(fundingTxHash, fundingOutputIndex)
        })

        after(async () => {
          await restoreSnapshot()
        })

        it("should revert", async () => {
          await expect(
            tbtcVault
              .connect(guardian)
              .cancelOptimisticMint(fundingTxHash, fundingOutputIndex)
          ).to.be.revertedWith(
            "Optimistic minting not requested of already finalized"
          )
        })
      })

      context("when requested minting has not been finalized", () => {
        let tx: ContractTransaction

        before(async () => {
          await createSnapshot()

          await tbtcVault
            .connect(minter)
            .optimisticMint(fundingTxHash, fundingOutputIndex)

          tx = await tbtcVault
            .connect(guardian)
            .cancelOptimisticMint(fundingTxHash, fundingOutputIndex)
        })

        after(async () => {
          await restoreSnapshot()
        })

        it("should cancel optimistic minting", async () => {
          expect(
            await tbtcVault.pendingOptimisticMints(depositKey)
          ).to.be.equal(0)

          await increaseTime(await tbtcVault.OPTIMISTIC_MINTING_DELAY())
          await expect(
            tbtcVault
              .connect(minter)
              .finalizeOptimisticMint(fundingTxHash, fundingOutputIndex)
          ).to.be.revertedWith(
            "Optimistic minting not requested or already finalized"
          )
        })

        it("should emit an event", async () => {
          await expect(tx)
            .to.emit(tbtcVault, "OptimisticMintingCancelled")
            .withArgs(
              guardian.address,
              fundingTxHash,
              fundingOutputIndex,
              depositKey
            )
        })
      })
    })
  })

  describe("addMinter", () => {
    context("when called not by the governance", () => {
      it("should revert", async () => {
        await expect(
          tbtcVault.connect(minter).addMinter(minter.address)
        ).to.be.revertedWith("Ownable: caller is not the owner")
      })
    })

    context("when called by the governance", () => {
      context("when address is not a minter", () => {
        let tx: ContractTransaction

        before(async () => {
          await createSnapshot()

          tx = await tbtcVault.connect(governance).addMinter(minter.address)
        })

        after(async () => {
          await restoreSnapshot()
        })

        it("should add address as a minter", async () => {
          // eslint-disable-next-line @typescript-eslint/no-unused-expressions
          expect(await tbtcVault.isMinter(minter.address)).to.be.true
        })

        it("should emit an event", async () => {
          await expect(tx)
            .to.emit(tbtcVault, "MinterAdded")
            .withArgs(minter.address)
        })
      })

      context("when address is a minter", () => {
        before(async () => {
          await createSnapshot()

          await tbtcVault.connect(governance).addMinter(minter.address)
        })

        after(async () => {
          await restoreSnapshot()
        })

        it("should revert", async () => {
          await expect(
            tbtcVault.connect(governance).addMinter(minter.address)
          ).to.be.revertedWith("This address is already a minter")
        })
      })
    })
  })

  describe("removeMinter", () => {
    context("when called not by the governance or a guardian", () => {
      it("should revert", async () => {
        await expect(
          tbtcVault.connect(thirdParty).removeMinter(minter.address)
        ).to.be.revertedWith("Caller is not the owner or guardian")
      })
    })

    context("when called by the governance", () => {
      context("when address is a minter", () => {
        let tx: ContractTransaction

        before(async () => {
          await createSnapshot()

          await tbtcVault.connect(governance).addMinter(minter.address)
          tx = await tbtcVault.connect(governance).removeMinter(minter.address)
        })

        after(async () => {
          await restoreSnapshot()
        })

        it("should take minter role from the address", async () => {
          // eslint-disable-next-line @typescript-eslint/no-unused-expressions
          expect(await tbtcVault.isMinter(minter.address)).to.be.false
        })

        it("should emit an event", async () => {
          await expect(tx)
            .to.emit(tbtcVault, "MinterRemoved")
            .withArgs(minter.address)
        })
      })

      context("when address is not a minter", () => {
        it("should revert", async () => {
          await expect(
            tbtcVault.connect(governance).removeMinter(thirdParty.address)
          ).to.be.revertedWith("This address is not a minter")
        })
      })
    })

    context("when called by a guardian", () => {
      context("when address is a minter", () => {
        let tx: ContractTransaction

        before(async () => {
          await createSnapshot()

          await tbtcVault.connect(governance).addMinter(minter.address)
          await tbtcVault.connect(governance).addGuardian(guardian.address)
          tx = await tbtcVault.connect(guardian).removeMinter(minter.address)
        })

        after(async () => {
          await restoreSnapshot()
        })

        it("should take minter role from the address", async () => {
          // eslint-disable-next-line @typescript-eslint/no-unused-expressions
          expect(await tbtcVault.isMinter(minter.address)).to.be.false
        })

        it("should emit an event", async () => {
          await expect(tx)
            .to.emit(tbtcVault, "MinterRemoved")
            .withArgs(minter.address)
        })
      })

      context("when address is not a minter", () => {
        before(async () => {
          await createSnapshot()

          await tbtcVault.connect(governance).addGuardian(guardian.address)
        })

        after(async () => {
          await restoreSnapshot()
        })

        it("should revert", async () => {
          await expect(
            tbtcVault.connect(guardian).removeMinter(thirdParty.address)
          ).to.be.revertedWith("This address is not a minter")
        })
      })
    })
  })

  describe("addGuardian", () => {
    context("when called not by the governance", () => {
      it("should revert", async () => {
        await expect(
          tbtcVault.connect(guardian).addGuardian(guardian.address)
        ).to.be.revertedWith("Ownable: caller is not the owner")
      })
    })

    context("when called by the governance", () => {
      context("when address is not a guardian", () => {
        let tx: ContractTransaction

        before(async () => {
          await createSnapshot()

          tx = await tbtcVault.connect(governance).addGuardian(guardian.address)
        })

        after(async () => {
          await restoreSnapshot()
        })

        it("should add address as a guardian", async () => {
          // eslint-disable-next-line @typescript-eslint/no-unused-expressions
          expect(await tbtcVault.isGuardian(guardian.address)).to.be.true
        })

        it("should emit an event", async () => {
          await expect(tx)
            .to.emit(tbtcVault, "GuardianAdded")
            .withArgs(guardian.address)
        })
      })

      context("when address is a guardian", () => {
        before(async () => {
          await createSnapshot()

          await tbtcVault.connect(governance).addGuardian(guardian.address)
        })

        after(async () => {
          await restoreSnapshot()
        })

        it("should revert", async () => {
          await expect(
            tbtcVault.connect(governance).addGuardian(guardian.address)
          ).to.be.revertedWith("This address is already a guardian")
        })
      })
    })
  })

  describe("removeGuardian", () => {
    context("when called not by the governance", () => {
      it("should revert", async () => {
        await expect(
          tbtcVault.connect(thirdParty).removeGuardian(guardian.address)
        ).to.be.revertedWith("Ownable: caller is not the owner")
      })
    })

    context("when called by the governance", () => {
      context("when address is a guardian", () => {
        let tx: ContractTransaction

        before(async () => {
          await createSnapshot()

          await tbtcVault.connect(governance).addGuardian(guardian.address)
          tx = await tbtcVault
            .connect(governance)
            .removeGuardian(guardian.address)
        })

        after(async () => {
          await restoreSnapshot()
        })

        it("should take guardian role from the address", async () => {
          // eslint-disable-next-line @typescript-eslint/no-unused-expressions
          expect(await tbtcVault.isGuardian(guardian.address)).to.be.false
        })

        it("should emit an event", async () => {
          await expect(tx)
            .to.emit(tbtcVault, "GuardianRemoved")
            .withArgs(guardian.address)
        })
      })

      context("when address is not a guardian", () => {
        it("should revert", async () => {
          await expect(
            tbtcVault.connect(governance).removeGuardian(guardian.address)
          ).to.be.revertedWith("This address is not a guardian")
        })
      })
    })
  })

  describe("pauseOptimisticMinting", () => {
    context("when called not by the governance", () => {
      it("should revert", async () => {
        await expect(
          tbtcVault.connect(thirdParty).pauseOptimisticMinting()
        ).to.be.revertedWith("Ownable: caller is not the owner")
      })
    })

    context("when called by the governance", () => {
      context("when optimistic minting is already paused", () => {
        before(async () => {
          await createSnapshot()
          await tbtcVault.connect(governance).pauseOptimisticMinting()
        })

        after(async () => {
          await restoreSnapshot()
        })

        it("should revert", async () => {
          await expect(
            tbtcVault.connect(governance).pauseOptimisticMinting()
          ).to.be.revertedWith("Optimistic minting already paused")
        })
      })

      context("when optimistic minting is not paused", () => {
        let tx: ContractTransaction

        before(async () => {
          await createSnapshot()
          tx = await tbtcVault.connect(governance).pauseOptimisticMinting()
        })

        after(async () => {
          await restoreSnapshot()
        })

        it("should pause optimistic minting", async () => {
          // eslint-disable-next-line @typescript-eslint/no-unused-expressions
          expect(await tbtcVault.isOptimisticMintingPaused()).to.be.true
        })

        it("should emit an event", async () => {
          await expect(tx).to.emit(tbtcVault, "OptimisticMintingPaused")
        })
      })
    })
  })

  describe("unpauseOptimisticMinting", () => {
    context("when called not by the governance", () => {
      it("should revert", async () => {
        await expect(
          tbtcVault.connect(thirdParty).unpauseOptimisticMinting()
        ).to.be.revertedWith("Ownable: caller is not the owner")
      })
    })

    context("when called by the governance", () => {
      context("when optimistic minting is not paused", () => {
        it("should revert", async () => {
          await expect(
            tbtcVault.connect(governance).unpauseOptimisticMinting()
          ).to.be.revertedWith("Optimistic minting is not paused")
        })
      })

      context("when optimistic minting is paused", () => {
        let tx: ContractTransaction

        before(async () => {
          await createSnapshot()
          await tbtcVault.connect(governance).pauseOptimisticMinting()
          tx = await tbtcVault.connect(governance).unpauseOptimisticMinting()
        })

        after(async () => {
          await restoreSnapshot()
        })

        it("should unpause optimistic minting", async () => {
          // eslint-disable-next-line @typescript-eslint/no-unused-expressions
          expect(await tbtcVault.isOptimisticMintingPaused()).to.be.false
        })

        it("should emit an event", async () => {
          await expect(tx).to.emit(tbtcVault, "OptimisticMintingUnpaused")
        })
      })
    })
  })
})
