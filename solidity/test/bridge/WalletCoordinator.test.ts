import { ethers, helpers } from "hardhat"
import chai, { expect } from "chai"
import { FakeContract, smock } from "@defi-wonderland/smock"
import { SignerWithAddress } from "@nomiclabs/hardhat-ethers/signers"
import { BigNumberish, ContractTransaction } from "ethers"
import type {
  WalletCoordinator,
  Bridge,
  ReimbursementPool,
  IWalletRegistry,
} from "../../typechain"

chai.use(smock.matchers)

const { createSnapshot, restoreSnapshot } = helpers.snapshot
const { AddressZero } = ethers.constants

const emptyWalletMemberContext = {
  walletMembersIDs: [],
  walletMemberIndex: 0,
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

    bridge = await smock.fake<Bridge>("Bridge")

    bridge.contractReferences.returns([
      AddressZero,
      AddressZero,
      walletRegistry.address,
      AddressZero,
    ])

    reimbursementPool = await smock.fake<ReimbursementPool>("ReimbursementPool")

    const WalletCoordinator = await ethers.getContractFactory(
      "WalletCoordinator"
    )

    walletCoordinator = await WalletCoordinator.deploy()

    await walletCoordinator.initialize(
      bridge.address,
      reimbursementPool.address
    )
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
})
