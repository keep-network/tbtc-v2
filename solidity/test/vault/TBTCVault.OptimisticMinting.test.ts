import { SignerWithAddress } from "@nomiclabs/hardhat-ethers/signers"
import { ethers, getUnnamedAccounts, helpers, waffle } from "hardhat"
import { expect } from "chai"
import { ContractTransaction } from "ethers"
import { FakeContract, smock } from "@defi-wonderland/smock"

import { walletState, constants } from "../fixtures"
import bridgeFixture from "../fixtures/bridge"

import {
  Bank,
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

  let deployer: SignerWithAddress
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

  // used by tbtcVault.requestOptimisticMint(fundingTxHash, fundingOutputIndex)
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
      deployer,
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
    // the initial value in the Bridge in order to save test Bitcoins.
    // Scaling down deposit TX max fee as well.
    await bridge.setDepositDustThreshold(10000)
    await bridge.setDepositTxMaxFee(2000)
    // Disable the reveal ahead period since refund locktimes are fixed
    // within transactions used in this test suite.
    await bridge.setDepositRevealAheadPeriod(0)

    // Set up test data needed to submit deposit sweep proof via
    // bridge.submitDepositSweepProof(sweepTx, sweepProof, mainUtxo)
    chainDifficulty = bitcoinTestData.chainDifficulty
    sweepTx = bitcoinTestData.sweepTx
    sweepProof = bitcoinTestData.sweepProof
    mainUtxo = bitcoinTestData.mainUtxo

    // Set up test data needed to request optimistic minting via
    // tbtcVault.requestOptimisticMint(fundingTxHash, fundingOutputIndex)
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

  describe("requestOptimisticMint", () => {
    context("when called not by a minter", () => {
      it("should revert", async () => {
        await expect(
          tbtcVault
            .connect(thirdParty)
            .requestOptimisticMint(fundingTxHash, fundingOutputIndex)
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
              .requestOptimisticMint(fundingTxHash, fundingOutputIndex)
          ).to.be.revertedWith("Optimistic minting paused")
        })
      })

      context("when optimistic minting has been already requested", () => {
        before(async () => {
          await createSnapshot()

          await bridge.revealDeposit(fundingTx, depositRevealInfo)
          await tbtcVault
            .connect(minter)
            .requestOptimisticMint(fundingTxHash, fundingOutputIndex)
        })

        after(async () => {
          await restoreSnapshot()
        })

        it("should revert", async () => {
          await expect(
            tbtcVault
              .connect(minter)
              .requestOptimisticMint(fundingTxHash, fundingOutputIndex)
          ).to.be.revertedWith(
            "Optimistic minting already requested for the deposit"
          )
        })
      })

      context("when the deposit has not been revealed", () => {
        it("should revert", async () => {
          await expect(
            tbtcVault.connect(minter).requestOptimisticMint(fundingTxHash, 10)
          ).to.be.revertedWith("The deposit has not been revealed")
        })
      })

      context("when the deposit has been revealed", () => {
        context("when the deposit has been swept", () => {
          before(async () => {
            await createSnapshot()

            await bridge.revealDeposit(fundingTx, depositRevealInfo)

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
            relay.getPrevEpochDifficulty.reset()
            relay.getCurrentEpochDifficulty.reset()
            await restoreSnapshot()
          })

          it("should revert", async () => {
            await expect(
              tbtcVault
                .connect(minter)
                .requestOptimisticMint(fundingTxHash, fundingOutputIndex)
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
                .requestOptimisticMint(fundingTxHash, fundingOutputIndex)
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
              .requestOptimisticMint(fundingTxHash, fundingOutputIndex)
          })

          after(async () => {
            await restoreSnapshot()
          })

          it("should request optimistic minting", async () => {
            const request = await tbtcVault.optimisticMintingRequests(
              depositKey
            )
            expect(request.requestedAt).to.be.equal(await lastBlockTime())
            expect(request.finalizedAt).to.be.equal(0)
          })

          it("should emit an event", async () => {
            await expect(tx)
              .to.emit(tbtcVault, "OptimisticMintingRequested")
              .withArgs(
                minter.address,
                depositKey,
                depositRevealInfo.depositor,
                20000,
                fundingTxHash,
                fundingOutputIndex
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
            "Optimistic minting not requested for the deposit"
          )
        })
      })

      context("when the minting delay has not passed yet", () => {
        before(async () => {
          await createSnapshot()

          await bridge.revealDeposit(fundingTx, depositRevealInfo)

          await tbtcVault
            .connect(minter)
            .requestOptimisticMint(fundingTxHash, fundingOutputIndex)
          await increaseTime((await tbtcVault.optimisticMintingDelay()) - 1)
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

          await bridge.revealDeposit(fundingTx, depositRevealInfo)

          await tbtcVault
            .connect(minter)
            .requestOptimisticMint(fundingTxHash, fundingOutputIndex)
          await increaseTime(await tbtcVault.optimisticMintingDelay())
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
            "Optimistic minting already finalized for the deposit"
          )
        })
      })

      context("when the deposit has been already swept", () => {
        before(async () => {
          await createSnapshot()

          await bridge.revealDeposit(fundingTx, depositRevealInfo)

          await tbtcVault
            .connect(minter)
            .requestOptimisticMint(fundingTxHash, fundingOutputIndex)
          await increaseTime(await tbtcVault.optimisticMintingDelay())

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
          relay.getPrevEpochDifficulty.reset()
          relay.getCurrentEpochDifficulty.reset()
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
        context("when fees are non-zero", () => {
          let tx: ContractTransaction

          before(async () => {
            await createSnapshot()

            await tbtcVault
              .connect(governance)
              .beginOptimisticMintingFeeUpdate(50) // 2%
            await increaseTime(86400) // 24h
            await tbtcVault
              .connect(governance)
              .finalizeOptimisticMintingFeeUpdate()

            await bridge.revealDeposit(fundingTx, depositRevealInfo)

            await tbtcVault
              .connect(minter)
              .requestOptimisticMint(fundingTxHash, fundingOutputIndex)
            await increaseTime(await tbtcVault.optimisticMintingDelay())
            tx = await tbtcVault
              .connect(minter)
              .finalizeOptimisticMint(fundingTxHash, fundingOutputIndex)
          })

          after(async () => {
            await restoreSnapshot()
          })

          // Output value is 20000.
          // Bridge deposit treasury fee is 0.05% (1/2000).
          // Optimistic minting fee is 2% (1/50).
          //
          // 20000 / 2000 = 10
          // (20000 - 10) / 50 = 399
          // 20000 - 10 - 399 = 19591

          // Bridge deposit treasury fee is allocated during the sweep.

          it("should send optimistic mint fee to treasury", async () => {
            expect(
              expect(await tbtc.balanceOf(await bridge.treasury())).to.be.equal(
                399
              )
            )
          })

          it("should mint TBTC to depositor", async () => {
            expect(
              await tbtc.balanceOf(depositRevealInfo.depositor)
            ).to.be.equal(19591)
          })

          it("should incur optimistic mint debt", async () => {
            expect(
              await tbtcVault.optimisticMintingDebt(depositRevealInfo.depositor)
            ).to.be.equal(19591)
          })

          it("should mark the request as finalized", async () => {
            const request = await tbtcVault.optimisticMintingRequests(
              depositKey
            )
            expect(request.requestedAt).to.not.be.equal(0)
            expect(request.finalizedAt).to.be.equal(await lastBlockTime())
          })

          it("should emit an event", async () => {
            await expect(tx)
              .to.emit(tbtcVault, "OptimisticMintingFinalized")
              .withArgs(
                minter.address,
                depositKey,
                depositRevealInfo.depositor,
                19591
              )
          })
        })

        context("when the optimistic minting fee is zero", () => {
          let tx: ContractTransaction

          before(async () => {
            await createSnapshot()

            await tbtcVault
              .connect(governance)
              .beginOptimisticMintingFeeUpdate(0)
            await increaseTime(86400) // 24h
            await tbtcVault
              .connect(governance)
              .finalizeOptimisticMintingFeeUpdate()

            await bridge.revealDeposit(fundingTx, depositRevealInfo)

            await tbtcVault
              .connect(minter)
              .requestOptimisticMint(fundingTxHash, fundingOutputIndex)
            await increaseTime(await tbtcVault.optimisticMintingDelay())
            tx = await tbtcVault
              .connect(minter)
              .finalizeOptimisticMint(fundingTxHash, fundingOutputIndex)
          })

          after(async () => {
            await restoreSnapshot()
          })

          // Output value is 20000.
          // Bridge deposit treasury fee is 0.05% (1/2000).
          // Optimistic minting fee is 0.
          //
          // 20000 / 2000 = 10
          // 20000 - 10 = 19990

          // Bridge deposit treasury fee is allocated during the sweep.

          it("should mint TBTC", async () => {
            // Deposit treasury fee is 0.05%. The output value is 0.0002 BTC.
            // Treasury fee is deducted so we should mint 19990 sat.
            expect(
              await tbtc.balanceOf(depositRevealInfo.depositor)
            ).to.be.equal(19990)
          })

          it("should incur optimistic mint debt", async () => {
            expect(
              await tbtcVault.optimisticMintingDebt(depositRevealInfo.depositor)
            ).to.be.equal(19990)
          })

          it("should mark the request as finalized", async () => {
            const request = await tbtcVault.optimisticMintingRequests(
              depositKey
            )
            expect(request.requestedAt).to.not.be.equal(0)
            expect(request.finalizedAt).to.be.equal(await lastBlockTime())
          })

          it("should emit an event", async () => {
            await expect(tx)
              .to.emit(tbtcVault, "OptimisticMintingFinalized")
              .withArgs(
                minter.address,
                depositKey,
                depositRevealInfo.depositor,
                19990
              )
          })
        })

        context("when the bridge deposit treasury fee is zero", async () => {
          let tx: ContractTransaction

          before(async () => {
            await createSnapshot()

            await bridgeGovernance
              .connect(governance)
              .beginDepositTreasuryFeeDivisorUpdate(0)
            await tbtcVault
              .connect(governance)
              .beginOptimisticMintingFeeUpdate(50) // 2%
            await increaseTime(constants.governanceDelay)
            await tbtcVault
              .connect(governance)
              .finalizeOptimisticMintingFeeUpdate()
            await bridgeGovernance
              .connect(governance)
              .finalizeDepositTreasuryFeeDivisorUpdate()

            await bridge.revealDeposit(fundingTx, depositRevealInfo)

            await tbtcVault
              .connect(minter)
              .requestOptimisticMint(fundingTxHash, fundingOutputIndex)
            await increaseTime(await tbtcVault.optimisticMintingDelay())

            tx = await tbtcVault
              .connect(minter)
              .finalizeOptimisticMint(fundingTxHash, fundingOutputIndex)
          })

          after(async () => {
            await restoreSnapshot()
          })

          // Output value is 20000.
          // Bridge deposit treasury fee is 0.
          // Optimistic minting fee is 2% (1/50).
          //
          // 20000 / 50 = 400
          // 20000 - 400 = 19600

          it("should send optimistic mint fee to treasury", async () => {
            expect(
              expect(await tbtc.balanceOf(await bridge.treasury())).to.be.equal(
                400
              )
            )
          })

          it("should mint TBTC to depositor", async () => {
            expect(
              await tbtc.balanceOf(depositRevealInfo.depositor)
            ).to.be.equal(19600)
          })

          it("should incur optimistic mint debt", async () => {
            expect(
              await tbtcVault.optimisticMintingDebt(depositRevealInfo.depositor)
            ).to.be.equal(19600)
          })

          it("should mark the request as finalized", async () => {
            const request = await tbtcVault.optimisticMintingRequests(
              depositKey
            )
            expect(request.requestedAt).to.not.be.equal(0)
            expect(request.finalizedAt).to.be.equal(await lastBlockTime())
          })

          it("should emit an event", async () => {
            await expect(tx)
              .to.emit(tbtcVault, "OptimisticMintingFinalized")
              .withArgs(
                minter.address,
                depositKey,
                depositRevealInfo.depositor,
                19600
              )
          })
        })

        context("when both fees are zero", () => {
          let tx: ContractTransaction

          before(async () => {
            await createSnapshot()

            await bridgeGovernance
              .connect(governance)
              .beginDepositTreasuryFeeDivisorUpdate(0)
            await tbtcVault
              .connect(governance)
              .beginOptimisticMintingFeeUpdate(0)
            await increaseTime(constants.governanceDelay)
            await tbtcVault
              .connect(governance)
              .finalizeOptimisticMintingFeeUpdate()
            await bridgeGovernance
              .connect(governance)
              .finalizeDepositTreasuryFeeDivisorUpdate()

            await bridge.revealDeposit(fundingTx, depositRevealInfo)

            await tbtcVault
              .connect(minter)
              .requestOptimisticMint(fundingTxHash, fundingOutputIndex)
            await increaseTime(await tbtcVault.optimisticMintingDelay())
            tx = await tbtcVault
              .connect(minter)
              .finalizeOptimisticMint(fundingTxHash, fundingOutputIndex)
          })

          after(async () => {
            await restoreSnapshot()
          })

          // Output value is 20000.
          // Bridge deposit treasury fee is 0.
          // Optimistic minting fee is 0.

          it("should mint TBTC to depositor", async () => {
            expect(
              await tbtc.balanceOf(depositRevealInfo.depositor)
            ).to.be.equal(20000)
          })

          it("should incur optimistic mint debt", async () => {
            expect(
              await tbtcVault.optimisticMintingDebt(depositRevealInfo.depositor)
            ).to.be.equal(20000)
          })

          it("should mark the request as finalized", async () => {
            const request = await tbtcVault.optimisticMintingRequests(
              depositKey
            )
            expect(request.requestedAt).to.not.be.equal(0)
            expect(request.finalizedAt).to.be.equal(await lastBlockTime())
          })

          it("should emit an event", async () => {
            await expect(tx)
              .to.emit(tbtcVault, "OptimisticMintingFinalized")
              .withArgs(
                minter.address,
                depositKey,
                depositRevealInfo.depositor,
                20000
              )
          })
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
            "Optimistic minting not requested for the deposit"
          )
        })
      })

      context("when requested minting has been finalized", () => {
        before(async () => {
          await createSnapshot()

          await tbtcVault
            .connect(minter)
            .requestOptimisticMint(fundingTxHash, fundingOutputIndex)
          await increaseTime(await tbtcVault.optimisticMintingDelay())
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
            "Optimistic minting already finalized for the deposit"
          )
        })
      })

      context("when requested minting has not been finalized", () => {
        let tx: ContractTransaction

        before(async () => {
          await createSnapshot()

          await tbtcVault
            .connect(minter)
            .requestOptimisticMint(fundingTxHash, fundingOutputIndex)

          tx = await tbtcVault
            .connect(guardian)
            .cancelOptimisticMint(fundingTxHash, fundingOutputIndex)
        })

        after(async () => {
          await restoreSnapshot()
        })

        it("should cancel optimistic minting", async () => {
          const request = await tbtcVault.optimisticMintingRequests(depositKey)
          expect(request.requestedAt).to.be.equal(0)
          expect(request.finalizedAt).to.be.equal(0)

          await increaseTime(await tbtcVault.optimisticMintingDelay())
          await expect(
            tbtcVault
              .connect(minter)
              .finalizeOptimisticMint(fundingTxHash, fundingOutputIndex)
          ).to.be.revertedWith(
            "Optimistic minting not requested for the deposit"
          )
        })

        it("should emit an event", async () => {
          await expect(tx)
            .to.emit(tbtcVault, "OptimisticMintingCancelled")
            .withArgs(guardian.address, depositKey)
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

      context("when there are multiple minters", () => {
        const minters = [
          "0x54DeA8194aaF652Cd296B162A2809dd95529f775",
          "0x575E6d8802e7b6A7E8F940640804385D8Bbe2ce0",
          "0x66ac131D339704902aECCaBDf55e15daAE8B238f",
        ]

        before(async () => {
          await createSnapshot()

          await tbtcVault.connect(governance).addMinter(minters[0])
          await tbtcVault.connect(governance).addMinter(minters[1])
          await tbtcVault.connect(governance).addMinter(minters[2])
        })

        after(async () => {
          await restoreSnapshot()
        })

        it("should add them into the list", async () => {
          expect(await tbtcVault.getMinters()).to.deep.equal(minters)
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

      context("when there are multiple minters", () => {
        const minters = [
          "0x54DeA8194aaF652Cd296B162A2809dd95529f775",
          "0x575E6d8802e7b6A7E8F940640804385D8Bbe2ce0",
          "0x66ac131D339704902aECCaBDf55e15daAE8B238f",
          "0xF844A3a4dA34fDDf51A0Ec7A0a89d1ed5A105e40",
        ]

        before(async () => {
          await createSnapshot()

          await tbtcVault.connect(governance).addMinter(minters[0])
          await tbtcVault.connect(governance).addMinter(minters[1])
          await tbtcVault.connect(governance).addMinter(minters[2])
          await tbtcVault.connect(governance).addMinter(minters[3])
        })

        after(async () => {
          await restoreSnapshot()
        })

        context("when deleting the first minter", () => {
          before(async () => {
            await createSnapshot()
            await tbtcVault.connect(governance).removeMinter(minters[0])
          })

          after(async () => {
            await restoreSnapshot()
          })

          it("should update the minters list", async () => {
            expect(await tbtcVault.getMinters()).to.deep.equal([
              "0xF844A3a4dA34fDDf51A0Ec7A0a89d1ed5A105e40",
              "0x575E6d8802e7b6A7E8F940640804385D8Bbe2ce0",
              "0x66ac131D339704902aECCaBDf55e15daAE8B238f",
            ])
          })
        })

        context("when deleting the last minter", () => {
          before(async () => {
            await createSnapshot()
            await tbtcVault.connect(governance).removeMinter(minters[3])
          })

          after(async () => {
            await restoreSnapshot()
          })

          it("should update the minters list", async () => {
            expect(await tbtcVault.getMinters()).to.deep.equal([
              "0x54DeA8194aaF652Cd296B162A2809dd95529f775",
              "0x575E6d8802e7b6A7E8F940640804385D8Bbe2ce0",
              "0x66ac131D339704902aECCaBDf55e15daAE8B238f",
            ])
          })
        })

        context("when deleting minter from the middle of the list", () => {
          before(async () => {
            await createSnapshot()
            await tbtcVault.connect(governance).removeMinter(minters[1])
          })

          after(async () => {
            await restoreSnapshot()
          })

          it("should update the minters list", async () => {
            expect(await tbtcVault.getMinters()).to.deep.equal([
              "0x54DeA8194aaF652Cd296B162A2809dd95529f775",
              "0xF844A3a4dA34fDDf51A0Ec7A0a89d1ed5A105e40",
              "0x66ac131D339704902aECCaBDf55e15daAE8B238f",
            ])
          })
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

  describe("beginOptimisticMintingFeeUpdate", () => {
    context("when called not by the governance", () => {
      it("should revert", async () => {
        await expect(
          tbtcVault.connect(thirdParty).beginOptimisticMintingFeeUpdate(10)
        ).to.be.revertedWith("Ownable: caller is not the owner")
      })
    })

    context("when called by the governance", () => {
      let tx: ContractTransaction

      before(async () => {
        await createSnapshot()

        tx = await tbtcVault
          .connect(governance)
          .beginOptimisticMintingFeeUpdate(10)
      })

      after(async () => {
        await restoreSnapshot()
      })

      it("should not update the optimistic minting fee", async () => {
        expect(await tbtcVault.optimisticMintingFeeDivisor()).to.equal(0)
      })

      it("should start the governance delay timer", async () => {
        expect(
          await tbtcVault.optimisticMintingFeeUpdateInitiatedTimestamp()
        ).to.equal(await lastBlockTime())
      })

      it("should emit an event", async () => {
        await expect(tx)
          .to.emit(tbtcVault, "OptimisticMintingFeeUpdateStarted")
          .withArgs(10)
      })
    })
  })

  describe("finalizeOptimisticMintingFeeUpdate", () => {
    context("when called not by the governance", () => {
      it("should revert", async () => {
        await expect(
          tbtcVault.connect(thirdParty).finalizeOptimisticMintingFeeUpdate()
        ).to.be.revertedWith("Ownable: caller is not the owner")
      })
    })

    context("when the update process is not initiated", () => {
      it("should revert", async () => {
        await expect(
          tbtcVault.connect(governance).finalizeOptimisticMintingFeeUpdate()
        ).to.be.revertedWith("Change not initiated")
      })
    })

    context("when the governance delay has not passed", () => {
      before(async () => {
        await createSnapshot()

        await tbtcVault.connect(governance).beginOptimisticMintingFeeUpdate(10)

        await increaseTime(86400 - 60) // 24h - 1m
      })

      after(async () => {
        await restoreSnapshot()
      })

      it("should revert", async () => {
        await expect(
          tbtcVault.connect(governance).finalizeOptimisticMintingFeeUpdate()
        ).to.be.revertedWith("Governance delay has not elapsed")
      })
    })

    context(
      "when the update process is initiated and governance delay passed",
      () => {
        let tx: ContractTransaction

        before(async () => {
          await createSnapshot()

          await tbtcVault
            .connect(governance)
            .beginOptimisticMintingFeeUpdate(15)
          await increaseTime(86400) // 24h
          tx = await tbtcVault
            .connect(governance)
            .finalizeOptimisticMintingFeeUpdate()
        })

        after(async () => {
          await restoreSnapshot()
        })

        it("should update the optimistic minting fee", async () => {
          expect(await tbtcVault.optimisticMintingFeeDivisor()).to.equal(15)
        })

        it("should emit an event", async () => {
          await expect(tx)
            .to.emit(tbtcVault, "OptimisticMintingFeeUpdated")
            .withArgs(15)
        })

        it("should reset the governance delay timer", async () => {
          expect(
            await tbtcVault.optimisticMintingFeeUpdateInitiatedTimestamp()
          ).to.equal(0)
        })
      }
    )
  })

  describe("beginOptimisticMintingDelayUpdate", () => {
    context("when called not by the governance", () => {
      it("should revert", async () => {
        await expect(
          tbtcVault.connect(thirdParty).beginOptimisticMintingDelayUpdate(60)
        ).to.be.revertedWith("Ownable: caller is not the owner")
      })
    })

    context("when called by the governance", () => {
      let tx: ContractTransaction

      before(async () => {
        await createSnapshot()

        tx = await tbtcVault
          .connect(governance)
          .beginOptimisticMintingDelayUpdate(60)
      })

      after(async () => {
        await restoreSnapshot()
      })

      it("should not update the optimistic minting delay", async () => {
        expect(await tbtcVault.optimisticMintingDelay()).to.equal(10800) // 3h
      })

      it("should start the governance delay timer", async () => {
        expect(
          await tbtcVault.optimisticMintingDelayUpdateInitiatedTimestamp()
        ).to.equal(await lastBlockTime())
      })

      it("should emit an event", async () => {
        await expect(tx)
          .to.emit(tbtcVault, "OptimisticMintingDelayUpdateStarted")
          .withArgs(60)
      })
    })
  })

  describe("finalizeOptimisticMintingDelayUpdate", () => {
    context("when called not by the governance", () => {
      it("should revert", async () => {
        await expect(
          tbtcVault.connect(thirdParty).finalizeOptimisticMintingDelayUpdate()
        ).to.be.revertedWith("Ownable: caller is not the owner")
      })
    })

    context("when the update process is not initiated", () => {
      it("should revert", async () => {
        await expect(
          tbtcVault.connect(governance).finalizeOptimisticMintingDelayUpdate()
        ).to.be.revertedWith("Change not initiated")
      })
    })

    context("when the governance delay has not passed", () => {
      before(async () => {
        await createSnapshot()

        await tbtcVault
          .connect(governance)
          .beginOptimisticMintingDelayUpdate(60)

        await increaseTime(86400 - 60) // 24h - 1m
      })

      after(async () => {
        await restoreSnapshot()
      })

      it("should revert", async () => {
        await expect(
          tbtcVault.connect(governance).finalizeOptimisticMintingDelayUpdate()
        ).to.be.revertedWith("Governance delay has not elapsed")
      })
    })

    context(
      "when the update process is initiated and governance delay passed",
      () => {
        let tx: ContractTransaction

        before(async () => {
          await createSnapshot()

          await tbtcVault
            .connect(governance)
            .beginOptimisticMintingDelayUpdate(60)
          await increaseTime(86400) // 24h
          tx = await tbtcVault
            .connect(governance)
            .finalizeOptimisticMintingDelayUpdate()
        })

        after(async () => {
          await restoreSnapshot()
        })

        it("should update the optimistic minting delay", async () => {
          expect(await tbtcVault.optimisticMintingDelay()).to.equal(60)
        })

        it("should emit an event", async () => {
          await expect(tx)
            .to.emit(tbtcVault, "OptimisticMintingDelayUpdated")
            .withArgs(60)
        })

        it("should reset the governance delay timer", async () => {
          expect(
            await tbtcVault.optimisticMintingDelayUpdateInitiatedTimestamp()
          ).to.equal(0)
        })
      }
    )
  })

  describe("calculateDepositKey", () => {
    before(async () => {
      await createSnapshot()
      await bridge.revealDeposit(fundingTx, depositRevealInfo)
    })

    after(async () => {
      await restoreSnapshot()
    })

    it("should calculate the key as expected", async () => {
      expect(
        await tbtcVault.calculateDepositKey(fundingTxHash, fundingOutputIndex)
      ).to.equal(depositKey)
    })

    it("should calculate the same key as the Bridge", async () => {
      expect((await bridge.deposits(depositKey)).revealedAt).to.equal(
        await lastBlockTime()
      )
    })
  })

  describe("receiveBalanceIncrease", () => {
    context(
      "when the deposit for which optimistic minting was requested gets swept",
      () => {
        let tx: ContractTransaction

        before(async () => {
          await createSnapshot()
          await tbtcVault.connect(governance).addMinter(minter.address)

          await bridge.revealDeposit(fundingTx, depositRevealInfo)
          await tbtcVault
            .connect(minter)
            .requestOptimisticMint(fundingTxHash, fundingOutputIndex)

          await increaseTime(await tbtcVault.optimisticMintingDelay())

          await tbtcVault
            .connect(minter)
            .finalizeOptimisticMint(fundingTxHash, fundingOutputIndex)

          relay.getPrevEpochDifficulty.returns(chainDifficulty)
          relay.getCurrentEpochDifficulty.returns(chainDifficulty)
          tx = await bridge
            .connect(spvMaintainer)
            .submitDepositSweepProof(
              sweepTx,
              sweepProof,
              mainUtxo,
              tbtcVault.address
            )
        })

        after(async () => {
          relay.getPrevEpochDifficulty.reset()
          relay.getCurrentEpochDifficulty.reset()
          await restoreSnapshot()
        })

        it("should repay optimistic minting debt", async () => {
          // The sum of sweep tx inputs is 20000 satoshi. The output value is
          // 18500 so the transaction fee is 1500. There is only one deposit so
          // it incurs the entire transaction fee.
          // Treasury fee is cut when optimistically minting TBTC but given the
          // Bitcoin transaction fee is unknown at the moment of optimistic
          // minting, we can not deduct it when optimistically minting TBTC so
          // the optimistic minting debt stay equal to the transaction fee.
          expect(
            await tbtcVault.optimisticMintingDebt(depositRevealInfo.depositor)
          ).to.equal(1500)
        })

        it("should emit an event", async () => {
          await expect(tx)
            .to.emit(tbtcVault, "OptimisticMintingDebtRepaid")
            .withArgs(depositRevealInfo.depositor, 1500)
        })
      }
    )

    context("when multiple deposits gets swept", () => {
      interface Fixture {
        mockBank: FakeContract<Bank>
        mockBridge: FakeContract<Bridge>
        tbtc: TBTC
        tbtcVault: TBTCVault
      }

      const depositor = "0xb2Ea9bb14A901fD71A7cf6e7b5bdC62aA2b9F012"

      // Setting up two real testnet deposits being swept one after another
      // requires a ton of boilerplate code that is hard to follow and update.
      // Testing multiple-deposits scenarios with mocked bridge is way easier.
      // This function prepares a fixture separate from the main test setup's
      // fixture, just for testing multiple-deposits scenarios.
      const prepareFixture = async function (): Promise<Fixture> {
        const mockBank = await smock.fake<Bank>("Bank")
        const mockBridge = await smock.fake<Bridge>("Bridge")

        const TBTCFactory = await ethers.getContractFactory("TBTC")
        // eslint-disable-next-line @typescript-eslint/no-shadow
        const tbtc = await TBTCFactory.connect(deployer).deploy()

        const TBTCVaultFactory = await ethers.getContractFactory("TBTCVault")
        // eslint-disable-next-line @typescript-eslint/no-shadow
        const tbtcVault = await TBTCVaultFactory.connect(deployer).deploy(
          mockBank.address,
          tbtc.address,
          mockBridge.address
        )

        await mockBank.connect(deployer).updateBridge(mockBridge.address)
        await tbtc.connect(deployer).transferOwnership(tbtcVault.address)
        await tbtcVault.connect(deployer).addMinter(minter.address)

        // Fund the `mockBank` account so it's possible to mock sending requests
        // from it.
        await deployer.sendTransaction({
          to: mockBank.address,
          value: ethers.utils.parseEther("100"),
        })

        return {
          mockBank,
          mockBridge,
          tbtc,
          tbtcVault,
        }
      }

      context("when both deposits were optimistically minted", () => {
        let f: Fixture
        let tx: ContractTransaction

        before(async () => {
          await createSnapshot()
          f = await prepareFixture()

          const firstDepositID = await tbtcVault.calculateDepositKey(
            fundingTxHash,
            1
          )
          const secondDepositID = await tbtcVault.calculateDepositKey(
            fundingTxHash,
            2
          )
          f.mockBridge.deposits.whenCalledWith(firstDepositID).returns({
            depositor,
            amount: 1000,
            revealedAt: await lastBlockTime(),
            vault: f.tbtcVault.address,
            treasuryFee: 10,
            sweptAt: 0,
          })
          f.mockBridge.deposits.whenCalledWith(secondDepositID).returns({
            depositor,
            amount: 2000,
            revealedAt: await lastBlockTime(),
            vault: f.tbtcVault.address,
            treasuryFee: 15,
            sweptAt: 0,
          })

          await f.tbtcVault
            .connect(minter)
            .requestOptimisticMint(fundingTxHash, 1)
          await f.tbtcVault
            .connect(minter)
            .requestOptimisticMint(fundingTxHash, 2)
          await increaseTime(await tbtcVault.optimisticMintingDelay())
          await f.tbtcVault
            .connect(minter)
            .finalizeOptimisticMint(fundingTxHash, 1)
          await f.tbtcVault
            .connect(minter)
            .finalizeOptimisticMint(fundingTxHash, 2)

          tx = await f.tbtcVault
            .connect(f.mockBank.wallet)
            .receiveBalanceIncrease([depositor, depositor], [800, 1900])
        })

        after(async () => {
          await restoreSnapshot()
        })

        it("should pay off part of the optimistic minting debt", async () => {
          // The first deposit has value of 1000 and a treasury fee of 10.
          // The second deposit has value of 2000 and a treasury fee of 15.
          // Both were optimistically minted so the debt is 2975.
          // Then, the deposits were swept.
          // With miner fee and treasury fee deducted the amounts from the
          // deposits were 800 and 1900.
          // The debt is reduced to 2975 - 800 - 1900 = 275.
          expect(await f.tbtcVault.optimisticMintingDebt(depositor)).to.equal(
            275
          )
        })

        it("should mint the right amount of TBTC", async () => {
          expect(await f.tbtc.balanceOf(depositor)).to.equal(2975)
        })

        it("should emit an event", async () => {
          // 2975 - 800 = 2175
          await expect(tx)
            .to.emit(f.tbtcVault, "OptimisticMintingDebtRepaid")
            .withArgs(depositor, 2175)

          // 2175 - 1900 = 275
          await expect(tx)
            .to.emit(f.tbtcVault, "OptimisticMintingDebtRepaid")
            .withArgs(depositor, 275)
        })
      })

      context("when only one deposit was optimistically minted", () => {
        let f: Fixture
        let tx: ContractTransaction

        before(async () => {
          await createSnapshot()
          f = await prepareFixture()

          const firstDepositID = await tbtcVault.calculateDepositKey(
            fundingTxHash,
            1
          )
          f.mockBridge.deposits.whenCalledWith(firstDepositID).returns({
            depositor,
            amount: 1000,
            revealedAt: await lastBlockTime(),
            vault: f.tbtcVault.address,
            treasuryFee: 10,
            sweptAt: 0,
          })

          await f.tbtcVault
            .connect(minter)
            .requestOptimisticMint(fundingTxHash, 1)
          await increaseTime(await tbtcVault.optimisticMintingDelay())
          await f.tbtcVault
            .connect(minter)
            .finalizeOptimisticMint(fundingTxHash, 1)

          tx = await f.tbtcVault
            .connect(f.mockBank.wallet)
            .receiveBalanceIncrease([depositor, depositor], [800, 1900])
        })

        after(async () => {
          await restoreSnapshot()
        })

        it("should pay off part of the optimistic minting debt", async () => {
          // The first deposit has value of 1000 and a treasury fee of 10.
          // The second deposit has value of 2000 and a treasury fee of 15.
          // Only the first one got optimistically minted so the debt is 990.
          // Then, the deposits were swept.
          // With miner fee and treasury fee deducted the amounts from the
          // deposits were 800 and 1900.
          // When the first deposit is swept, the debt is reduced to 190.
          // When the second deposit is swept, the debt is reduced to 0.
          expect(await f.tbtcVault.optimisticMintingDebt(depositor)).to.equal(0)
        })

        it("should mint the right amount of TBTC", async () => {
          // When the second deposit was being swept, the debt was 190.
          // With miner fee and treasury fee deducted the amount from the
          // second deposit was 1900. Thus 1900 - 190 = 1710 TBTC is minted for
          // the second deposit and 990 was minted for the first deposit.
          // 1710 + 990 = 2700 is minted in total.
          expect(await f.tbtc.balanceOf(depositor)).to.equal(2700)
        })

        it("should emit an event", async () => {
          // 990 - 800 = 190
          await expect(tx)
            .to.emit(f.tbtcVault, "OptimisticMintingDebtRepaid")
            .withArgs(depositor, 190)

          // 190 - 1900 = -1000 (so 1000 to mint, debt is 0)
          await expect(tx)
            .to.emit(f.tbtcVault, "OptimisticMintingDebtRepaid")
            .withArgs(depositor, 0)
        })
      })
    })
  })
})
