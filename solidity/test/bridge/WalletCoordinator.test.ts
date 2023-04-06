import crypto from "crypto"
import { ethers, helpers } from "hardhat"
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
import { walletState } from "../fixtures"

chai.use(smock.matchers)

const { lastBlockTime, increaseTime } = helpers.time
const { createSnapshot, restoreSnapshot } = helpers.snapshot
const { AddressZero, HashZero } = ethers.constants

const day = 86400
const depositLocktime = 30 * day

const emptyWalletMemberContext = {
  walletMembersIDs: [],
  walletMemberIndex: 0,
}

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
  let reimbursementPool: FakeContract<ReimbursementPool>

  let walletCoordinator: WalletCoordinator

  before(async () => {
    // eslint-disable-next-line @typescript-eslint/no-extra-semi
    ;[owner, thirdParty] = await helpers.signers.getUnnamedSigners()

    walletRegistry = await smock.fake<IWalletRegistry>("IWalletRegistry")
    reimbursementPool = await smock.fake<ReimbursementPool>("ReimbursementPool")

    bridge = await smock.fake<Bridge>("Bridge")

    bridge.contractReferences.returns([
      AddressZero,
      AddressZero,
      walletRegistry.address,
      reimbursementPool.address,
    ])

    const WalletCoordinator = await ethers.getContractFactory(
      "WalletCoordinator"
    )

    walletCoordinator = await WalletCoordinator.deploy()

    await walletCoordinator.initialize(bridge.address)
  })

  describe("addProposalSubmitter", () => {
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
            .addProposalSubmitter(thirdParty.address)
        ).to.be.revertedWith("Ownable: caller is not the owner")
      })
    })

    context("when called by the owner", () => {
      context("when the proposal submitter already exists", () => {
        before(async () => {
          await createSnapshot()

          await walletCoordinator
            .connect(owner)
            .addProposalSubmitter(thirdParty.address)
        })

        after(async () => {
          await restoreSnapshot()
        })

        it("should revert", async () => {
          await expect(
            walletCoordinator
              .connect(owner)
              .addProposalSubmitter(thirdParty.address)
          ).to.be.revertedWith("This address is already a proposal submitter")
        })
      })

      context("when the proposal submitter does not exist yet", () => {
        let tx: ContractTransaction

        before(async () => {
          await createSnapshot()

          tx = await walletCoordinator
            .connect(owner)
            .addProposalSubmitter(thirdParty.address)
        })

        after(async () => {
          await restoreSnapshot()
        })

        it("should add the new proposal submitter", async () => {
          // eslint-disable-next-line @typescript-eslint/no-unused-expressions
          expect(
            await walletCoordinator.isProposalSubmitter(thirdParty.address)
          ).to.be.true
        })

        it("should emit the ProposalSubmitterAdded event", async () => {
          await expect(tx)
            .to.emit(walletCoordinator, "ProposalSubmitterAdded")
            .withArgs(thirdParty.address)
        })
      })
    })
  })

  describe("removeProposalSubmitter", () => {
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
            .removeProposalSubmitter(thirdParty.address)
        ).to.be.revertedWith("Ownable: caller is not the owner")
      })
    })

    context("when called by the owner", () => {
      context("when the proposal submitter does not exist", () => {
        it("should revert", async () => {
          await expect(
            walletCoordinator
              .connect(owner)
              .removeProposalSubmitter(thirdParty.address)
          ).to.be.revertedWith("This address is not a proposal submitter")
        })
      })

      context("when the proposal submitter exists", () => {
        let tx: ContractTransaction

        before(async () => {
          await createSnapshot()

          await walletCoordinator
            .connect(owner)
            .addProposalSubmitter(thirdParty.address)

          tx = await walletCoordinator
            .connect(owner)
            .removeProposalSubmitter(thirdParty.address)
        })

        after(async () => {
          await restoreSnapshot()
        })

        it("should remove the proposal submitter", async () => {
          // eslint-disable-next-line @typescript-eslint/no-unused-expressions
          expect(
            await walletCoordinator.isProposalSubmitter(thirdParty.address)
          ).to.be.false
        })

        it("should emit the ProposalSubmitterRemoved event", async () => {
          await expect(tx)
            .to.emit(walletCoordinator, "ProposalSubmitterRemoved")
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
          .addProposalSubmitter(thirdParty.address)

        // Submit a proposal to set a wallet time lock.
        await walletCoordinator.connect(thirdParty).submitDepositSweepProposal(
          {
            walletPubKeyHash,
            depositsKeys: [
              {
                fundingTxHash:
                  "0x51f373dcbb6122bcb1c62964b5f3be923092dc64bc9e31257931d58c4eadb9f5",
                fundingOutputIndex: 0,
              },
            ],
            sweepTxFee: 5000,
          },
          emptyWalletMemberContext
        )

        tx = await walletCoordinator
          .connect(owner)
          .unlockWallet(walletPubKeyHash)
      })

      after(async () => {
        await restoreSnapshot()
      })

      it("should unlock the wallet", async () => {
        expect(
          await walletCoordinator.walletLock(walletPubKeyHash)
        ).to.be.equal(0)
      })

      it("should emit the WalletManuallyUnlocked event", async () => {
        await expect(tx)
          .to.emit(walletCoordinator, "WalletManuallyUnlocked")
          .withArgs(walletPubKeyHash)
      })
    })
  })

  describe("updateDepositSweepProposalValidity", () => {
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
            .updateDepositSweepProposalValidity(120)
        ).to.be.revertedWith("Ownable: caller is not the owner")
      })
    })

    context("when called by the owner", () => {
      let tx: ContractTransaction

      before(async () => {
        await createSnapshot()

        tx = await walletCoordinator
          .connect(owner)
          .updateDepositSweepProposalValidity(120)
      })

      after(async () => {
        await restoreSnapshot()
      })

      it("should update the parameter", async () => {
        expect(
          await walletCoordinator.depositSweepProposalValidity()
        ).to.be.equal(120)
      })

      it("should emit the DepositSweepProposalValidityUpdated event", async () => {
        await expect(tx)
          .to.emit(walletCoordinator, "DepositSweepProposalValidityUpdated")
          .withArgs(120)
      })
    })
  })

  describe("updateDepositMinAge", () => {
    before(async () => {
      await createSnapshot()
    })

    after(async () => {
      await restoreSnapshot()
    })

    context("when called by a third party", () => {
      it("should revert", async () => {
        await expect(
          walletCoordinator.connect(thirdParty).updateDepositMinAge(140)
        ).to.be.revertedWith("Ownable: caller is not the owner")
      })
    })

    context("when called by the owner", () => {
      let tx: ContractTransaction

      before(async () => {
        await createSnapshot()

        tx = await walletCoordinator.connect(owner).updateDepositMinAge(140)
      })

      after(async () => {
        await restoreSnapshot()
      })

      it("should update the parameter", async () => {
        expect(await walletCoordinator.depositMinAge()).to.be.equal(140)
      })

      it("should emit the DepositMinAgeUpdated event", async () => {
        await expect(tx)
          .to.emit(walletCoordinator, "DepositMinAgeUpdated")
          .withArgs(140)
      })
    })
  })

  describe("updateDepositRefundSafetyMargin", () => {
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
            .updateDepositRefundSafetyMargin(160)
        ).to.be.revertedWith("Ownable: caller is not the owner")
      })
    })

    context("when called by the owner", () => {
      let tx: ContractTransaction

      before(async () => {
        await createSnapshot()

        tx = await walletCoordinator
          .connect(owner)
          .updateDepositRefundSafetyMargin(160)
      })

      after(async () => {
        await restoreSnapshot()
      })

      it("should update the parameter", async () => {
        expect(await walletCoordinator.depositRefundSafetyMargin()).to.be.equal(
          160
        )
      })

      it("should emit the DepositRefundSafetyMarginUpdated event", async () => {
        await expect(tx)
          .to.emit(walletCoordinator, "DepositRefundSafetyMarginUpdated")
          .withArgs(160)
      })
    })
  })

  describe("updateDepositSweepMaxSize", () => {
    before(async () => {
      await createSnapshot()
    })

    after(async () => {
      await restoreSnapshot()
    })

    context("when called by a third party", () => {
      it("should revert", async () => {
        await expect(
          walletCoordinator.connect(thirdParty).updateDepositSweepMaxSize(15)
        ).to.be.revertedWith("Ownable: caller is not the owner")
      })
    })

    context("when called by the owner", () => {
      let tx: ContractTransaction

      before(async () => {
        await createSnapshot()

        tx = await walletCoordinator
          .connect(owner)
          .updateDepositSweepMaxSize(15)
      })

      after(async () => {
        await restoreSnapshot()
      })

      it("should update the parameter", async () => {
        expect(await walletCoordinator.depositSweepMaxSize()).to.be.equal(15)
      })

      it("should emit the DepositSweepMaxSizeUpdated event", async () => {
        await expect(tx)
          .to.emit(walletCoordinator, "DepositSweepMaxSizeUpdated")
          .withArgs(15)
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

  describe("submitDepositSweepProposal", () => {
    const walletPubKeyHash = "0x7ac2d9378a1c47e589dfb8095ca95ed2140d2726"
    const ecdsaWalletID =
      "0x4ad6b3ccbca81645865d8d0d575797a15528e98ced22f29a6f906d3259569863"
    const walletMembersIDs = [1, 3, 10, 22, 5]

    before(async () => {
      await createSnapshot()
    })

    after(async () => {
      await restoreSnapshot()
    })

    context(
      "when the caller is neither a proposal submitter nor a wallet member",
      () => {
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

          walletRegistry.isWalletMember
            .whenCalledWith(
              ecdsaWalletID,
              walletMembersIDs,
              thirdParty.address,
              1
            )
            .returns(false)
        })

        after(async () => {
          bridge.wallets.reset()
          walletRegistry.isWalletMember.reset()

          await restoreSnapshot()
        })

        it("should revert", async () => {
          const tx = walletCoordinator
            .connect(thirdParty)
            .submitDepositSweepProposal(
              {
                walletPubKeyHash,
                depositsKeys: [
                  {
                    fundingTxHash:
                      "0x51f373dcbb6122bcb1c62964b5f3be923092dc64bc9e31257931d58c4eadb9f5",
                    fundingOutputIndex: 0,
                  },
                ],
                sweepTxFee: 5000,
              },
              {
                walletMembersIDs,
                walletMemberIndex: 1,
              }
            )

          await expect(tx).to.be.revertedWith(
            "Caller is neither a proposal submitter nor a wallet member"
          )
        })
      }
    )

    context(
      "when the caller is a proposal submitter or a wallet member",
      () => {
        context("when the caller is a proposal submitter", () => {
          before(async () => {
            await createSnapshot()

            await walletCoordinator
              .connect(owner)
              .addProposalSubmitter(thirdParty.address)
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
                .submitDepositSweepProposal(
                  {
                    walletPubKeyHash,
                    depositsKeys: [
                      {
                        fundingTxHash:
                          "0x51f373dcbb6122bcb1c62964b5f3be923092dc64bc9e31257931d58c4eadb9f5",
                        fundingOutputIndex: 0,
                      },
                    ],
                    sweepTxFee: 5000,
                  },
                  emptyWalletMemberContext
                )

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
                walletCoordinator
                  .connect(thirdParty)
                  .submitDepositSweepProposal(
                    {
                      walletPubKeyHash,
                      depositsKeys: [
                        {
                          fundingTxHash:
                            "0x51f373dcbb6122bcb1c62964b5f3be923092dc64bc9e31257931d58c4eadb9f5",
                          fundingOutputIndex: 1,
                        },
                      ],
                      sweepTxFee: 5000,
                    },
                    emptyWalletMemberContext
                  )
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
                .submitDepositSweepProposal(
                  {
                    walletPubKeyHash,
                    depositsKeys: [
                      {
                        fundingTxHash:
                          "0x51f373dcbb6122bcb1c62964b5f3be923092dc64bc9e31257931d58c4eadb9f5",
                        fundingOutputIndex: 0,
                      },
                    ],
                    sweepTxFee: 5000,
                  },
                  emptyWalletMemberContext
                )

              // Jump beyond the lock period.
              await increaseTime(
                await walletCoordinator.depositSweepProposalValidity()
              )

              tx = await walletCoordinator
                .connect(thirdParty)
                .submitDepositSweepProposal(
                  {
                    walletPubKeyHash,
                    depositsKeys: [
                      {
                        fundingTxHash:
                          "0x51f373dcbb6122bcb1c62964b5f3be923092dc64bc9e31257931d58c4eadb9f5",
                        fundingOutputIndex: 1,
                      },
                    ],
                    sweepTxFee: 5000,
                  },
                  emptyWalletMemberContext
                )
            })

            after(async () => {
              await restoreSnapshot()
            })

            it("should time lock the wallet", async () => {
              const lockedUntil =
                (await lastBlockTime()) +
                (await walletCoordinator.depositSweepProposalValidity())

              expect(
                await walletCoordinator.walletLock(walletPubKeyHash)
              ).to.be.equal(lockedUntil)
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
              const receipt = await ethers.provider.getTransactionReceipt(
                tx.hash
              )
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
                ],
                thirdParty.address,
              ])
            })
          })
        })

        // Here we just check that a wallet member not registered as an
        // explicit proposal submitter can actually propose a sweep. Detailed
        // assertions are already done within the previous scenario called
        // `when the caller is a proposal submitter`.
        context("when the caller is a wallet member", () => {
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

            walletRegistry.isWalletMember
              .whenCalledWith(
                ecdsaWalletID,
                walletMembersIDs,
                thirdParty.address,
                1
              )
              .returns(true)
          })

          after(async () => {
            bridge.wallets.reset()
            walletRegistry.isWalletMember.reset()

            await restoreSnapshot()
          })

          it("should succeed", async () => {
            const tx = walletCoordinator
              .connect(thirdParty)
              .submitDepositSweepProposal(
                {
                  walletPubKeyHash,
                  depositsKeys: [
                    {
                      fundingTxHash:
                        "0x51f373dcbb6122bcb1c62964b5f3be923092dc64bc9e31257931d58c4eadb9f5",
                      fundingOutputIndex: 0,
                    },
                  ],
                  sweepTxFee: 5000,
                },
                {
                  walletMembersIDs,
                  walletMemberIndex: 1,
                }
              )

            await expect(tx).to.not.be.reverted
          })
        })
      }
    )
  })

  describe("submitDepositSweepProposalWithReimbursement", () => {
    const walletPubKeyHash = "0x7ac2d9378a1c47e589dfb8095ca95ed2140d2726"
    const ecdsaWalletID =
      "0x4ad6b3ccbca81645865d8d0d575797a15528e98ced22f29a6f906d3259569863"
    const walletMembersIDs = [1, 3, 10, 22, 5]

    before(async () => {
      await createSnapshot()
    })

    after(async () => {
      await restoreSnapshot()
    })

    // Just double check that `submitDepositSweepProposalWithReimbursement` has
    // the same ACL as `submitDepositSweepProposal`.
    context(
      "when the caller is neither a proposal submitter nor a wallet member",
      () => {
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

          walletRegistry.isWalletMember
            .whenCalledWith(
              ecdsaWalletID,
              walletMembersIDs,
              thirdParty.address,
              1
            )
            .returns(false)
        })

        after(async () => {
          bridge.wallets.reset()
          walletRegistry.isWalletMember.reset()

          await restoreSnapshot()
        })

        it("should revert", async () => {
          const tx = walletCoordinator
            .connect(thirdParty)
            .submitDepositSweepProposalWithReimbursement(
              {
                walletPubKeyHash,
                depositsKeys: [
                  {
                    fundingTxHash:
                      "0x51f373dcbb6122bcb1c62964b5f3be923092dc64bc9e31257931d58c4eadb9f5",
                    fundingOutputIndex: 0,
                  },
                ],
                sweepTxFee: 5000,
              },
              {
                walletMembersIDs,
                walletMemberIndex: 1,
              }
            )

          await expect(tx).to.be.revertedWith(
            "Caller is neither a proposal submitter nor a wallet member"
          )
        })
      }
    )

    // Here we just check that the reimbursement works. Detailed
    // assertions are already done within the scenario stressing the
    // `submitDepositSweepProposal` function.
    context(
      "when the caller is a proposal submitter or a wallet member",
      () => {
        before(async () => {
          await createSnapshot()

          reimbursementPool.refund.returns()

          await walletCoordinator
            .connect(owner)
            .addProposalSubmitter(thirdParty.address)

          await walletCoordinator
            .connect(thirdParty)
            .submitDepositSweepProposalWithReimbursement(
              {
                walletPubKeyHash,
                depositsKeys: [
                  {
                    fundingTxHash:
                      "0x51f373dcbb6122bcb1c62964b5f3be923092dc64bc9e31257931d58c4eadb9f5",
                    fundingOutputIndex: 0,
                  },
                ],
                sweepTxFee: 5000,
              },
              emptyWalletMemberContext
            )
        })

        after(async () => {
          reimbursementPool.refund.reset()

          await restoreSnapshot()
        })

        it("should do the refund", async () => {
          // eslint-disable-next-line @typescript-eslint/no-unused-expressions
          expect(reimbursementPool.refund).to.have.been.calledOnce

          expect(reimbursementPool.refund.getCall(0).args[0]).to.be.closeTo(
            BigNumber.from(32000),
            2000
          )

          expect(reimbursementPool.refund.getCall(0).args[1]).to.be.equal(
            thirdParty.address
          )
        })
      }
    )
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
                            ).to.be.revertedWith("Invalid deposit extra data")
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
                              ).to.be.revertedWith("Invalid deposit extra data")
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
                              ).to.be.revertedWith("Invalid deposit extra data")
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
                                    ).to.not.be.reverted
                                  })
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
