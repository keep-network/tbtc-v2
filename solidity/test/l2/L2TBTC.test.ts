import { SignerWithAddress } from "@nomiclabs/hardhat-ethers/signers"
import { randomBytes } from "crypto"
import { ethers, getUnnamedAccounts, helpers, waffle } from "hardhat"
import { expect } from "chai"
import { ContractTransaction } from "ethers"

import type { L2TBTC } from "../../typechain"

const { createSnapshot, restoreSnapshot } = helpers.snapshot

describe("L2TBTC", () => {
  const fixture = async () => {
    const { deployer, governance } = await helpers.signers.getNamedSigners()

    const accounts = await getUnnamedAccounts()
    const minter = await ethers.getSigner(accounts[1])
    const thirdParty = await ethers.getSigner(accounts[2])

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
      token,
    }
  }

  let token: L2TBTC

  let governance: SignerWithAddress
  let minter: SignerWithAddress
  let thirdParty: SignerWithAddress

  before(async () => {
    // eslint-disable-next-line @typescript-eslint/no-extra-semi
    ;({ governance, minter, thirdParty, token } = await waffle.loadFixture(
      fixture
    ))
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
})
