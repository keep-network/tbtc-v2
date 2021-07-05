const { expect } = require("chai")
const { to1e18, ZERO_ADDRESS } = require("../helpers/contract-test-helpers")

describe("TBTCToken", () => {
  let approver

  let approvalReceiver
  let tbtc

  beforeEach(async () => {
    approver = await ethers.getSigner(1)

    const ReceiveApprovalStub = await ethers.getContractFactory(
      "ReceiveApprovalStub"
    )
    approvalReceiver = await ReceiveApprovalStub.deploy()
    await approvalReceiver.deployed()

    const TBTCToken = await ethers.getContractFactory("TBTCToken")
    tbtc = await TBTCToken.deploy()
    await tbtc.deployed()

    tbtc.mint(approver.address, to1e18(1000000))
  })

  describe("approveAndCall", () => {
    const amount = to1e18(200)

    context("when approval fails", () => {
      it("should revert", async () => {
        await expect(
          tbtc.connect(approver).approveAndCall(ZERO_ADDRESS, amount, [])
        ).to.be.reverted
      })
    })

    context("when receiveApproval fails", () => {
      beforeEach(async () => {
        await approvalReceiver.setShouldRevert(true)
      })

      it("should revert", async () => {
        await expect(
          tbtc
            .connect(approver)
            .approveAndCall(approvalReceiver.address, amount, [])
        ).to.be.revertedWith("i am your father luke")
      })
    })

    it("approves the provided amount for transfer", async () => {
      await tbtc
        .connect(approver)
        .approveAndCall(approvalReceiver.address, amount, [])
      expect(
        await tbtc.allowance(approver.address, approvalReceiver.address)
      ).to.equal(amount)
    })

    it("calls approveAndCall with the provided parameters", async () => {
      const tx = await tbtc
        .connect(approver)
        .approveAndCall(approvalReceiver.address, amount, "0xbeef")
      await expect(tx)
        .to.emit(approvalReceiver, "ApprovalReceived")
        .withArgs(approver.address, amount, tbtc.address, "0xbeef")
    })
  })
})
