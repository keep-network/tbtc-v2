import { SignerWithAddress } from "@nomiclabs/hardhat-ethers/signers"
import { randomBytes, Sign } from "crypto"
import { ethers, getUnnamedAccounts, helpers, waffle } from "hardhat"
import { expect } from "chai"
import { ContractTransaction } from "ethers"
import { BigNumber } from "@ethersproject/bignumber"
import { to1e18 } from "../helpers/contract-test-helpers"

import type { L2TBTC } from "../../typechain"

const { createSnapshot, restoreSnapshot } = helpers.snapshot

const ZERO_ADDRESS = ethers.constants.AddressZero

describe("L2TBTC", () => {
  const fixture = async () => {
    const { deployer, governance } = await helpers.signers.getNamedSigners()

    const accounts = await getUnnamedAccounts()
    const minter = await ethers.getSigner(accounts[1])
    const thirdParty = await ethers.getSigner(accounts[2])
    const tokenHolder = await ethers.getSigner(accounts[3])

    const deployment = await helpers.upgrades.deployProxy(
      // Hacky workaround allowing to deploy proxy contract any number of times
      // without clearing `deployments/hardhat` directory.
      // See: https://github.com/keep-network/hardhat-helpers/issues/38
      `L2TBTC_${randomBytes(8).toString("hex")}`,
      {
        contractName: "L2TBTC",
        initializerArgs: ["ArbitrumTBTC", "ArbTBTC"],
        factoryOpts: { signer: deployer },
        proxyOpts: {
          kind: "transparent",
        },
      }
    )
    token = deployment[0] as L2TBTC

    await token.connect(deployer).transferOwnership(governance.address)

    return {
      governance,
      minter,
      thirdParty,
      tokenHolder,
      token,
    }
  }

  let token: L2TBTC

  let governance: SignerWithAddress
  let minter: SignerWithAddress
  let thirdParty: SignerWithAddress
  let tokenHolder: SignerWithAddress

  before(async () => {
    // eslint-disable-next-line @typescript-eslint/no-extra-semi
    ;({ governance, minter, thirdParty, tokenHolder, token } =
      await waffle.loadFixture(fixture))
  })

  describe("addMinter", () => {
    context("when called not by the owner", () => {
      it("should revert", async () => {
        await expect(
          token.connect(thirdParty).addMinter(thirdParty.address)
        ).to.be.revertedWith("Ownable: caller is not the owner")
      })
    })

    context("when called by the owner", () => {
      context("when address is not a minter", () => {
        let tx: ContractTransaction

        before(async () => {
          await createSnapshot()

          tx = await token.connect(governance).addMinter(minter.address)
        })

        after(async () => {
          await restoreSnapshot()
        })

        it("should add address as a minter", async () => {
          // eslint-disable-next-line @typescript-eslint/no-unused-expressions
          expect(await token.isMinter(minter.address)).to.be.true
        })

        it("should emit an event", async () => {
          await expect(tx)
            .to.emit(token, "MinterAdded")
            .withArgs(minter.address)
        })
      })

      context("when address is a minter", () => {
        before(async () => {
          await createSnapshot()

          await token.connect(governance).addMinter(minter.address)
        })

        after(async () => {
          await restoreSnapshot()
        })

        it("should revert", async () => {
          await expect(
            token.connect(governance).addMinter(minter.address)
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

          await token.connect(governance).addMinter(minters[0])
          await token.connect(governance).addMinter(minters[1])
          await token.connect(governance).addMinter(minters[2])
        })

        after(async () => {
          await restoreSnapshot()
        })

        it("should add them into the list", async () => {
          expect(await token.getMinters()).to.deep.equal(minters)
        })
      })
    })
  })

  describe("removeMinter", () => {
    context("when called not by the owner", () => {
      it("should revert", async () => {
        await expect(
          token.connect(thirdParty).removeMinter(minter.address)
        ).to.be.revertedWith("Ownable: caller is not the owner")
      })
    })

    context("when called by the owner", () => {
      context("when address is not a minter", () => {
        it("should revert", async () => {
          await expect(
            token.connect(governance).removeMinter(thirdParty.address)
          ).to.be.revertedWith("This address is not a minter")
        })
      })

      context("when address is a minter", () => {
        let tx: ContractTransaction

        before(async () => {
          await createSnapshot()

          await token.connect(governance).addMinter(minter.address)
          tx = await token.connect(governance).removeMinter(minter.address)
        })

        after(async () => {
          await restoreSnapshot()
        })

        it("should take minter role from the address", async () => {
          // eslint-disable-next-line @typescript-eslint/no-unused-expressions
          expect(await token.isMinter(minter.address)).to.be.false
        })

        it("should emit an event", async () => {
          await expect(tx)
            .to.emit(token, "MinterRemoved")
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

          await token.connect(governance).addMinter(minters[0])
          await token.connect(governance).addMinter(minters[1])
          await token.connect(governance).addMinter(minters[2])
          await token.connect(governance).addMinter(minters[3])
        })

        after(async () => {
          await restoreSnapshot()
        })

        context("when deleting the first minter", () => {
          before(async () => {
            await createSnapshot()
            await token.connect(governance).removeMinter(minters[0])
          })

          after(async () => {
            await restoreSnapshot()
          })

          it("should update the minters list", async () => {
            expect(await token.getMinters()).to.deep.equal([
              "0xF844A3a4dA34fDDf51A0Ec7A0a89d1ed5A105e40",
              "0x575E6d8802e7b6A7E8F940640804385D8Bbe2ce0",
              "0x66ac131D339704902aECCaBDf55e15daAE8B238f",
            ])
          })
        })

        context("when deleting the last minter", () => {
          before(async () => {
            await createSnapshot()
            await token.connect(governance).removeMinter(minters[3])
          })

          after(async () => {
            await restoreSnapshot()
          })

          it("should update the minters list", async () => {
            expect(await token.getMinters()).to.deep.equal([
              "0x54DeA8194aaF652Cd296B162A2809dd95529f775",
              "0x575E6d8802e7b6A7E8F940640804385D8Bbe2ce0",
              "0x66ac131D339704902aECCaBDf55e15daAE8B238f",
            ])
          })
        })

        context("when deleting minter from the middle of the list", () => {
          before(async () => {
            await createSnapshot()
            await token.connect(governance).removeMinter(minters[1])
          })

          after(async () => {
            await restoreSnapshot()
          })

          it("should update the minters list", async () => {
            expect(await token.getMinters()).to.deep.equal([
              "0x54DeA8194aaF652Cd296B162A2809dd95529f775",
              "0xF844A3a4dA34fDDf51A0Ec7A0a89d1ed5A105e40",
              "0x66ac131D339704902aECCaBDf55e15daAE8B238f",
            ])
          })
        })
      })
    })
  })

  describe("mint", () => {
    const amount = to1e18(50)

    before(async () => {
      await createSnapshot()
      await token.connect(governance).addMinter(minter.address)
    })

    after(async () => {
      await restoreSnapshot()
    })

    context("when called not by a minter", () => {
      it("should revert", async () => {
        await expect(
          token.connect(thirdParty).mint(thirdParty.address, amount)
        ).to.be.revertedWith("Caller is not a minter")
      })
    })

    context("when called by a minter", () => {
      context("for a zero account", () => {
        it("should revert", async () => {
          await expect(
            token.connect(minter).mint(ZERO_ADDRESS, amount)
          ).to.be.revertedWith("ERC20: mint to the zero address")
        })
      })

      context("for a non-zero account", () => {
        let mintTx: ContractTransaction

        before(async () => {
          await createSnapshot()
          mintTx = await token.connect(minter).mint(tokenHolder.address, amount)
        })

        after(async () => {
          await restoreSnapshot()
        })

        it("should increment totalSupply", async () => {
          expect(await token.totalSupply()).to.equal(amount)
        })

        it("should increment recipient balance", async () => {
          expect(await token.balanceOf(tokenHolder.address)).to.equal(amount)
        })

        it("should emit Transfer event", async () => {
          await expect(mintTx)
            .to.emit(token, "Transfer")
            .withArgs(ZERO_ADDRESS, tokenHolder.address, amount)
        })
      })
    })
  })

  describe("burn", () => {
    const initialSupply = to1e18(36)
    const initialBalance = to1e18(18)

    before(async () => {
      await createSnapshot()
      await token.connect(governance).addMinter(minter.address)
      await token.connect(minter).mint(tokenHolder.address, initialBalance)
      await token.connect(minter).mint(thirdParty.address, initialBalance)
    })

    after(async () => {
      await restoreSnapshot()
    })

    context("when burning more than balance", () => {
      it("should revert", async () => {
        await expect(
          token.connect(tokenHolder).burn(initialBalance.add(1))
        ).to.be.revertedWith("ERC20: burn amount exceeds balance")
      })
    })

    const describeBurn = (description: string, amount: BigNumber) => {
      describe(description, () => {
        let burnTx: ContractTransaction

        before(async () => {
          await createSnapshot()
          burnTx = await token.connect(tokenHolder).burn(amount)
        })

        after(async () => {
          await restoreSnapshot()
        })

        it("should decrement totalSupply", async () => {
          const expectedSupply = initialSupply.sub(amount)
          expect(await token.totalSupply()).to.equal(expectedSupply)
        })

        it("should decrement account's balance", async () => {
          const expectedBalance = initialBalance.sub(amount)
          expect(await token.balanceOf(tokenHolder.address)).to.equal(
            expectedBalance
          )
        })

        it("should emit Transfer event", async () => {
          await expect(burnTx)
            .to.emit(token, "Transfer")
            .withArgs(tokenHolder.address, ZERO_ADDRESS, amount)
        })
      })
    }

    describeBurn("for the entire balance", initialBalance)
    describeBurn("for less than the entire balance", initialBalance.sub(1))
  })

  describe("burnFrom", () => {
    const initialSupply = to1e18(36)
    const initialBalance = to1e18(18)

    before(async () => {
      await createSnapshot()
      await token.connect(governance).addMinter(minter.address)
      await token.connect(minter).mint(tokenHolder.address, initialBalance)
      await token.connect(minter).mint(thirdParty.address, initialBalance)
    })

    after(async () => {
      await restoreSnapshot()
    })

    context("when burning more than the balance", () => {
      it("should revert", async () => {
        await token
          .connect(tokenHolder)
          .approve(thirdParty.address, initialBalance.add(1))
        await expect(
          token
            .connect(thirdParty)
            .burnFrom(tokenHolder.address, initialBalance.add(1))
        ).to.be.revertedWith("ERC20: burn amount exceeds balance")
      })
    })

    context("when burning more than the allowance", () => {
      it("should revert", async () => {
        await token
          .connect(tokenHolder)
          .approve(thirdParty.address, initialBalance.sub(1))
        await expect(
          token
            .connect(thirdParty)
            .burnFrom(tokenHolder.address, initialBalance)
        ).to.be.revertedWith("ERC20: insufficient allowance")
      })
    })

    const describeBurnFrom = (description: string, amount: BigNumber) => {
      describe(description, () => {
        let burnTx: ContractTransaction

        before(async () => {
          await createSnapshot()
          await token.connect(tokenHolder).approve(thirdParty.address, amount)
          burnTx = await token
            .connect(thirdParty)
            .burnFrom(tokenHolder.address, amount)
        })

        after(async () => {
          await restoreSnapshot()
        })

        it("should decrement totalSupply", async () => {
          const expectedSupply = initialSupply.sub(amount)
          expect(await token.totalSupply()).to.equal(expectedSupply)
        })

        it("should decrement account's balance", async () => {
          const expectedBalance = initialBalance.sub(amount)
          expect(await token.balanceOf(tokenHolder.address)).to.equal(
            expectedBalance
          )
        })

        it("should decrement allowance", async () => {
          const allowance = await token.allowance(
            tokenHolder.address,
            thirdParty.address
          )

          expect(allowance).to.equal(0)
        })

        it("should emit Transfer event", async () => {
          await expect(burnTx)
            .to.emit(token, "Transfer")
            .withArgs(tokenHolder.address, ZERO_ADDRESS, amount)
        })
      })
    }

    describeBurnFrom("for the entire balance", initialBalance)
    describeBurnFrom("for less than the balance", initialBalance.sub(1))
  })
})
