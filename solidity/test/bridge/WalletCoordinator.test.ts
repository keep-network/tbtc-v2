import crypto from "crypto"
import { ethers, helpers, waffle } from "hardhat"
import chai, { expect } from "chai"
import { FakeContract, smock } from "@defi-wonderland/smock"
import { SignerWithAddress } from "@nomiclabs/hardhat-ethers/signers"
import { BigNumber, BigNumberish, BytesLike, ContractTransaction } from "ethers"
import type {
  WalletCoordinator,
  Bridge,
  ReimbursementPool,
  IWalletRegistry,
} from "../../typechain"
import { walletAction, walletState } from "../fixtures"

chai.use(smock.matchers)

const { provider } = waffle
const { lastBlockTime, increaseTime } = helpers.time
const { createSnapshot, restoreSnapshot } = helpers.snapshot
const { AddressZero, HashZero } = ethers.constants

const day = 86400
const depositLocktime = 30 * day

const emptyDepositExtraInfo = {
  fundingTx: {
    version: "0x00000000",
    inputVector: HashZero,
    outputVector: HashZero,
    locktime: "0x00000000",
  },
  blindingFactor: "0x0000000000000000",
  walletPubKeyHash: AddressZero,
  refundPubKeyHash: AddressZero,
  refundLocktime: "0x00000000",
}

describe("WalletCoordinator", () => {
  let owner: SignerWithAddress
  let thirdParty: SignerWithAddress

  let walletRegistry: FakeContract<IWalletRegistry>
  let bridge: FakeContract<Bridge>
  let reimbursementPool: ReimbursementPool

  let walletCoordinator: WalletCoordinator

  before(async () => {
    const { deployer } = await helpers.signers.getNamedSigners()
    // eslint-disable-next-line @typescript-eslint/no-extra-semi
    ;[owner, thirdParty] = await helpers.signers.getUnnamedSigners()

    walletRegistry = await smock.fake<IWalletRegistry>("IWalletRegistry")
    bridge = await smock.fake<Bridge>("Bridge")

    const ReimbursementPool = await ethers.getContractFactory(
      "ReimbursementPool"
    )
    // Using the same parameter values as currently on mainnet
    reimbursementPool = await ReimbursementPool.connect(deployer).deploy(
      40_800,
      500_000_000_000
    )

    const WalletCoordinator = await ethers.getContractFactory(
      "WalletCoordinator"
    )
    walletCoordinator = await WalletCoordinator.connect(deployer).deploy()

    bridge.contractReferences.returns([
      AddressZero,
      AddressZero,
      walletRegistry.address,
      reimbursementPool.address,
    ])
    await walletCoordinator.connect(deployer).initialize(bridge.address)

    await reimbursementPool
      .connect(deployer)
      .authorize(walletCoordinator.address)
    await walletCoordinator.connect(deployer).transferOwnership(owner.address)

    // Fund the ReimbursementPool
    await deployer.sendTransaction({
      to: reimbursementPool.address,
      value: ethers.utils.parseEther("10"),
    })
  })

  describe("addCoordinator", () => {
    before(async () => {
      await createSnapshot()
    })

    after(async () => {
      await restoreSnapshot()
    })

    context("when called by a third party", () => {
      it("should revert", async () => {
        await expect(
          walletCoordinator
            .connect(thirdParty)
            .addCoordinator(thirdParty.address)
        ).to.be.revertedWith("Ownable: caller is not the owner")
      })
    })

    context("when called by the owner", () => {
      context("when the coordinator already exists", () => {
        before(async () => {
          await createSnapshot()

          await walletCoordinator
            .connect(owner)
            .addCoordinator(thirdParty.address)
        })

        after(async () => {
          await restoreSnapshot()
        })

        it("should revert", async () => {
          await expect(
            walletCoordinator.connect(owner).addCoordinator(thirdParty.address)
          ).to.be.revertedWith("This address is already a coordinator")
        })
      })

      context("when the coordinator does not exist yet", () => {
        let tx: ContractTransaction

        before(async () => {
          await createSnapshot()

          tx = await walletCoordinator
            .connect(owner)
            .addCoordinator(thirdParty.address)
        })

        after(async () => {
          await restoreSnapshot()
        })

        it("should add the new coordinator", async () => {
          // eslint-disable-next-line @typescript-eslint/no-unused-expressions
          expect(await walletCoordinator.isCoordinator(thirdParty.address)).to
            .be.true
        })

        it("should emit the CoordinatorAdded event", async () => {
          await expect(tx)
            .to.emit(walletCoordinator, "CoordinatorAdded")
            .withArgs(thirdParty.address)
        })
      })
    })
  })

  describe("removeCoordinator", () => {
    before(async () => {
      await createSnapshot()
    })

    after(async () => {
      await restoreSnapshot()
    })

    context("when called by a third party", () => {
      it("should revert", async () => {
        await expect(
          walletCoordinator
            .connect(thirdParty)
            .removeCoordinator(thirdParty.address)
        ).to.be.revertedWith("Ownable: caller is not the owner")
      })
    })

    context("when called by the owner", () => {
      context("when the coordinator does not exist", () => {
        it("should revert", async () => {
          await expect(
            walletCoordinator
              .connect(owner)
              .removeCoordinator(thirdParty.address)
          ).to.be.revertedWith("This address is not a coordinator")
        })
      })

      context("when the coordinator exists", () => {
        let tx: ContractTransaction

        before(async () => {
          await createSnapshot()

          await walletCoordinator
            .connect(owner)
            .addCoordinator(thirdParty.address)

          tx = await walletCoordinator
            .connect(owner)
            .removeCoordinator(thirdParty.address)
        })

        after(async () => {
          await restoreSnapshot()
        })

        it("should remove the coordinator", async () => {
          // eslint-disable-next-line @typescript-eslint/no-unused-expressions
          expect(await walletCoordinator.isCoordinator(thirdParty.address)).to
            .be.false
        })

        it("should emit the CoordinatorRemoved event", async () => {
          await expect(tx)
            .to.emit(walletCoordinator, "CoordinatorRemoved")
            .withArgs(thirdParty.address)
        })
      })
    })
  })

  describe("unlockWallet", () => {
    const walletPubKeyHash = "0x7ac2d9378a1c47e589dfb8095ca95ed2140d2726"

    before(async () => {
      await createSnapshot()
    })

    after(async () => {
      await restoreSnapshot()
    })

    context("when called by a third party", () => {
      it("should revert", async () => {
        await expect(
          walletCoordinator.connect(thirdParty).unlockWallet(walletPubKeyHash)
        ).to.be.revertedWith("Ownable: caller is not the owner")
      })
    })

    context("when called by the owner", () => {
      let tx: ContractTransaction

      before(async () => {
        await createSnapshot()

        await walletCoordinator
          .connect(owner)
          .addCoordinator(thirdParty.address)

        // Submit a proposal to set a wallet time lock.
        await walletCoordinator.connect(thirdParty).submitDepositSweepProposal({
          walletPubKeyHash,
          depositsKeys: [
            {
              fundingTxHash:
                "0x51f373dcbb6122bcb1c62964b5f3be923092dc64bc9e31257931d58c4eadb9f5",
              fundingOutputIndex: 0,
            },
          ],
          sweepTxFee: 5000,
          depositsRevealBlocks: [1000],
        })

        tx = await walletCoordinator
          .connect(owner)
          .unlockWallet(walletPubKeyHash)
      })

      after(async () => {
        await restoreSnapshot()
      })

      it("should unlock the wallet", async () => {
        const walletLock = await walletCoordinator.walletLock(walletPubKeyHash)

        expect(walletLock.expiresAt).to.be.equal(0)
        expect(walletLock.cause).to.be.equal(walletAction.Idle)
      })

      it("should emit the WalletManuallyUnlocked event", async () => {
        await expect(tx)
          .to.emit(walletCoordinator, "WalletManuallyUnlocked")
          .withArgs(walletPubKeyHash)
      })
    })
  })

  describe("updateHeartbeatRequestParameters", () => {
    before(async () => {
      await createSnapshot()
    })

    after(async () => {
      await restoreSnapshot()
    })

    context("when called by a third party", () => {
      it("should revert", async () => {
        await expect(
          walletCoordinator
            .connect(thirdParty)
            .updateHeartbeatRequestParameters(3600, 1000)
        ).to.be.revertedWith("Ownable: caller is not the owner")
      })
    })

    context("when called by the owner", () => {
      let tx: ContractTransaction

      before(async () => {
        await createSnapshot()

        tx = await walletCoordinator
          .connect(owner)
          .updateHeartbeatRequestParameters(125, 126)
      })

      after(async () => {
        await restoreSnapshot()
      })

      it("should update heartbeat parameters", async () => {
        expect(await walletCoordinator.heartbeatRequestValidity()).to.be.equal(
          125
        )
        expect(await walletCoordinator.heartbeatRequestGasOffset()).to.be.equal(
          126
        )
      })

      it("should emit the HeartbeatRequestParametersUpdated event", async () => {
        await expect(tx)
          .to.emit(walletCoordinator, "HeartbeatRequestParametersUpdated")
          .withArgs(125, 126)
      })
    })
  })

  describe("updateDepositSweepProposalParameters", () => {
    before(async () => {
      await createSnapshot()
    })

    after(async () => {
      await restoreSnapshot()
    })

    context("when called by a third party", () => {
      it("should revert", async () => {
        await expect(
          walletCoordinator
            .connect(thirdParty)
            .updateDepositSweepProposalParameters(101, 102, 103, 104, 105)
        ).to.be.revertedWith("Ownable: caller is not the owner")
      })
    })

    context("when called by the owner", () => {
      let tx: ContractTransaction

      before(async () => {
        await createSnapshot()

        tx = await walletCoordinator
          .connect(owner)
          .updateDepositSweepProposalParameters(101, 102, 103, 104, 105)
      })

      after(async () => {
        await restoreSnapshot()
      })

      it("should update deposit sweep proposal parameters", async () => {
        expect(
          await walletCoordinator.depositSweepProposalValidity()
        ).to.be.equal(101)
        expect(await walletCoordinator.depositMinAge()).to.be.equal(102)
        expect(await walletCoordinator.depositRefundSafetyMargin()).to.be.equal(
          103
        )
        expect(await walletCoordinator.depositSweepMaxSize()).to.be.equal(104)
        expect(
          await walletCoordinator.depositSweepProposalSubmissionGasOffset()
        ).to.be.equal(105)
      })

      it("should emit the DepositSweepProposalParametersUpdated event", async () => {
        await expect(tx)
          .to.emit(walletCoordinator, "DepositSweepProposalParametersUpdated")
          .withArgs(101, 102, 103, 104, 105)
      })
    })
  })

  describe("updateReimbursementPool", () => {
    before(async () => {
      await createSnapshot()
    })

    after(async () => {
      await restoreSnapshot()
    })

    context("when called by a third party", () => {
      it("should revert", async () => {
        await expect(
          walletCoordinator
            .connect(thirdParty)
            .updateReimbursementPool(thirdParty.address)
        ).to.be.revertedWith("Caller is not the owner")
      })
    })

    context("when called by the owner", () => {
      let tx: ContractTransaction

      before(async () => {
        await createSnapshot()
        tx = await walletCoordinator
          .connect(owner)
          .updateReimbursementPool(thirdParty.address)
      })

      after(async () => {
        await restoreSnapshot()
      })

      it("should update the reimbursement pool address", async () => {
        expect(await walletCoordinator.reimbursementPool()).to.be.equal(
          thirdParty.address
        )
      })

      it("should emit the ReimbursementPoolUpdated event", async () => {
        await expect(tx)
          .to.emit(walletCoordinator, "ReimbursementPoolUpdated")
          .withArgs(thirdParty.address)
      })
    })
  })

  describe("requestHeartbeat", () => {
    const walletPubKeyHash = "0x7ac2d9378a1c47e589dfb8095ca95ed2140d2726"

    before(async () => {
      await createSnapshot()
    })

    after(async () => {
      await restoreSnapshot()
    })

    context("when the caller is not a coordinator", () => {
      before(async () => {
        await createSnapshot()
      })

      after(async () => {
        await restoreSnapshot()
      })

      it("should revert", async () => {
        const tx = walletCoordinator
          .connect(thirdParty)
          .requestHeartbeat(
            walletPubKeyHash,
            "0xffffffffffffffff1111111111111111"
          )

        await expect(tx).to.be.revertedWith("Caller is not a coordinator")
      })
    })

    context("when the caller is a coordinator", () => {
      before(async () => {
        await createSnapshot()

        await walletCoordinator
          .connect(owner)
          .addCoordinator(thirdParty.address)
      })

      after(async () => {
        await restoreSnapshot()
      })

      context("when the wallet is time-locked", () => {
        before(async () => {
          await createSnapshot()

          // Submit a request to set a wallet time lock.
          await walletCoordinator
            .connect(thirdParty)
            .requestHeartbeat(
              walletPubKeyHash,
              "0xffffffffffffffff1111111111111111"
            )

          // Jump to the end of the lock period but not beyond it.
          await increaseTime(
            (await walletCoordinator.heartbeatRequestValidity()) - 1
          )
        })

        after(async () => {
          await restoreSnapshot()
        })

        it("should revert", async () => {
          await expect(
            walletCoordinator
              .connect(thirdParty)
              .requestHeartbeat(
                walletPubKeyHash,
                "0xffffffffffffffff1111111111111111"
              )
          ).to.be.revertedWith("Wallet locked")
        })
      })

      context("when the wallet is not time-locked", () => {
        before(async () => {
          await createSnapshot()

          await walletCoordinator
            .connect(thirdParty)
            .requestHeartbeat(
              walletPubKeyHash,
              "0xffffffffffffffff1111111111111111"
            )

          // Jump beyond the lock period.
          await increaseTime(await walletCoordinator.heartbeatRequestValidity())
        })

        after(async () => {
          await restoreSnapshot()
        })

        context("when the message is not a valid heartbeat", () => {
          it("should revert", async () => {
            await expect(
              walletCoordinator
                .connect(thirdParty)
                .requestHeartbeat(
                  walletPubKeyHash,
                  "0xff000000000000000000000000000000"
                )
            ).to.be.revertedWith("Not a valid heartbeat message")
          })
        })

        context("when the message is a valid heartbeat", () => {
          let tx: ContractTransaction

          before(async () => {
            await createSnapshot()

            tx = await walletCoordinator
              .connect(thirdParty)
              .requestHeartbeat(
                walletPubKeyHash,
                "0xffffffffffffffff1111111111111111"
              )
          })

          after(async () => {
            await restoreSnapshot()
          })

          it("should time lock the wallet", async () => {
            const lockedUntil =
              (await lastBlockTime()) +
              (await walletCoordinator.heartbeatRequestValidity())

            const walletLock = await walletCoordinator.walletLock(
              walletPubKeyHash
            )

            expect(walletLock.expiresAt).to.be.equal(lockedUntil)
            expect(walletLock.cause).to.be.equal(walletAction.Heartbeat)
          })

          it("should emit the HeartbeatRequestSubmitted event", async () => {
            await expect(tx)
              .to.emit(walletCoordinator, "HeartbeatRequestSubmitted")
              .withArgs(
                walletPubKeyHash,
                "0xffffffffffffffff1111111111111111",
                thirdParty.address
              )
          })
        })
      })
    })
  })

  describe("requestHeartbeatWithReimbursement", () => {
    const walletPubKeyHash = "0x7ac2d9378a1c47e589dfb8095ca95ed2140d2726"

    before(async () => {
      await createSnapshot()
    })

    after(async () => {
      await restoreSnapshot()
    })

    // Just double check that `requestHeartbeatWithReimbursement` has
    // the same ACL as `requestHeartbeat`.
    context("when the caller is not a coordinator", () => {
      before(async () => {
        await createSnapshot()
      })

      after(async () => {
        await restoreSnapshot()
      })

      it("should revert", async () => {
        const tx = walletCoordinator
          .connect(thirdParty)
          .requestHeartbeatWithReimbursement(
            walletPubKeyHash,
            "0xffffffffffffffff1111111111111111"
          )

        await expect(tx).to.be.revertedWith("Caller is not a coordinator")
      })
    })

    // Here we just check that the reimbursement works. Detailed
    // assertions are already done within the scenario stressing the
    // `requestHeartbeat` function.
    context("when the caller is a coordinator", () => {
      let coordinatorBalanceBefore: BigNumber
      let coordinatorBalanceAfter: BigNumber

      before(async () => {
        await createSnapshot()

        await walletCoordinator
          .connect(owner)
          .addCoordinator(thirdParty.address)

        // The first-ever heartbeat request will be more expensive given it has
        // to set fields to non-zero values. We shouldn't adjust gas offset
        // based on it.
        await walletCoordinator
          .connect(thirdParty)
          .requestHeartbeatWithReimbursement(
            walletPubKeyHash,
            "0xffffffffffffffff1111111111111111"
          )
        // Jump beyond the lock period.
        await increaseTime(await walletCoordinator.heartbeatRequestValidity())

        coordinatorBalanceBefore = await provider.getBalance(thirdParty.address)

        await walletCoordinator
          .connect(thirdParty)
          .requestHeartbeatWithReimbursement(
            walletPubKeyHash,
            "0xffffffffffffffff1111111111111111"
          )

        coordinatorBalanceAfter = await provider.getBalance(thirdParty.address)
      })

      after(async () => {
        await restoreSnapshot()
      })

      it("should do the refund", async () => {
        const diff = coordinatorBalanceAfter.sub(coordinatorBalanceBefore)
        expect(diff).to.be.gt(0)
        expect(diff).to.be.lt(ethers.utils.parseUnits("2000000", "gwei")) // 0,002 ETH
      })
    })
  })

  describe("submitDepositSweepProposal", () => {
    const walletPubKeyHash = "0x7ac2d9378a1c47e589dfb8095ca95ed2140d2726"

    before(async () => {
      await createSnapshot()
    })

    after(async () => {
      await restoreSnapshot()
    })

    context("when the caller is not a coordinator", () => {
      before(async () => {
        await createSnapshot()
      })

      after(async () => {
        await restoreSnapshot()
      })

      it("should revert", async () => {
        const tx = walletCoordinator
          .connect(thirdParty)
          .submitDepositSweepProposal({
            walletPubKeyHash,
            depositsKeys: [
              {
                fundingTxHash:
                  "0x51f373dcbb6122bcb1c62964b5f3be923092dc64bc9e31257931d58c4eadb9f5",
                fundingOutputIndex: 0,
              },
            ],
            sweepTxFee: 5000,
            depositsRevealBlocks: [1000],
          })

        await expect(tx).to.be.revertedWith("Caller is not a coordinator")
      })
    })

    context("when the caller is a coordinator", () => {
      before(async () => {
        await createSnapshot()

        await walletCoordinator
          .connect(owner)
          .addCoordinator(thirdParty.address)
      })

      after(async () => {
        await restoreSnapshot()
      })

      context("when wallet is time-locked", () => {
        before(async () => {
          await createSnapshot()

          // Submit a proposal to set a wallet time lock.
          await walletCoordinator
            .connect(thirdParty)
            .submitDepositSweepProposal({
              walletPubKeyHash,
              depositsKeys: [
                {
                  fundingTxHash:
                    "0x51f373dcbb6122bcb1c62964b5f3be923092dc64bc9e31257931d58c4eadb9f5",
                  fundingOutputIndex: 0,
                },
              ],
              sweepTxFee: 5000,
              depositsRevealBlocks: [1000],
            })

          // Jump to the end of the lock period but not beyond it.
          await increaseTime(
            (await walletCoordinator.depositSweepProposalValidity()) - 1
          )
        })

        after(async () => {
          await restoreSnapshot()
        })

        it("should revert", async () => {
          await expect(
            walletCoordinator.connect(thirdParty).submitDepositSweepProposal({
              walletPubKeyHash,
              depositsKeys: [
                {
                  fundingTxHash:
                    "0x51f373dcbb6122bcb1c62964b5f3be923092dc64bc9e31257931d58c4eadb9f5",
                  fundingOutputIndex: 1,
                },
              ],
              sweepTxFee: 5000,
              depositsRevealBlocks: [1000],
            })
          ).to.be.revertedWith("Wallet locked")
        })
      })

      context("when wallet is not time-locked", () => {
        let tx: ContractTransaction

        before(async () => {
          await createSnapshot()

          // Submit a proposal to set a wallet time lock.
          await walletCoordinator
            .connect(thirdParty)
            .submitDepositSweepProposal({
              walletPubKeyHash,
              depositsKeys: [
                {
                  fundingTxHash:
                    "0x51f373dcbb6122bcb1c62964b5f3be923092dc64bc9e31257931d58c4eadb9f5",
                  fundingOutputIndex: 0,
                },
              ],
              sweepTxFee: 5000,
              depositsRevealBlocks: [1000],
            })

          // Jump beyond the lock period.
          await increaseTime(
            await walletCoordinator.depositSweepProposalValidity()
          )

          tx = await walletCoordinator
            .connect(thirdParty)
            .submitDepositSweepProposal({
              walletPubKeyHash,
              depositsKeys: [
                {
                  fundingTxHash:
                    "0x51f373dcbb6122bcb1c62964b5f3be923092dc64bc9e31257931d58c4eadb9f5",
                  fundingOutputIndex: 1,
                },
              ],
              sweepTxFee: 5000,
              depositsRevealBlocks: [1000],
            })
        })

        after(async () => {
          await restoreSnapshot()
        })

        it("should time lock the wallet", async () => {
          const lockedUntil =
            (await lastBlockTime()) +
            (await walletCoordinator.depositSweepProposalValidity())

          const walletLock = await walletCoordinator.walletLock(
            walletPubKeyHash
          )

          expect(walletLock.expiresAt).to.be.equal(lockedUntil)
          expect(walletLock.cause).to.be.equal(walletAction.DepositSweep)
        })

        it("should emit the DepositSweepProposalSubmitted event", async () => {
          await expect(tx).to.emit(
            walletCoordinator,
            "DepositSweepProposalSubmitted"
          )

          // The `expect.to.emit.withArgs` assertion has troubles with
          // matching complex event arguments as it uses strict equality
          // underneath. To overcome that problem, we manually get event's
          // arguments and check it against the expected ones using deep
          // equality assertion (eql).
          const receipt = await ethers.provider.getTransactionReceipt(tx.hash)
          expect(receipt.logs.length).to.be.equal(1)
          expect(
            walletCoordinator.interface.parseLog(receipt.logs[0]).args
          ).to.be.eql([
            [
              walletPubKeyHash,
              [
                [
                  "0x51f373dcbb6122bcb1c62964b5f3be923092dc64bc9e31257931d58c4eadb9f5",
                  1,
                ],
              ],
              BigNumber.from(5000),
              [BigNumber.from(1000)],
            ],
            thirdParty.address,
          ])
        })
      })
    })
  })

  describe("submitDepositSweepProposalWithReimbursement", () => {
    const walletPubKeyHash = "0x7ac2d9378a1c47e589dfb8095ca95ed2140d2726"

    before(async () => {
      await createSnapshot()
    })

    after(async () => {
      await restoreSnapshot()
    })

    // Just double check that `submitDepositSweepProposalWithReimbursement` has
    // the same ACL as `submitDepositSweepProposal`.
    context("when the caller is not a coordinator", () => {
      before(async () => {
        await createSnapshot()
      })

      after(async () => {
        await restoreSnapshot()
      })

      it("should revert", async () => {
        const tx = walletCoordinator
          .connect(thirdParty)
          .submitDepositSweepProposalWithReimbursement({
            walletPubKeyHash,
            depositsKeys: [
              {
                fundingTxHash:
                  "0x51f373dcbb6122bcb1c62964b5f3be923092dc64bc9e31257931d58c4eadb9f5",
                fundingOutputIndex: 0,
              },
            ],
            sweepTxFee: 5000,
            depositsRevealBlocks: [1000],
          })

        await expect(tx).to.be.revertedWith("Caller is not a coordinator")
      })
    })

    // Here we just check that the reimbursement works. Detailed
    // assertions are already done within the scenario stressing the
    // `submitDepositSweepProposal` function.
    context("when the caller is a coordinator", () => {
      let coordinatorBalanceBefore: BigNumber
      let coordinatorBalanceAfter: BigNumber

      before(async () => {
        await createSnapshot()

        await walletCoordinator
          .connect(owner)
          .addCoordinator(thirdParty.address)

        // The first-ever proposal will be more expensive given it has to set
        // fields to non-zero values. We shouldn't adjust gas offset based on it.
        await walletCoordinator
          .connect(thirdParty)
          .submitDepositSweepProposalWithReimbursement({
            walletPubKeyHash,
            depositsKeys: [
              {
                fundingTxHash:
                  "0x51f373dcbb6122bcb1c62964b5f3be923092dc64bc9e31257931d58c4eadb9f5",
                fundingOutputIndex: 0,
              },
            ],
            sweepTxFee: 5000,
            depositsRevealBlocks: [1000],
          })

        // Jump beyond the lock period.
        await increaseTime(
          await walletCoordinator.depositSweepProposalValidity()
        )

        coordinatorBalanceBefore = await provider.getBalance(thirdParty.address)

        await walletCoordinator
          .connect(thirdParty)
          .submitDepositSweepProposalWithReimbursement({
            walletPubKeyHash,
            depositsKeys: [
              {
                fundingTxHash:
                  "0x51f373dcbb6122bcb1c62964b5f3be923092dc64bc9e31257931d58c4eadb9f5",
                fundingOutputIndex: 0,
              },
            ],
            sweepTxFee: 5000,
            depositsRevealBlocks: [1000],
          })

        coordinatorBalanceAfter = await provider.getBalance(thirdParty.address)
      })

      after(async () => {
        await restoreSnapshot()
      })

      it("should do the refund", async () => {
        const diff = coordinatorBalanceAfter.sub(coordinatorBalanceBefore)
        expect(diff).to.be.gt(0)
        expect(diff).to.be.lt(ethers.utils.parseUnits("4000000", "gwei")) // 0,004 ETH
      })
    })
  })

  describe("validateDepositSweepProposal", () => {
    const walletPubKeyHash = "0x7ac2d9378a1c47e589dfb8095ca95ed2140d2726"
    const ecdsaWalletID =
      "0x4ad6b3ccbca81645865d8d0d575797a15528e98ced22f29a6f906d3259569863"
    const vault = "0x2553E09f832c9f5C656808bb7A24793818877732"
    const bridgeDepositTxMaxFee = 10000

    before(async () => {
      await createSnapshot()

      bridge.depositParameters.returns([0, 0, bridgeDepositTxMaxFee, 0])
    })

    after(async () => {
      bridge.depositParameters.reset()

      await restoreSnapshot()
    })

    context("when wallet is not Live", () => {
      const testData = [
        {
          testName: "when wallet state is Unknown",
          walletState: walletState.Unknown,
        },
        {
          testName: "when wallet state is MovingFunds",
          walletState: walletState.MovingFunds,
        },
        {
          testName: "when wallet state is Closing",
          walletState: walletState.Closing,
        },
        {
          testName: "when wallet state is Closed",
          walletState: walletState.Closed,
        },
        {
          testName: "when wallet state is Terminated",
          walletState: walletState.Terminated,
        },
      ]

      testData.forEach((test) => {
        context(test.testName, () => {
          before(async () => {
            await createSnapshot()

            bridge.wallets.whenCalledWith(walletPubKeyHash).returns({
              ecdsaWalletID,
              mainUtxoHash: HashZero,
              pendingRedemptionsValue: 0,
              createdAt: 0,
              movingFundsRequestedAt: 0,
              closingStartedAt: 0,
              pendingMovedFundsSweepRequestsCount: 0,
              state: test.walletState,
              movingFundsTargetWalletsCommitmentHash: HashZero,
            })
          })

          after(async () => {
            bridge.wallets.reset()

            await restoreSnapshot()
          })

          it("should revert", async () => {
            await expect(
              // Only walletPubKeyHash argument is relevant in this scenario.
              walletCoordinator.validateDepositSweepProposal(
                {
                  walletPubKeyHash,
                  depositsKeys: [],
                  sweepTxFee: 0,
                  depositsRevealBlocks: [],
                },
                []
              )
            ).to.be.revertedWith("Wallet is not in Live state")
          })
        })
      })
    })

    context("when wallet is Live", () => {
      before(async () => {
        await createSnapshot()

        bridge.wallets.whenCalledWith(walletPubKeyHash).returns({
          ecdsaWalletID,
          mainUtxoHash: HashZero,
          pendingRedemptionsValue: 0,
          createdAt: 0,
          movingFundsRequestedAt: 0,
          closingStartedAt: 0,
          pendingMovedFundsSweepRequestsCount: 0,
          state: walletState.Live,
          movingFundsTargetWalletsCommitmentHash: HashZero,
        })
      })

      after(async () => {
        bridge.wallets.reset()

        await restoreSnapshot()
      })

      context("when sweep is below the min size", () => {
        it("should revert", async () => {
          await expect(
            walletCoordinator.validateDepositSweepProposal(
              {
                walletPubKeyHash,
                depositsKeys: [], // Set size to 0.
                sweepTxFee: 0, // Not relevant in this scenario.
                depositsRevealBlocks: [], // Not relevant in this scenario.
              },
              [] // Not relevant in this scenario.
            )
          ).to.be.revertedWith("Sweep below the min size")
        })
      })

      context("when sweep is above the min size", () => {
        context("when sweep exceeds the max size", () => {
          it("should revert", async () => {
            const maxSize = await walletCoordinator.depositSweepMaxSize()

            // Pick more deposits than allowed.
            const depositsKeys = new Array(maxSize + 1).fill(
              createTestDeposit(walletPubKeyHash, vault).key
            )

            await expect(
              walletCoordinator.validateDepositSweepProposal(
                {
                  walletPubKeyHash,
                  depositsKeys,
                  sweepTxFee: 0, // Not relevant in this scenario.
                  depositsRevealBlocks: [], // Not relevant in this scenario.
                },
                [] // Not relevant in this scenario.
              )
            ).to.be.revertedWith("Sweep exceeds the max size")
          })
        })

        context("when sweep does not exceed the max size", () => {
          context("when deposit extra data length does not match", () => {
            it("should revert", async () => {
              // The proposal contains one deposit.
              const proposal = {
                walletPubKeyHash,
                depositsKeys: [createTestDeposit(walletPubKeyHash, vault).key],
                sweepTxFee: 0, // Not relevant in this scenario.
                depositsRevealBlocks: [], // Not relevant in this scenario.
              }

              // The extra data array contains two items.
              const depositsExtraInfo = [
                emptyDepositExtraInfo,
                emptyDepositExtraInfo,
              ]

              await expect(
                walletCoordinator.validateDepositSweepProposal(
                  proposal,
                  depositsExtraInfo
                )
              ).to.be.revertedWith(
                "Each deposit key must have matching extra data"
              )
            })
          })

          context("when deposit extra data length matches", () => {
            context("when proposed sweep tx fee is invalid", () => {
              context("when proposed sweep tx fee is zero", () => {
                let depositOne
                let depositTwo

                before(async () => {
                  await createSnapshot()

                  depositOne = createTestDeposit(walletPubKeyHash, vault, true)
                  depositTwo = createTestDeposit(walletPubKeyHash, vault, false)

                  bridge.deposits
                    .whenCalledWith(
                      depositKey(
                        depositOne.key.fundingTxHash,
                        depositOne.key.fundingOutputIndex
                      )
                    )
                    .returns(depositOne.request)

                  bridge.deposits
                    .whenCalledWith(
                      depositKey(
                        depositTwo.key.fundingTxHash,
                        depositTwo.key.fundingOutputIndex
                      )
                    )
                    .returns(depositTwo.request)
                })

                after(async () => {
                  bridge.deposits.reset()

                  await restoreSnapshot()
                })

                it("should revert", async () => {
                  const proposal = {
                    walletPubKeyHash,
                    depositsKeys: [depositOne.key, depositTwo.key],
                    sweepTxFee: 0,
                    depositsRevealBlocks: [], // Not relevant in this scenario.
                  }

                  const depositsExtraInfo = [
                    depositOne.extraInfo,
                    depositTwo.extraInfo,
                  ]

                  await expect(
                    walletCoordinator.validateDepositSweepProposal(
                      proposal,
                      depositsExtraInfo
                    )
                  ).to.be.revertedWith(
                    "Proposed transaction fee cannot be zero"
                  )
                })
              })

              context(
                "when proposed sweep tx fee is greater than the allowed",
                () => {
                  let depositOne
                  let depositTwo

                  before(async () => {
                    await createSnapshot()

                    depositOne = createTestDeposit(
                      walletPubKeyHash,
                      vault,
                      true
                    )
                    depositTwo = createTestDeposit(
                      walletPubKeyHash,
                      vault,
                      false
                    )

                    bridge.deposits
                      .whenCalledWith(
                        depositKey(
                          depositOne.key.fundingTxHash,
                          depositOne.key.fundingOutputIndex
                        )
                      )
                      .returns(depositOne.request)

                    bridge.deposits
                      .whenCalledWith(
                        depositKey(
                          depositTwo.key.fundingTxHash,
                          depositTwo.key.fundingOutputIndex
                        )
                      )
                      .returns(depositTwo.request)
                  })

                  after(async () => {
                    bridge.deposits.reset()

                    await restoreSnapshot()
                  })

                  it("should revert", async () => {
                    const proposal = {
                      walletPubKeyHash,
                      depositsKeys: [depositOne.key, depositTwo.key],
                      // Exceed the max per-deposit fee by one.
                      sweepTxFee: bridgeDepositTxMaxFee * 2 + 1,
                      depositsRevealBlocks: [], // Not relevant in this scenario.
                    }

                    const depositsExtraInfo = [
                      depositOne.extraInfo,
                      depositTwo.extraInfo,
                    ]

                    await expect(
                      walletCoordinator.validateDepositSweepProposal(
                        proposal,
                        depositsExtraInfo
                      )
                    ).to.be.revertedWith("Proposed transaction fee is too high")
                  })
                }
              )
            })

            context("when proposed sweep tx fee is valid", () => {
              const sweepTxFee = 5000

              context("when there is a non-revealed deposit", () => {
                let depositOne
                let depositTwo

                before(async () => {
                  await createSnapshot()

                  depositOne = createTestDeposit(walletPubKeyHash, vault, true)
                  depositTwo = createTestDeposit(walletPubKeyHash, vault, false)

                  // Deposit one is a proper one.
                  bridge.deposits
                    .whenCalledWith(
                      depositKey(
                        depositOne.key.fundingTxHash,
                        depositOne.key.fundingOutputIndex
                      )
                    )
                    .returns(depositOne.request)

                  // Simulate the deposit two is not revealed.
                  bridge.deposits
                    .whenCalledWith(
                      depositKey(
                        depositTwo.key.fundingTxHash,
                        depositTwo.key.fundingOutputIndex
                      )
                    )
                    .returns({
                      ...depositTwo.request,
                      revealedAt: 0,
                    })
                })

                after(async () => {
                  bridge.deposits.reset()

                  await restoreSnapshot()
                })

                it("should revert", async () => {
                  const proposal = {
                    walletPubKeyHash,
                    depositsKeys: [depositOne.key, depositTwo.key],
                    sweepTxFee,
                    depositsRevealBlocks: [], // Not relevant in this scenario.
                  }

                  const depositsExtraInfo = [
                    depositOne.extraInfo,
                    depositTwo.extraInfo,
                  ]

                  await expect(
                    walletCoordinator.validateDepositSweepProposal(
                      proposal,
                      depositsExtraInfo
                    )
                  ).to.be.revertedWith("Deposit not revealed")
                })
              })

              context("when all deposits are revealed", () => {
                context("when there is an immature deposit", () => {
                  let depositOne
                  let depositTwo

                  before(async () => {
                    await createSnapshot()

                    depositOne = createTestDeposit(
                      walletPubKeyHash,
                      vault,
                      true
                    )
                    depositTwo = createTestDeposit(
                      walletPubKeyHash,
                      vault,
                      false
                    )

                    // Deposit one is a proper one.
                    bridge.deposits
                      .whenCalledWith(
                        depositKey(
                          depositOne.key.fundingTxHash,
                          depositOne.key.fundingOutputIndex
                        )
                      )
                      .returns(depositOne.request)

                    // Simulate the deposit two has just been revealed thus not
                    // achieved the min age yet.
                    bridge.deposits
                      .whenCalledWith(
                        depositKey(
                          depositTwo.key.fundingTxHash,
                          depositTwo.key.fundingOutputIndex
                        )
                      )
                      .returns({
                        ...depositTwo.request,
                        revealedAt: await lastBlockTime(),
                      })
                  })

                  after(async () => {
                    bridge.deposits.reset()

                    await restoreSnapshot()
                  })

                  it("should revert", async () => {
                    const proposal = {
                      walletPubKeyHash,
                      depositsKeys: [depositOne.key, depositTwo.key],
                      sweepTxFee,
                      depositsRevealBlocks: [], // Not relevant in this scenario.
                    }

                    const depositsExtraInfo = [
                      depositOne.extraInfo,
                      depositTwo.extraInfo,
                    ]

                    await expect(
                      walletCoordinator.validateDepositSweepProposal(
                        proposal,
                        depositsExtraInfo
                      )
                    ).to.be.revertedWith("Deposit min age not achieved yet")
                  })
                })

                context("when all deposits achieved the min age", () => {
                  context("when there is an already swept deposit", () => {
                    let depositOne
                    let depositTwo

                    before(async () => {
                      await createSnapshot()

                      depositOne = createTestDeposit(
                        walletPubKeyHash,
                        vault,
                        true
                      )
                      depositTwo = createTestDeposit(
                        walletPubKeyHash,
                        vault,
                        false
                      )

                      // Deposit one is a proper one.
                      bridge.deposits
                        .whenCalledWith(
                          depositKey(
                            depositOne.key.fundingTxHash,
                            depositOne.key.fundingOutputIndex
                          )
                        )
                        .returns(depositOne.request)

                      // Simulate the deposit two has already been swept.
                      bridge.deposits
                        .whenCalledWith(
                          depositKey(
                            depositTwo.key.fundingTxHash,
                            depositTwo.key.fundingOutputIndex
                          )
                        )
                        .returns({
                          ...depositTwo.request,
                          sweptAt: await lastBlockTime(),
                        })
                    })

                    after(async () => {
                      bridge.deposits.reset()

                      await restoreSnapshot()
                    })

                    it("should revert", async () => {
                      const proposal = {
                        walletPubKeyHash,
                        depositsKeys: [depositOne.key, depositTwo.key],
                        sweepTxFee,
                        depositsRevealBlocks: [], // Not relevant in this scenario.
                      }

                      const depositsExtraInfo = [
                        depositOne.extraInfo,
                        depositTwo.extraInfo,
                      ]

                      await expect(
                        walletCoordinator.validateDepositSweepProposal(
                          proposal,
                          depositsExtraInfo
                        )
                      ).to.be.revertedWith("Deposit already swept")
                    })
                  })

                  context("when all deposits are not swept yet", () => {
                    context(
                      "when there is a deposit with invalid extra data",
                      () => {
                        context("when funding tx hashes don't match", () => {
                          let deposit

                          before(async () => {
                            await createSnapshot()

                            deposit = createTestDeposit(
                              walletPubKeyHash,
                              vault,
                              true
                            )

                            bridge.deposits
                              .whenCalledWith(
                                depositKey(
                                  deposit.key.fundingTxHash,
                                  deposit.key.fundingOutputIndex
                                )
                              )
                              .returns(deposit.request)
                          })

                          after(async () => {
                            bridge.deposits.reset()

                            await restoreSnapshot()
                          })

                          it("should revert", async () => {
                            const proposal = {
                              walletPubKeyHash,
                              depositsKeys: [deposit.key],
                              sweepTxFee,
                              depositsRevealBlocks: [], // Not relevant in this scenario.
                            }

                            // Corrupt the extra data by setting a different
                            // version than 0x01000000 used to produce the hash.
                            const depositsExtraInfo = [
                              {
                                ...deposit.extraInfo,
                                fundingTx: {
                                  ...deposit.extraInfo.fundingTx,
                                  version: "0x02000000",
                                },
                              },
                            ]

                            await expect(
                              walletCoordinator.validateDepositSweepProposal(
                                proposal,
                                depositsExtraInfo
                              )
                            ).to.be.revertedWith(
                              "Extra info funding tx hash does not match"
                            )
                          })
                        })

                        context(
                          "when 20-byte funding output hash does not match",
                          () => {
                            let deposit

                            before(async () => {
                              await createSnapshot()

                              deposit = createTestDeposit(
                                walletPubKeyHash,
                                vault,
                                false // Produce a non-witness deposit with 20-byte script
                              )

                              bridge.deposits
                                .whenCalledWith(
                                  depositKey(
                                    deposit.key.fundingTxHash,
                                    deposit.key.fundingOutputIndex
                                  )
                                )
                                .returns(deposit.request)
                            })

                            after(async () => {
                              bridge.deposits.reset()

                              await restoreSnapshot()
                            })

                            it("should revert", async () => {
                              const proposal = {
                                walletPubKeyHash,
                                depositsKeys: [deposit.key],
                                sweepTxFee,
                                depositsRevealBlocks: [], // Not relevant in this scenario.
                              }

                              // Corrupt the extra data by reversing the proper
                              // blinding factor used to produce the script.
                              const depositsExtraInfo = [
                                {
                                  ...deposit.extraInfo,
                                  blindingFactor: `0x${Buffer.from(
                                    deposit.extraInfo.blindingFactor.substring(
                                      2
                                    ),
                                    "hex"
                                  )
                                    .reverse()
                                    .toString("hex")}`,
                                },
                              ]

                              await expect(
                                walletCoordinator.validateDepositSweepProposal(
                                  proposal,
                                  depositsExtraInfo
                                )
                              ).to.be.revertedWith(
                                "Extra info funding output script does not match"
                              )
                            })
                          }
                        )

                        context(
                          "when 32-byte funding output hash does not match",
                          () => {
                            let deposit

                            before(async () => {
                              await createSnapshot()

                              deposit = createTestDeposit(
                                walletPubKeyHash,
                                vault,
                                true // Produce a witness deposit with 32-byte script
                              )

                              bridge.deposits
                                .whenCalledWith(
                                  depositKey(
                                    deposit.key.fundingTxHash,
                                    deposit.key.fundingOutputIndex
                                  )
                                )
                                .returns(deposit.request)
                            })

                            after(async () => {
                              bridge.deposits.reset()

                              await restoreSnapshot()
                            })

                            it("should revert", async () => {
                              const proposal = {
                                walletPubKeyHash,
                                depositsKeys: [deposit.key],
                                sweepTxFee,
                                depositsRevealBlocks: [], // Not relevant in this scenario.
                              }

                              // Corrupt the extra data by reversing the proper
                              // blinding factor used to produce the script.
                              const depositsExtraInfo = [
                                {
                                  ...deposit.extraInfo,
                                  blindingFactor: `0x${Buffer.from(
                                    deposit.extraInfo.blindingFactor.substring(
                                      2
                                    ),
                                    "hex"
                                  )
                                    .reverse()
                                    .toString("hex")}`,
                                },
                              ]

                              await expect(
                                walletCoordinator.validateDepositSweepProposal(
                                  proposal,
                                  depositsExtraInfo
                                )
                              ).to.be.revertedWith(
                                "Extra info funding output script does not match"
                              )
                            })
                          }
                        )
                      }
                    )

                    context("when all deposits extra data are valid", () => {
                      context(
                        "when there is a deposit that violates the refund safety margin",
                        () => {
                          let depositOne
                          let depositTwo

                          before(async () => {
                            await createSnapshot()

                            // Deposit one is a proper one.
                            depositOne = createTestDeposit(
                              walletPubKeyHash,
                              vault,
                              true
                            )

                            // Simulate that deposit two violates the refund.
                            // In order to do so, we need to use `createTestDeposit`
                            // with a custom reveal time that will produce
                            // a refund locktime being closer to the current
                            // moment than allowed by the refund safety margin.
                            const safetyMarginViolatedAt = await lastBlockTime()
                            const depositRefundableAt =
                              safetyMarginViolatedAt +
                              (await walletCoordinator.depositRefundSafetyMargin())
                            const depositRevealedAt =
                              depositRefundableAt - depositLocktime

                            depositTwo = createTestDeposit(
                              walletPubKeyHash,
                              vault,
                              false,
                              depositRevealedAt
                            )

                            bridge.deposits
                              .whenCalledWith(
                                depositKey(
                                  depositOne.key.fundingTxHash,
                                  depositOne.key.fundingOutputIndex
                                )
                              )
                              .returns(depositOne.request)

                            bridge.deposits
                              .whenCalledWith(
                                depositKey(
                                  depositTwo.key.fundingTxHash,
                                  depositTwo.key.fundingOutputIndex
                                )
                              )
                              .returns(depositTwo.request)
                          })

                          after(async () => {
                            bridge.deposits.reset()

                            await restoreSnapshot()
                          })

                          it("should revert", async () => {
                            const proposal = {
                              walletPubKeyHash,
                              depositsKeys: [depositOne.key, depositTwo.key],
                              sweepTxFee,
                              depositsRevealBlocks: [], // Not relevant in this scenario.
                            }

                            const depositsExtraInfo = [
                              depositOne.extraInfo,
                              depositTwo.extraInfo,
                            ]

                            await expect(
                              walletCoordinator.validateDepositSweepProposal(
                                proposal,
                                depositsExtraInfo
                              )
                            ).to.be.revertedWith(
                              "Deposit refund safety margin is not preserved"
                            )
                          })
                        }
                      )

                      context(
                        "when all deposits preserve the refund safety margin",
                        () => {
                          context(
                            "when there is a deposit controlled by a different wallet",
                            () => {
                              let depositOne
                              let depositTwo

                              before(async () => {
                                await createSnapshot()

                                depositOne = createTestDeposit(
                                  walletPubKeyHash,
                                  vault,
                                  true
                                )

                                // Deposit two uses a different wallet than deposit
                                // one.
                                depositTwo = createTestDeposit(
                                  `0x${Buffer.from(
                                    walletPubKeyHash.substring(2),
                                    "hex"
                                  )
                                    .reverse()
                                    .toString("hex")}`,
                                  vault,
                                  false
                                )

                                bridge.deposits
                                  .whenCalledWith(
                                    depositKey(
                                      depositOne.key.fundingTxHash,
                                      depositOne.key.fundingOutputIndex
                                    )
                                  )
                                  .returns(depositOne.request)

                                bridge.deposits
                                  .whenCalledWith(
                                    depositKey(
                                      depositTwo.key.fundingTxHash,
                                      depositTwo.key.fundingOutputIndex
                                    )
                                  )
                                  .returns(depositTwo.request)
                              })

                              after(async () => {
                                bridge.deposits.reset()

                                await restoreSnapshot()
                              })

                              it("should revert", async () => {
                                const proposal = {
                                  walletPubKeyHash,
                                  depositsKeys: [
                                    depositOne.key,
                                    depositTwo.key,
                                  ],
                                  sweepTxFee,
                                  depositsRevealBlocks: [], // Not relevant in this scenario.
                                }

                                const depositsExtraInfo = [
                                  depositOne.extraInfo,
                                  depositTwo.extraInfo,
                                ]

                                await expect(
                                  walletCoordinator.validateDepositSweepProposal(
                                    proposal,
                                    depositsExtraInfo
                                  )
                                ).to.be.revertedWith(
                                  "Deposit controlled by different wallet"
                                )
                              })
                            }
                          )

                          context(
                            "when all deposits are controlled by the same wallet",
                            () => {
                              context(
                                "when there is a deposit targeting a different vault",
                                () => {
                                  let depositOne
                                  let depositTwo

                                  before(async () => {
                                    await createSnapshot()

                                    depositOne = createTestDeposit(
                                      walletPubKeyHash,
                                      vault,
                                      true
                                    )

                                    // Deposit two uses a different vault than deposit
                                    // one.
                                    depositTwo = createTestDeposit(
                                      walletPubKeyHash,
                                      `0x${Buffer.from(
                                        vault.substring(2),
                                        "hex"
                                      )
                                        .reverse()
                                        .toString("hex")}`,
                                      false
                                    )

                                    bridge.deposits
                                      .whenCalledWith(
                                        depositKey(
                                          depositOne.key.fundingTxHash,
                                          depositOne.key.fundingOutputIndex
                                        )
                                      )
                                      .returns(depositOne.request)

                                    bridge.deposits
                                      .whenCalledWith(
                                        depositKey(
                                          depositTwo.key.fundingTxHash,
                                          depositTwo.key.fundingOutputIndex
                                        )
                                      )
                                      .returns(depositTwo.request)
                                  })

                                  after(async () => {
                                    bridge.deposits.reset()

                                    await restoreSnapshot()
                                  })

                                  it("should revert", async () => {
                                    const proposal = {
                                      walletPubKeyHash,
                                      depositsKeys: [
                                        depositOne.key,
                                        depositTwo.key,
                                      ],
                                      sweepTxFee,
                                      depositsRevealBlocks: [], // Not relevant in this scenario.
                                    }

                                    const depositsExtraInfo = [
                                      depositOne.extraInfo,
                                      depositTwo.extraInfo,
                                    ]

                                    await expect(
                                      walletCoordinator.validateDepositSweepProposal(
                                        proposal,
                                        depositsExtraInfo
                                      )
                                    ).to.be.revertedWith(
                                      "Deposit targets different vault"
                                    )
                                  })
                                }
                              )

                              context(
                                "when all deposits targets the same vault",
                                () => {
                                  context(
                                    "when there are duplicated deposits",
                                    () => {
                                      let depositOne
                                      let depositTwo
                                      let depositThree

                                      before(async () => {
                                        await createSnapshot()

                                        depositOne = createTestDeposit(
                                          walletPubKeyHash,
                                          vault,
                                          true
                                        )

                                        depositTwo = createTestDeposit(
                                          walletPubKeyHash,
                                          vault,
                                          false
                                        )

                                        depositThree = createTestDeposit(
                                          walletPubKeyHash,
                                          vault,
                                          false
                                        )

                                        bridge.deposits
                                          .whenCalledWith(
                                            depositKey(
                                              depositOne.key.fundingTxHash,
                                              depositOne.key.fundingOutputIndex
                                            )
                                          )
                                          .returns(depositOne.request)

                                        bridge.deposits
                                          .whenCalledWith(
                                            depositKey(
                                              depositTwo.key.fundingTxHash,
                                              depositTwo.key.fundingOutputIndex
                                            )
                                          )
                                          .returns(depositTwo.request)

                                        bridge.deposits
                                          .whenCalledWith(
                                            depositKey(
                                              depositThree.key.fundingTxHash,
                                              depositThree.key
                                                .fundingOutputIndex
                                            )
                                          )
                                          .returns(depositThree.request)
                                      })

                                      after(async () => {
                                        bridge.deposits.reset()

                                        await restoreSnapshot()
                                      })

                                      it("should succeed", async () => {
                                        const proposal = {
                                          walletPubKeyHash,
                                          depositsKeys: [
                                            depositOne.key,
                                            depositTwo.key,
                                            depositThree.key,
                                            depositTwo.key, // duplicate
                                          ],
                                          sweepTxFee,
                                          depositsRevealBlocks: [], // Not relevant in this scenario.
                                        }

                                        const depositsExtraInfo = [
                                          depositOne.extraInfo,
                                          depositTwo.extraInfo,
                                          depositThree.extraInfo,
                                          depositTwo.extraInfo, // duplicate
                                        ]

                                        await expect(
                                          walletCoordinator.validateDepositSweepProposal(
                                            proposal,
                                            depositsExtraInfo
                                          )
                                        ).to.be.revertedWith(
                                          "Duplicated deposit"
                                        )
                                      })
                                    }
                                  )

                                  context(
                                    "when all deposits are unique",
                                    () => {
                                      let depositOne
                                      let depositTwo

                                      before(async () => {
                                        await createSnapshot()

                                        depositOne = createTestDeposit(
                                          walletPubKeyHash,
                                          vault,
                                          true
                                        )

                                        depositTwo = createTestDeposit(
                                          walletPubKeyHash,
                                          vault,
                                          false
                                        )

                                        bridge.deposits
                                          .whenCalledWith(
                                            depositKey(
                                              depositOne.key.fundingTxHash,
                                              depositOne.key.fundingOutputIndex
                                            )
                                          )
                                          .returns(depositOne.request)

                                        bridge.deposits
                                          .whenCalledWith(
                                            depositKey(
                                              depositTwo.key.fundingTxHash,
                                              depositTwo.key.fundingOutputIndex
                                            )
                                          )
                                          .returns(depositTwo.request)
                                      })

                                      after(async () => {
                                        bridge.deposits.reset()

                                        await restoreSnapshot()
                                      })

                                      it("should succeed", async () => {
                                        const proposal = {
                                          walletPubKeyHash,
                                          depositsKeys: [
                                            depositOne.key,
                                            depositTwo.key,
                                          ],
                                          sweepTxFee,
                                          depositsRevealBlocks: [], // Not relevant in this scenario.
                                        }

                                        const depositsExtraInfo = [
                                          depositOne.extraInfo,
                                          depositTwo.extraInfo,
                                        ]

                                        const result =
                                          await walletCoordinator.validateDepositSweepProposal(
                                            proposal,
                                            depositsExtraInfo
                                          )

                                        // eslint-disable-next-line @typescript-eslint/no-unused-expressions
                                        expect(result).to.be.true
                                      })
                                    }
                                  )
                                }
                              )
                            }
                          )
                        }
                      )
                    })
                  })
                })
              })
            })
          })
        })
      })
    })
  })

  describe("updateRedemptionProposalParameters", () => {
    before(async () => {
      await createSnapshot()
    })

    after(async () => {
      await restoreSnapshot()
    })

    context("when called by a third party", () => {
      it("should revert", async () => {
        await expect(
          walletCoordinator
            .connect(thirdParty)
            .updateRedemptionProposalParameters(101, 102, 103, 104, 105)
        ).to.be.revertedWith("Ownable: caller is not the owner")
      })
    })

    context("when called by the owner", () => {
      let tx: ContractTransaction

      before(async () => {
        await createSnapshot()

        tx = await walletCoordinator
          .connect(owner)
          .updateRedemptionProposalParameters(101, 102, 103, 104, 105)
      })

      after(async () => {
        await restoreSnapshot()
      })

      it("should update redemption proposal parameters", async () => {
        expect(
          await walletCoordinator.redemptionProposalValidity()
        ).to.be.equal(101)
        expect(await walletCoordinator.redemptionRequestMinAge()).to.be.equal(
          102
        )
        expect(
          await walletCoordinator.redemptionRequestTimeoutSafetyMargin()
        ).to.be.equal(103)
        expect(await walletCoordinator.redemptionMaxSize()).to.be.equal(104)
        expect(
          await walletCoordinator.redemptionProposalSubmissionGasOffset()
        ).to.be.equal(105)
      })

      it("should emit the RedemptionProposalParametersUpdated event", async () => {
        await expect(tx)
          .to.emit(walletCoordinator, "RedemptionProposalParametersUpdated")
          .withArgs(101, 102, 103, 104, 105)
      })
    })
  })

  describe("submitRedemptionProposal", () => {
    const walletPubKeyHash = "0x7ac2d9378a1c47e589dfb8095ca95ed2140d2726"

    before(async () => {
      await createSnapshot()
    })

    after(async () => {
      await restoreSnapshot()
    })

    context("when the caller is not a coordinator", () => {
      before(async () => {
        await createSnapshot()
      })

      after(async () => {
        await restoreSnapshot()
      })

      it("should revert", async () => {
        const tx = walletCoordinator
          .connect(thirdParty)
          .submitRedemptionProposal({
            walletPubKeyHash,
            redeemersOutputScripts: [
              "0x1976a9142cd680318747b720d67bf4246eb7403b476adb3488ac",
              "0x160014e6f9d74726b19b75f16fe1e9feaec048aa4fa1d0",
            ],
            redemptionTxFee: 5000,
          })

        await expect(tx).to.be.revertedWith("Caller is not a coordinator")
      })
    })

    context("when the caller is a coordinator", () => {
      before(async () => {
        await createSnapshot()

        await walletCoordinator
          .connect(owner)
          .addCoordinator(thirdParty.address)
      })

      after(async () => {
        await restoreSnapshot()
      })

      context("when wallet is time-locked", () => {
        before(async () => {
          await createSnapshot()

          // Submit a proposal to set a wallet time lock.
          await walletCoordinator.connect(thirdParty).submitRedemptionProposal({
            walletPubKeyHash,
            redeemersOutputScripts: [
              "0x1976a9142cd680318747b720d67bf4246eb7403b476adb3488ac",
              "0x160014e6f9d74726b19b75f16fe1e9feaec048aa4fa1d0",
            ],
            redemptionTxFee: 5000,
          })

          // Jump to the end of the lock period but not beyond it.
          await increaseTime(
            (await walletCoordinator.redemptionProposalValidity()) - 1
          )
        })

        after(async () => {
          await restoreSnapshot()
        })

        it("should revert", async () => {
          await expect(
            walletCoordinator.connect(thirdParty).submitRedemptionProposal({
              walletPubKeyHash,
              redeemersOutputScripts: [
                "0x1976a9142cd680318747b720d67bf4246eb7403b476adb3488ac",
                "0x160014e6f9d74726b19b75f16fe1e9feaec048aa4fa1d0",
              ],
              redemptionTxFee: 5000,
            })
          ).to.be.revertedWith("Wallet locked")
        })
      })

      context("when wallet is not time-locked", () => {
        let tx: ContractTransaction

        before(async () => {
          await createSnapshot()

          // Submit a proposal to set a wallet time lock.
          await walletCoordinator.connect(thirdParty).submitRedemptionProposal({
            walletPubKeyHash,
            redeemersOutputScripts: [
              "0x1976a9142cd680318747b720d67bf4246eb7403b476adb3488ac",
              "0x160014e6f9d74726b19b75f16fe1e9feaec048aa4fa1d0",
            ],
            redemptionTxFee: 5000,
          })

          // Jump beyond the lock period.
          await increaseTime(
            await walletCoordinator.redemptionProposalValidity()
          )

          tx = await walletCoordinator
            .connect(thirdParty)
            .submitRedemptionProposal({
              walletPubKeyHash,
              redeemersOutputScripts: [
                "0x1976a9142cd680318747b720d67bf4246eb7403b476adb3488ac",
                "0x160014e6f9d74726b19b75f16fe1e9feaec048aa4fa1d0",
              ],
              redemptionTxFee: 6000,
            })
        })

        after(async () => {
          await restoreSnapshot()
        })

        it("should time lock the wallet", async () => {
          const lockedUntil =
            (await lastBlockTime()) +
            (await walletCoordinator.redemptionProposalValidity())

          const walletLock = await walletCoordinator.walletLock(
            walletPubKeyHash
          )

          expect(walletLock.expiresAt).to.be.equal(lockedUntil)
          expect(walletLock.cause).to.be.equal(walletAction.Redemption)
        })

        it("should emit the RedemptionProposalSubmitted event", async () => {
          await expect(tx).to.emit(
            walletCoordinator,
            "RedemptionProposalSubmitted"
          )

          // The `expect.to.emit.withArgs` assertion has troubles with
          // matching complex event arguments as it uses strict equality
          // underneath. To overcome that problem, we manually get event's
          // arguments and check it against the expected ones using deep
          // equality assertion (eql).
          const receipt = await ethers.provider.getTransactionReceipt(tx.hash)
          expect(receipt.logs.length).to.be.equal(1)
          expect(
            walletCoordinator.interface.parseLog(receipt.logs[0]).args
          ).to.be.eql([
            [
              walletPubKeyHash,
              [
                "0x1976a9142cd680318747b720d67bf4246eb7403b476adb3488ac",
                "0x160014e6f9d74726b19b75f16fe1e9feaec048aa4fa1d0",
              ],
              BigNumber.from(6000),
            ],
            thirdParty.address,
          ])
        })
      })
    })
  })

  describe("submitRedemptionProposalWithReimbursement", () => {
    const walletPubKeyHash = "0x7ac2d9378a1c47e589dfb8095ca95ed2140d2726"

    before(async () => {
      await createSnapshot()
    })

    after(async () => {
      await restoreSnapshot()
    })

    // Just double check that `submitRedemptionProposalWithReimbursement` has
    // the same ACL as `submitRedemptionProposal`.
    context("when the caller is not a coordinator", () => {
      before(async () => {
        await createSnapshot()
      })

      after(async () => {
        await restoreSnapshot()
      })

      it("should revert", async () => {
        const tx = walletCoordinator
          .connect(thirdParty)
          .submitRedemptionProposalWithReimbursement({
            walletPubKeyHash,
            redeemersOutputScripts: [
              "0x1976a9142cd680318747b720d67bf4246eb7403b476adb3488ac",
              "0x160014e6f9d74726b19b75f16fe1e9feaec048aa4fa1d0",
            ],
            redemptionTxFee: 5000,
          })

        await expect(tx).to.be.revertedWith("Caller is not a coordinator")
      })
    })

    // Here we just check that the reimbursement works. Detailed
    // assertions are already done within the scenario stressing the
    // `submitRedemptionProposal` function.
    context("when the caller is a coordinator", () => {
      let coordinatorBalanceBefore: BigNumber
      let coordinatorBalanceAfter: BigNumber

      before(async () => {
        await createSnapshot()

        await walletCoordinator
          .connect(owner)
          .addCoordinator(thirdParty.address)

        // The first-ever proposal will be more expensive given it has to set
        // fields to non-zero values. We shouldn't adjust gas offset based on it.
        await walletCoordinator
          .connect(thirdParty)
          .submitRedemptionProposalWithReimbursement({
            walletPubKeyHash,
            redeemersOutputScripts: [
              "0x1976a9142cd680318747b720d67bf4246eb7403b476adb3488ac",
              "0x160014e6f9d74726b19b75f16fe1e9feaec048aa4fa1d0",
            ],
            redemptionTxFee: 5000,
          })

        // Jump beyond the lock period.
        await increaseTime(await walletCoordinator.redemptionProposalValidity())

        coordinatorBalanceBefore = await provider.getBalance(thirdParty.address)

        await walletCoordinator
          .connect(thirdParty)
          .submitRedemptionProposalWithReimbursement({
            walletPubKeyHash,
            redeemersOutputScripts: [
              "0x1976a9142cd680318747b720d67bf4246eb7403b476adb3488ac",
              "0x160014e6f9d74726b19b75f16fe1e9feaec048aa4fa1d0",
            ],
            redemptionTxFee: 5000,
          })

        coordinatorBalanceAfter = await provider.getBalance(thirdParty.address)
      })

      after(async () => {
        await restoreSnapshot()
      })

      it("should do the refund", async () => {
        const diff = coordinatorBalanceAfter.sub(coordinatorBalanceBefore)
        expect(diff).to.be.gt(0)
        expect(diff).to.be.lt(ethers.utils.parseUnits("4000000", "gwei")) // 0,004 ETH
      })
    })
  })

  describe("validateRedemptionProposal", () => {
    const walletPubKeyHash = "0x7ac2d9378a1c47e589dfb8095ca95ed2140d2726"
    const ecdsaWalletID =
      "0x4ad6b3ccbca81645865d8d0d575797a15528e98ced22f29a6f906d3259569863"

    const bridgeRedemptionTxMaxTotalFee = 10000
    const bridgeRedemptionTimeout = 5 * 86400 // 5 days

    before(async () => {
      await createSnapshot()

      bridge.redemptionParameters.returns([
        0,
        0,
        0,
        bridgeRedemptionTxMaxTotalFee,
        bridgeRedemptionTimeout,
        0,
        0,
      ])
    })

    after(async () => {
      bridge.redemptionParameters.reset()

      await restoreSnapshot()
    })

    context("when wallet is not Live", () => {
      const testData = [
        {
          testName: "when wallet state is Unknown",
          walletState: walletState.Unknown,
        },
        {
          testName: "when wallet state is MovingFunds",
          walletState: walletState.MovingFunds,
        },
        {
          testName: "when wallet state is Closing",
          walletState: walletState.Closing,
        },
        {
          testName: "when wallet state is Closed",
          walletState: walletState.Closed,
        },
        {
          testName: "when wallet state is Terminated",
          walletState: walletState.Terminated,
        },
      ]

      testData.forEach((test) => {
        context(test.testName, () => {
          before(async () => {
            await createSnapshot()

            bridge.wallets.whenCalledWith(walletPubKeyHash).returns({
              ecdsaWalletID,
              mainUtxoHash: HashZero,
              pendingRedemptionsValue: 0,
              createdAt: 0,
              movingFundsRequestedAt: 0,
              closingStartedAt: 0,
              pendingMovedFundsSweepRequestsCount: 0,
              state: test.walletState,
              movingFundsTargetWalletsCommitmentHash: HashZero,
            })
          })

          after(async () => {
            bridge.wallets.reset()

            await restoreSnapshot()
          })

          it("should revert", async () => {
            await expect(
              // Only walletPubKeyHash argument is relevant in this scenario.
              walletCoordinator.validateRedemptionProposal({
                walletPubKeyHash,
                redeemersOutputScripts: [],
                redemptionTxFee: 0,
              })
            ).to.be.revertedWith("Wallet is not in Live state")
          })
        })
      })
    })

    context("when wallet is Live", () => {
      before(async () => {
        await createSnapshot()

        bridge.wallets.whenCalledWith(walletPubKeyHash).returns({
          ecdsaWalletID,
          mainUtxoHash: HashZero,
          pendingRedemptionsValue: 0,
          createdAt: 0,
          movingFundsRequestedAt: 0,
          closingStartedAt: 0,
          pendingMovedFundsSweepRequestsCount: 0,
          state: walletState.Live,
          movingFundsTargetWalletsCommitmentHash: HashZero,
        })
      })

      after(async () => {
        bridge.wallets.reset()

        await restoreSnapshot()
      })

      context("when redemption is below the min size", () => {
        it("should revert", async () => {
          await expect(
            walletCoordinator.validateRedemptionProposal({
              walletPubKeyHash,
              redeemersOutputScripts: [], // Set size to 0.
              redemptionTxFee: 0, // Not relevant in this scenario.
            })
          ).to.be.revertedWith("Redemption below the min size")
        })
      })

      context("when redemption is above the min size", () => {
        context("when redemption exceeds the max size", () => {
          it("should revert", async () => {
            const maxSize = await walletCoordinator.redemptionMaxSize()

            // Pick more redemption requests than allowed.
            const redeemersOutputScripts = new Array(maxSize + 1).fill(
              createTestRedemptionRequest(walletPubKeyHash).key
                .redeemerOutputScript
            )

            await expect(
              walletCoordinator.validateRedemptionProposal({
                walletPubKeyHash,
                redeemersOutputScripts,
                redemptionTxFee: 0, // Not relevant in this scenario.
              })
            ).to.be.revertedWith("Redemption exceeds the max size")
          })
        })

        context("when redemption does not exceed the max size", () => {
          context("when proposed redemption tx fee is invalid", () => {
            context("when proposed redemption tx fee is zero", () => {
              it("should revert", async () => {
                await expect(
                  walletCoordinator.validateRedemptionProposal({
                    walletPubKeyHash,
                    redeemersOutputScripts: [
                      createTestRedemptionRequest(walletPubKeyHash).key
                        .redeemerOutputScript,
                    ],
                    redemptionTxFee: 0,
                  })
                ).to.be.revertedWith("Proposed transaction fee cannot be zero")
              })
            })

            context(
              "when proposed redemption tx fee is greater than the allowed total fee",
              () => {
                it("should revert", async () => {
                  await expect(
                    walletCoordinator.validateRedemptionProposal({
                      walletPubKeyHash,
                      redeemersOutputScripts: [
                        createTestRedemptionRequest(walletPubKeyHash).key
                          .redeemerOutputScript,
                      ],
                      // Exceed the max per-request fee by one.
                      redemptionTxFee: bridgeRedemptionTxMaxTotalFee + 1,
                    })
                  ).to.be.revertedWith("Proposed transaction fee is too high")
                })
              }
            )
          })

          context("when proposed redemption tx fee is valid", () => {
            const redemptionTxFee = 9000

            context("when there is a non-pending request", () => {
              let requestOne
              let requestTwo

              before(async () => {
                await createSnapshot()

                requestOne = createTestRedemptionRequest(
                  walletPubKeyHash,
                  5000 // necessary to pass the fee share validation
                )
                requestTwo = createTestRedemptionRequest(walletPubKeyHash)

                // Request one is a proper one.
                bridge.pendingRedemptions
                  .whenCalledWith(
                    redemptionKey(
                      requestOne.key.walletPubKeyHash,
                      requestOne.key.redeemerOutputScript
                    )
                  )
                  .returns(requestOne.content)

                // Simulate the request two is non-pending.
                bridge.pendingRedemptions
                  .whenCalledWith(
                    redemptionKey(
                      requestTwo.key.walletPubKeyHash,
                      requestTwo.key.redeemerOutputScript
                    )
                  )
                  .returns({
                    ...requestTwo.content,
                    requestedAt: 0,
                  })
              })

              after(async () => {
                bridge.pendingRedemptions.reset()

                await restoreSnapshot()
              })

              it("should revert", async () => {
                const proposal = {
                  walletPubKeyHash,
                  redeemersOutputScripts: [
                    requestOne.key.redeemerOutputScript,
                    requestTwo.key.redeemerOutputScript,
                  ],
                  redemptionTxFee,
                }

                await expect(
                  walletCoordinator.validateRedemptionProposal(proposal)
                ).to.be.revertedWith("Not a pending redemption request")
              })
            })

            context("when all requests are pending", () => {
              context("when there is an immature request", () => {
                let requestOne
                let requestTwo

                before(async () => {
                  await createSnapshot()

                  requestOne = createTestRedemptionRequest(
                    walletPubKeyHash,
                    5000 // necessary to pass the fee share validation
                  )
                  requestTwo = createTestRedemptionRequest(walletPubKeyHash)

                  // Request one is a proper one.
                  bridge.pendingRedemptions
                    .whenCalledWith(
                      redemptionKey(
                        requestOne.key.walletPubKeyHash,
                        requestOne.key.redeemerOutputScript
                      )
                    )
                    .returns(requestOne.content)

                  // Simulate the request two has just been created thus not
                  // achieved the min age yet.
                  bridge.pendingRedemptions
                    .whenCalledWith(
                      redemptionKey(
                        requestTwo.key.walletPubKeyHash,
                        requestTwo.key.redeemerOutputScript
                      )
                    )
                    .returns({
                      ...requestTwo.content,
                      requestedAt: await lastBlockTime(),
                    })
                })

                after(async () => {
                  bridge.pendingRedemptions.reset()

                  await restoreSnapshot()
                })

                it("should revert", async () => {
                  const proposal = {
                    walletPubKeyHash,
                    redeemersOutputScripts: [
                      requestOne.key.redeemerOutputScript,
                      requestTwo.key.redeemerOutputScript,
                    ],
                    redemptionTxFee,
                  }

                  await expect(
                    walletCoordinator.validateRedemptionProposal(proposal)
                  ).to.be.revertedWith(
                    "Redemption request min age not achieved yet"
                  )
                })
              })

              context("when all requests achieved the min age", () => {
                context(
                  "when there is a request that violates the timeout safety margin",
                  () => {
                    let requestOne
                    let requestTwo

                    before(async () => {
                      await createSnapshot()

                      // Request one is a proper one.
                      requestOne = createTestRedemptionRequest(
                        walletPubKeyHash,
                        5000 // necessary to pass the fee share validation
                      )

                      // Simulate that request two violates the timeout safety margin.
                      // In order to do so, we need to use `createTestRedemptionRequest`
                      // with a custom request creation time that will produce
                      // a timeout timestamp being closer to the current
                      // moment than allowed by the refund safety margin.
                      const safetyMarginViolatedAt = await lastBlockTime()
                      const requestTimedOutAt =
                        safetyMarginViolatedAt +
                        (await walletCoordinator.redemptionRequestTimeoutSafetyMargin())
                      const requestCreatedAt =
                        requestTimedOutAt - bridgeRedemptionTimeout

                      requestTwo = createTestRedemptionRequest(
                        walletPubKeyHash,
                        0,
                        requestCreatedAt
                      )

                      bridge.pendingRedemptions
                        .whenCalledWith(
                          redemptionKey(
                            requestOne.key.walletPubKeyHash,
                            requestOne.key.redeemerOutputScript
                          )
                        )
                        .returns(requestOne.content)

                      bridge.pendingRedemptions
                        .whenCalledWith(
                          redemptionKey(
                            requestTwo.key.walletPubKeyHash,
                            requestTwo.key.redeemerOutputScript
                          )
                        )
                        .returns(requestTwo.content)
                    })

                    after(async () => {
                      bridge.pendingRedemptions.reset()

                      await restoreSnapshot()
                    })

                    it("should revert", async () => {
                      const proposal = {
                        walletPubKeyHash,
                        redeemersOutputScripts: [
                          requestOne.key.redeemerOutputScript,
                          requestTwo.key.redeemerOutputScript,
                        ],
                        redemptionTxFee,
                      }

                      await expect(
                        walletCoordinator.validateRedemptionProposal(proposal)
                      ).to.be.revertedWith(
                        "Redemption request timeout safety margin is not preserved"
                      )
                    })
                  }
                )

                context(
                  "when all requests preserve the timeout safety margin",
                  () => {
                    context(
                      "when there is a request that incurs an unacceptable tx fee share",
                      () => {
                        context("when there is no fee remainder", () => {
                          let requestOne
                          let requestTwo

                          before(async () => {
                            await createSnapshot()

                            // Request one is a proper one.
                            requestOne = createTestRedemptionRequest(
                              walletPubKeyHash,
                              4500 // necessary to pass the fee share validation
                            )

                            // Simulate that request two takes an unacceptable
                            // tx fee share. Because redemptionTxFee used
                            // in the proposal is 9000, the actual fee share
                            // per-request is 4500. In order to test this case
                            // the second request must allow for 4499 as allowed
                            // fee share at maximum.
                            requestTwo = createTestRedemptionRequest(
                              walletPubKeyHash,
                              4499
                            )

                            bridge.pendingRedemptions
                              .whenCalledWith(
                                redemptionKey(
                                  requestOne.key.walletPubKeyHash,
                                  requestOne.key.redeemerOutputScript
                                )
                              )
                              .returns(requestOne.content)

                            bridge.pendingRedemptions
                              .whenCalledWith(
                                redemptionKey(
                                  requestTwo.key.walletPubKeyHash,
                                  requestTwo.key.redeemerOutputScript
                                )
                              )
                              .returns(requestTwo.content)
                          })

                          after(async () => {
                            bridge.pendingRedemptions.reset()

                            await restoreSnapshot()
                          })

                          it("should revert", async () => {
                            const proposal = {
                              walletPubKeyHash,
                              redeemersOutputScripts: [
                                requestOne.key.redeemerOutputScript,
                                requestTwo.key.redeemerOutputScript,
                              ],
                              redemptionTxFee,
                            }

                            await expect(
                              walletCoordinator.validateRedemptionProposal(
                                proposal
                              )
                            ).to.be.revertedWith(
                              "Proposed transaction per-request fee share is too high"
                            )
                          })
                        })

                        context("when there is a fee remainder", () => {
                          let requestOne
                          let requestTwo

                          before(async () => {
                            await createSnapshot()

                            // Request one is a proper one.
                            requestOne = createTestRedemptionRequest(
                              walletPubKeyHash,
                              4500 // necessary to pass the fee share validation
                            )

                            // Simulate that request two takes an unacceptable
                            // tx fee share. Because redemptionTxFee used
                            // in the proposal is 9001, the actual fee share
                            // per-request is 4500 and 4501 for the last request
                            // which takes the remainder. In order to test this
                            // case the second (last) request must allow for
                            // 4500 as allowed fee share at maximum.
                            requestTwo = createTestRedemptionRequest(
                              walletPubKeyHash,
                              4500
                            )

                            bridge.pendingRedemptions
                              .whenCalledWith(
                                redemptionKey(
                                  requestOne.key.walletPubKeyHash,
                                  requestOne.key.redeemerOutputScript
                                )
                              )
                              .returns(requestOne.content)

                            bridge.pendingRedemptions
                              .whenCalledWith(
                                redemptionKey(
                                  requestTwo.key.walletPubKeyHash,
                                  requestTwo.key.redeemerOutputScript
                                )
                              )
                              .returns(requestTwo.content)
                          })

                          after(async () => {
                            bridge.pendingRedemptions.reset()

                            await restoreSnapshot()
                          })

                          it("should revert", async () => {
                            const proposal = {
                              walletPubKeyHash,
                              redeemersOutputScripts: [
                                requestOne.key.redeemerOutputScript,
                                requestTwo.key.redeemerOutputScript,
                              ],
                              redemptionTxFee: 9001,
                            }

                            await expect(
                              walletCoordinator.validateRedemptionProposal(
                                proposal
                              )
                            ).to.be.revertedWith(
                              "Proposed transaction per-request fee share is too high"
                            )
                          })
                        })
                      }
                    )

                    context(
                      "when all requests incur an acceptable tx fee share",
                      () => {
                        context("when there are duplicated requests", () => {
                          let requestOne
                          let requestTwo
                          let requestThree

                          before(async () => {
                            await createSnapshot()

                            requestOne = createTestRedemptionRequest(
                              walletPubKeyHash,
                              2500 // necessary to pass the fee share validation
                            )

                            requestTwo = createTestRedemptionRequest(
                              walletPubKeyHash,
                              2500 // necessary to pass the fee share validation
                            )

                            requestThree = createTestRedemptionRequest(
                              walletPubKeyHash,
                              2500 // necessary to pass the fee share validation
                            )

                            bridge.pendingRedemptions
                              .whenCalledWith(
                                redemptionKey(
                                  requestOne.key.walletPubKeyHash,
                                  requestOne.key.redeemerOutputScript
                                )
                              )
                              .returns(requestOne.content)

                            bridge.pendingRedemptions
                              .whenCalledWith(
                                redemptionKey(
                                  requestTwo.key.walletPubKeyHash,
                                  requestTwo.key.redeemerOutputScript
                                )
                              )
                              .returns(requestTwo.content)

                            bridge.pendingRedemptions
                              .whenCalledWith(
                                redemptionKey(
                                  requestThree.key.walletPubKeyHash,
                                  requestThree.key.redeemerOutputScript
                                )
                              )
                              .returns(requestThree.content)
                          })

                          after(async () => {
                            bridge.pendingRedemptions.reset()

                            await restoreSnapshot()
                          })

                          it("should revert", async () => {
                            const proposal = {
                              walletPubKeyHash,
                              redeemersOutputScripts: [
                                requestOne.key.redeemerOutputScript,
                                requestTwo.key.redeemerOutputScript,
                                requestThree.key.redeemerOutputScript,
                                requestTwo.key.redeemerOutputScript, // duplicate
                              ],
                              redemptionTxFee,
                            }

                            await expect(
                              walletCoordinator.validateRedemptionProposal(
                                proposal
                              )
                            ).to.be.revertedWith("Duplicated request")
                          })
                        })

                        context("when all requests are unique", () => {
                          let requestOne
                          let requestTwo

                          before(async () => {
                            await createSnapshot()

                            requestOne = createTestRedemptionRequest(
                              walletPubKeyHash,
                              5000 // necessary to pass the fee share validation
                            )

                            requestTwo = createTestRedemptionRequest(
                              walletPubKeyHash,
                              5000 // necessary to pass the fee share validation
                            )

                            bridge.pendingRedemptions
                              .whenCalledWith(
                                redemptionKey(
                                  requestOne.key.walletPubKeyHash,
                                  requestOne.key.redeemerOutputScript
                                )
                              )
                              .returns(requestOne.content)

                            bridge.pendingRedemptions
                              .whenCalledWith(
                                redemptionKey(
                                  requestTwo.key.walletPubKeyHash,
                                  requestTwo.key.redeemerOutputScript
                                )
                              )
                              .returns(requestTwo.content)
                          })

                          after(async () => {
                            bridge.pendingRedemptions.reset()

                            await restoreSnapshot()
                          })

                          it("should succeed", async () => {
                            const proposal = {
                              walletPubKeyHash,
                              redeemersOutputScripts: [
                                requestOne.key.redeemerOutputScript,
                                requestTwo.key.redeemerOutputScript,
                              ],
                              redemptionTxFee,
                            }

                            const result =
                              await walletCoordinator.validateRedemptionProposal(
                                proposal
                              )

                            // eslint-disable-next-line @typescript-eslint/no-unused-expressions
                            expect(result).to.be.true
                          })
                        })
                      }
                    )
                  }
                )
              })
            })
          })
        })
      })
    })
  })
})

const depositKey = (
  fundingTxHash: BytesLike,
  fundingOutputIndex: BigNumberish
) =>
  ethers.utils.solidityKeccak256(
    ["bytes32", "uint32"],
    [fundingTxHash, fundingOutputIndex]
  )

const createTestDeposit = (
  walletPubKeyHash: string,
  vault: string,
  witness = true,
  revealedAt?: number
) => {
  let resolvedRevealedAt = revealedAt

  if (!resolvedRevealedAt) {
    // If the deposit reveal time is not explicitly set, use `now - 1 day` to
    // ensure deposit minimum age is achieved by default.
    const now = Math.floor(Date.now() / 1000)
    resolvedRevealedAt = now - day
  }

  const refundableAt = resolvedRevealedAt + depositLocktime

  const refundLocktime = `0x${Buffer.from(
    BigNumber.from(refundableAt).toHexString().substring(2),
    "hex"
  )
    .reverse()
    .toString("hex")}`

  if (refundLocktime.substring(2).length !== 8) {
    throw new Error("wrong refund locktime byte length")
  }

  // The depositor, blindingFactor, refundPubKeyHash are not relevant
  // in this test suite so can be random.
  const depositor = `0x${crypto.randomBytes(20).toString("hex")}`
  const blindingFactor = `0x${crypto.randomBytes(8).toString("hex")}`
  const refundPubKeyHash = `0x${crypto.randomBytes(20).toString("hex")}`

  const depositScript =
    `0x14${depositor.substring(2)}7508${blindingFactor.substring(2)}7576a914` +
    `${walletPubKeyHash.substring(2)}8763ac6776a914` +
    `${refundPubKeyHash.substring(2)}8804${refundLocktime.substring(2)}b175ac68`

  let depositScriptHash
  if (witness) {
    depositScriptHash = `220020${ethers.utils
      .sha256(depositScript)
      .substring(2)}`
  } else {
    const sha256Hash = ethers.utils.sha256(depositScript)
    const ripemd160Hash = ethers.utils.ripemd160(sha256Hash).substring(2)
    depositScriptHash = `17a914${ripemd160Hash}87`
  }

  const fundingTx = {
    version: "0x01000000",
    // Input vector is not relevant in this test suite so can be random.
    inputVector: `0x01${crypto
      .randomBytes(32)
      .toString("hex")}0000000000ffffffff`,
    outputVector: `0x010000000000000000${depositScriptHash}`,
    locktime: "0x00000000",
  }

  const fundingTxHash = ethers.utils.sha256(
    ethers.utils.sha256(
      `0x${fundingTx.version.substring(2)}` +
        `${fundingTx.inputVector.substring(2)}` +
        `${fundingTx.outputVector.substring(2)}` +
        `${fundingTx.locktime.substring(2)}`
    )
  )

  return {
    key: {
      fundingTxHash,
      fundingOutputIndex: 0, // not relevant
    },
    request: {
      depositor,
      amount: 0, // not relevant
      revealedAt: resolvedRevealedAt,
      vault,
      treasuryFee: 0, // not relevant
      sweptAt: 0, // important to pass the validation
    },
    extraInfo: {
      fundingTx,
      blindingFactor,
      walletPubKeyHash,
      refundPubKeyHash,
      refundLocktime,
    },
  }
}

const redemptionKey = (
  walletPubKeyHash: BytesLike,
  redeemerOutputScript: BytesLike
) => {
  const scriptHash = ethers.utils.solidityKeccak256(
    ["bytes"],
    [redeemerOutputScript]
  )

  return ethers.utils.solidityKeccak256(
    ["bytes32", "bytes20"],
    [scriptHash, walletPubKeyHash]
  )
}

const createTestRedemptionRequest = (
  walletPubKeyHash: string,
  txMaxFee?: BigNumberish,
  requestedAt?: number
) => {
  let resolvedRequestedAt = requestedAt

  if (!resolvedRequestedAt) {
    // If the request creation time is not explicitly set, use `now - 1 day` to
    // ensure request minimum age is achieved by default.
    const now = Math.floor(Date.now() / 1000)
    resolvedRequestedAt = now - day
  }

  const redeemer = `0x${crypto.randomBytes(20).toString("hex")}`

  const redeemerOutputScript = `0x${crypto.randomBytes(32).toString("hex")}`

  return {
    key: {
      walletPubKeyHash,
      redeemerOutputScript,
    },
    content: {
      redeemer,
      requestedAmount: 0, // not relevant
      treasuryFee: 0, // not relevant
      txMaxFee: txMaxFee ?? 0,
      requestedAt: resolvedRequestedAt,
    },
  }
}
