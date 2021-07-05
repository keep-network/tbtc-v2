const { to1e18 } = require("../helpers/contract-test-helpers")

const { expect } = require("chai")

describe("MisfundRecovery", () => {
  let recoveryOwner
  let thirdParty

  let randomERC20
  let randomERC721

  let recovery

  beforeEach(async () => {
    ;[deployer, recoveryOwner, thirdParty] = await ethers.getSigners()

    const MisfundRecovery = await ethers.getContractFactory("MisfundRecovery")
    recovery = await MisfundRecovery.deploy()
    await recovery.deployed()

    const TestERC20 = await ethers.getContractFactory("TestERC20")
    randomERC20 = await TestERC20.deploy()
    await randomERC20.deployed()

    const TestERC721 = await ethers.getContractFactory("TestERC721")
    randomERC721 = await TestERC721.deploy()
    await randomERC721.deployed()

    await recovery.connect(deployer).transferOwnership(recoveryOwner.address)
  })

  describe("recoverERC20", () => {
    const amount = to1e18(725)

    beforeEach(async () => {
      await randomERC20.mint(recovery.address, amount)
    })

    context("when called not by the owner", () => {
      it("reverts", async () => {
        await expect(
          recovery
            .connect(thirdParty)
            .recoverERC20(randomERC20.address, thirdParty.address, amount)
        ).to.be.revertedWith("Ownable: caller is not the owner")
      })
    })

    context("when called by the owner", () => {
      it("transfers tokens to the recipient", async () => {
        await recovery
          .connect(recoveryOwner)
          .recoverERC20(randomERC20.address, thirdParty.address, amount)
        expect(await randomERC20.balanceOf(thirdParty.address)).to.equal(amount)
      })
    })
  })

  describe("recoverERC721", () => {
    const tokenId = 19112

    beforeEach(async () => {
      await randomERC721.mint(recovery.address, tokenId)
    })

    context("when called not by the owner", () => {
      it("reverts", async () => {
        await expect(
          recovery.recoverERC721(
            randomERC721.address,
            thirdParty.address,
            tokenId,
            []
          )
        ).to.be.revertedWith("Ownable: caller is not the owner")
      })
    })

    context("when called by the owner", () => {
      it("transfers token to the recipient", async () => {
        await recovery
          .connect(recoveryOwner)
          .recoverERC721(randomERC721.address, thirdParty.address, tokenId, [])
        expect(await randomERC721.ownerOf(tokenId)).to.equal(thirdParty.address)
      })
    })
  })
})
