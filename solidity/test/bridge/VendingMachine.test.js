const { expect } = require("chai")
const {
  increaseTime,
  lastBlockTime,
  to1e18,
} = require("../helpers/contract-test-helpers")

describe("VendingMachine", () => {
  let tbtcV1
  let tbtcV2
  let vendingMachine

  let governance
  let v1Owner
  let thirdParty

  const unmintFee = 10
  const initialBalance = to1e18(5) // 5 TBTC v1

  beforeEach(async () => {
    ;[governance, v1Owner, thirdParty] = await ethers.getSigners()

    const TestERC20 = await ethers.getContractFactory("TestERC20")
    tbtcV1 = await TestERC20.deploy()
    await tbtcV1.deployed()

    const TBTCToken = await ethers.getContractFactory("TBTCToken")
    tbtcV2 = await TBTCToken.deploy()
    await tbtcV2.deployed()

    await tbtcV1.mint(v1Owner.address, initialBalance)

    const VendingMachine = await ethers.getContractFactory("VendingMachine")
    vendingMachine = await VendingMachine.deploy(
      tbtcV1.address,
      tbtcV2.address,
      unmintFee
    )
    await vendingMachine.deployed()

    await tbtcV2.connect(governance).transferOwnership(vendingMachine.address)
    await tbtcV1
      .connect(v1Owner)
      .approve(vendingMachine.address, initialBalance)
  })

  describe("deposit", () => {
    describe("when TBTC v1 owner has not enough tokens", () => {
      it("should revert", async () => {
        const amount = initialBalance.add(1)
        await tbtcV1.connect(v1Owner).approve(vendingMachine.address, amount)
        await expect(
          vendingMachine.connect(v1Owner).mint(amount)
        ).to.be.revertedWith("Transfer amount exceeds balance")
      })
    })

    describe("when TBTC v1 owner has enough tokens", () => {
      let tx

      beforeEach(async () => {
        tx = await vendingMachine.connect(v1Owner).mint(initialBalance)
      })

      it("should mint the same amount of TBTC v2", async () => {
        expect(await tbtcV2.balanceOf(v1Owner.address)).is.equal(initialBalance)
      })

      it("should transfer TBTC v1 tokens the VendingMachine", async () => {
        expect(await tbtcV1.balanceOf(vendingMachine.address)).is.equal(
          initialBalance
        )
      })

      it("should emit Minted event", async () => {
        await expect(tx)
          .to.emit(vendingMachine, "Minted")
          .withArgs(v1Owner.address, initialBalance)
      })
    })
  })

  describe("receiveApproval", () => {
    context("when called directly", () => {
      it("should revert", async () => {
        await expect(
          vendingMachine
            .connect(v1Owner)
            .receiveApproval(
              v1Owner.address,
              initialBalance,
              tbtcV1.address,
              []
            )
        ).to.be.revertedWith("Only TBTC v1 caller allowed")
      })
    })

    context("when called not for TBTC v1 token", () => {
      it("should revert", async () => {
        await expect(
          vendingMachine
            .connect(v1Owner)
            .receiveApproval(
              v1Owner.address,
              initialBalance,
              tbtcV2.address,
              []
            )
        ).to.be.revertedWith("Token is not TBTC v1")
      })
    })

    context("when called via approveAndCall", () => {
      let tx

      beforeEach(async () => {
        tx = await tbtcV1
          .connect(v1Owner)
          .approveAndCall(vendingMachine.address, initialBalance, [])
      })

      it("should mint TBTC v2 to the caller", async () => {
        expect(await tbtcV2.balanceOf(v1Owner.address)).is.equal(initialBalance)
      })

      it("should transfer TBTC v1 tokens the VendingMachine", async () => {
        expect(await tbtcV1.balanceOf(vendingMachine.address)).is.equal(
          initialBalance
        )
      })

      it("should emit Minted event", async () => {
        await expect(tx)
          .to.emit(vendingMachine, "Minted")
          .withArgs(v1Owner.address, initialBalance)
      })
    })
  })

  describe("beginUnmintFeeUpdate", () => {
    context("when caller is not the owner", () => {
      it("should revert", async () => {
        await expect(
          vendingMachine.connect(thirdParty).beginUnmintFeeUpdate(1)
        ).to.be.revertedWith("Ownable: caller is not the owner")
      })
    })

    context("when caller is the owner", () => {
      const newUnmintFee = 191111

      let tx

      beforeEach(async () => {
        tx = await vendingMachine
          .connect(governance)
          .beginUnmintFeeUpdate(newUnmintFee)
      })

      it("should not update the unmint fee", async () => {
        expect(await vendingMachine.unmintFee()).to.equal(unmintFee)
      })

      it("should start the governance delay timer", async () => {
        expect(await vendingMachine.getRemainingUnmintFeeUpdateTime()).to.equal(
          43200 // 12h contract governance delay
        )
      })

      it("should emit the UnmintFeeUpdateStarted event", async () => {
        await expect(tx)
          .to.emit(vendingMachine, "UnmintFeeUpdateStarted")
          .withArgs(newUnmintFee, await lastBlockTime())
      })
    })
  })

  describe("finalizeUnmintFeeUpdate", () => {
    context("when caller is not the owner", () => {
      it("should revert", async () => {
        await expect(
          vendingMachine.connect(thirdParty).finalizeUnmintFeeUpdate()
        ).to.be.revertedWith("Ownable: caller is not the owner")
      })
    })

    context("when caller is the owner", () => {
      context("when update process it not initialized", () => {
        it("should revert", async () => {
          await expect(
            vendingMachine.connect(governance).finalizeUnmintFeeUpdate()
          ).to.be.revertedWith("Change not initiated")
        })
      })

      context("when update process is initialized", () => {
        const newUnmintFee = 151511

        beforeEach(async () => {
          await vendingMachine
            .connect(governance)
            .beginUnmintFeeUpdate(newUnmintFee)
        })

        context("when governance delay has not passed", () => {
          it("should revert", async () => {
            await increaseTime(39600) // +11h
            await expect(
              vendingMachine.connect(governance).finalizeUnmintFeeUpdate()
            ).to.be.revertedWith("Governance delay has not elapsed")
          })
        })

        context("when governance delay passed", () => {
          let tx

          beforeEach(async () => {
            await increaseTime(43200) // +12h contract governance delay
            tx = await vendingMachine
              .connect(governance)
              .finalizeUnmintFeeUpdate()
          })

          it("should update the unmint fee", async () => {
            expect(await vendingMachine.unmintFee()).to.equal(newUnmintFee)
          })

          it("should emit UnmintFeeUpdated event", async () => {
            await expect(tx)
              .to.emit(vendingMachine, "UnmintFeeUpdated")
              .withArgs(newUnmintFee)
          })

          it("should reset the governance delay timer", async () => {
            await expect(
              vendingMachine.getRemainingUnmintFeeUpdateTime()
            ).to.be.revertedWith("Change not initiated")
          })
        })
      })
    })
  })
})
