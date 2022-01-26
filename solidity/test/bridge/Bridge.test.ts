import { ethers, helpers, waffle } from "hardhat"
import { SignerWithAddress } from "@nomiclabs/hardhat-ethers/signers"
import { expect } from "chai"
import { ContractTransaction } from "ethers"

import type { Bridge } from "../../typechain"

const { createSnapshot, restoreSnapshot } = helpers.snapshot
const { lastBlockTime } = helpers.time

const ZERO_ADDRESS = ethers.constants.AddressZero

const fixture = async () => {
  const [deployer, governance, thirdParty] = await ethers.getSigners()

  const Bridge = await ethers.getContractFactory("Bridge")
  const bridge: Bridge = await Bridge.deploy()
  await bridge.deployed()

  await bridge.connect(deployer).transferOwnership(governance.address)

  return {
    governance,
    thirdParty,
    bridge,
  }
}

describe("Bridge", () => {
  let governance: SignerWithAddress
  let thirdParty: SignerWithAddress

  let bridge: Bridge

  before(async () => {
    // eslint-disable-next-line @typescript-eslint/no-extra-semi
    ;({ governance, thirdParty, bridge } = await waffle.loadFixture(fixture))
  })

  describe("isVaultTrusted", () => {
    const vault = "0x2553E09f832c9f5C656808bb7A24793818877732"

    it("should not trust a vault by default", async () => {
      // eslint-disable-next-line @typescript-eslint/no-unused-expressions
      expect(await bridge.isVaultTrusted(vault)).to.be.false
    })
  })

  describe("setVaultStatus", () => {
    const vault = "0x2553E09f832c9f5C656808bb7A24793818877732"

    describe("when called not by the governance", () => {
      it("should revert", async () => {
        await expect(
          bridge.connect(thirdParty).setVaultStatus(vault, true)
        ).to.be.revertedWith("Ownable: caller is not the owner")
      })
    })

    describe("when called by the governance", () => {
      let tx: ContractTransaction

      describe("when setting vault status as trusted", () => {
        before(async () => {
          await createSnapshot()
          tx = await bridge.connect(governance).setVaultStatus(vault, true)
        })

        after(async () => {
          await restoreSnapshot()
        })

        it("should correctly update vault status", async () => {
          // eslint-disable-next-line @typescript-eslint/no-unused-expressions
          expect(await bridge.isVaultTrusted(vault)).to.be.true
        })

        it("should emit VaultStatusUpdated event", async () => {
          await expect(tx)
            .to.emit(bridge, "VaultStatusUpdated")
            .withArgs(vault, true)
        })
      })

      describe("when setting vault status as no longer trusted", () => {
        before(async () => {
          await createSnapshot()
          await bridge.connect(governance).setVaultStatus(vault, true)
          tx = await bridge.connect(governance).setVaultStatus(vault, false)
        })

        after(async () => {
          await restoreSnapshot()
        })

        it("should correctly update vault status", async () => {
          // eslint-disable-next-line @typescript-eslint/no-unused-expressions
          expect(await bridge.isVaultTrusted(vault)).to.be.false
        })

        it("should emit VaultStatusUpdated event", async () => {
          await expect(tx)
            .to.emit(bridge, "VaultStatusUpdated")
            .withArgs(vault, false)
        })
      })
    })
  })

  describe("revealDeposit", () => {
    // Data of a proper P2SH deposit funding transaction. Little-endian hash is:
    // 0x17350f81cdb61cd8d7014ad1507d4af8d032b75812cf88d2c636c1c022991af2 and
    // this is the same as `expectedP2SHDepositData.transaction` mentioned in
    // tbtc-ts/test/deposit.test.ts file.
    const P2SHFundingTx = {
      version: "0x01000000",
      inputVector:
        "0x018348cdeb551134fe1f19d378a8adec9b146671cb67b945b71bf56b20d" +
        "c2b952f0100000000ffffffff",
      outputVector:
        "0x02102700000000000017a9142c1444d23936c57bdd8b3e67e5938a5440c" +
        "da455877ed73b00000000001600147ac2d9378a1c47e589dfb8095ca95ed2" +
        "140d2726",
      locktime: "0x00000000",
    }

    // Data of a proper P2WSH deposit funding transaction. Little-endian hash is:
    // 0x6a81de17ce3da1eadc833c5fd9d85dac307d3b78235f57afbcd9f068fc01b99e and
    // this is the same as `expectedP2WSHDepositData.transaction` mentioned in
    // tbtc-ts/test/deposit.test.ts file.
    const P2WSHFundingTx = {
      version: "0x01000000",
      inputVector:
        "0x018348cdeb551134fe1f19d378a8adec9b146671cb67b945b71bf56b20d" +
        "c2b952f0100000000ffffffff",
      outputVector:
        "0x021027000000000000220020df74a2e385542c87acfafa564ea4bc4fc4e" +
        "b87d2b6a37d6c3b64722be83c636f10d73b00000000001600147ac2d9378a" +
        "1c47e589dfb8095ca95ed2140d2726",
      locktime: "0x00000000",
    }

    // Data matching the redeem script locking the funding output of
    // P2SHFundingTx and P2WSHFundingTx.
    const reveal = {
      fundingOutputIndex: 0,
      depositor: "0x934B98637cA318a4D6E7CA6ffd1690b8e77df637",
      blindingFactor: "0xf9f0c90d00039523",
      // HASH160 of 03989d253b17a6a0f41838b84ff0d20e8898f9d7b1a98f2564da4cc29dcf8581d9.
      walletPubKeyHash: "0x8db50eb52063ea9d98b3eac91489a90f738986f6",
      // HASH160 of 0300d6f28a2f6bf9836f57fcda5d284c9a8f849316119779f0d6090830d97763a9.
      refundPubKeyHash: "0x28e081f285138ccbe389c1eb8985716230129f89",
      refundLocktime: "0x60bcea61",
      vault: "0x594cfd89700040163727828AE20B52099C58F02C",
    }

    before(async () => {
      await bridge.connect(governance).setVaultStatus(reveal.vault, true)
    })

    context("when funding transaction is P2SH", () => {
      context("when funding output script hash is correct", () => {
        context("when deposit was not revealed yet", () => {
          context("when deposit is routed to a trusted vault", () => {
            let tx: ContractTransaction

            before(async () => {
              await createSnapshot()

              tx = await bridge.revealDeposit(P2SHFundingTx, reveal)
            })

            after(async () => {
              await restoreSnapshot()
            })

            it("should store proper deposit data", async () => {
              // Deposit key is keccak256(fundingTxHash | fundingOutputIndex).
              const depositKey = ethers.utils.solidityKeccak256(
                ["bytes32", "uint8"],
                [
                  "0x17350f81cdb61cd8d7014ad1507d4af8d032b75812cf88d2c636c1c022991af2",
                  reveal.fundingOutputIndex,
                ]
              )

              const deposit = await bridge.unswept(depositKey)

              // Should contain: depositor, amount, revealedAt and vault.
              expect(deposit.length).to.be.equal(4)
              // Depositor address, same as in `reveal.depositor`.
              expect(deposit[0]).to.be.equal(
                "0x934B98637cA318a4D6E7CA6ffd1690b8e77df637"
              )
              // Deposit amount encoded as 8-byte LE. In this case it's
              // 10000 satoshi because the P2SH deposit transaction set this
              // value for the funding output.
              expect(deposit[1]).to.be.equal("0x1027000000000000")
              // Revealed time should be set.
              expect(deposit[2]).to.be.equal(await lastBlockTime())
              // Deposit vault, same as in `reveal.vault`.
              expect(deposit[3]).to.be.equal(
                "0x594cfd89700040163727828AE20B52099C58F02C"
              )
            })

            it("should emit DepositRevealed event", async () => {
              await expect(tx)
                .to.emit(bridge, "DepositRevealed")
                .withArgs(
                  "0x17350f81cdb61cd8d7014ad1507d4af8d032b75812cf88d2c636c1c022991af2",
                  reveal.fundingOutputIndex,
                  "0x934B98637cA318a4D6E7CA6ffd1690b8e77df637",
                  "0xf9f0c90d00039523",
                  "0x8db50eb52063ea9d98b3eac91489a90f738986f6",
                  "0x28e081f285138ccbe389c1eb8985716230129f89",
                  "0x60bcea61",
                  reveal.vault
                )
            })
          })

          context("when deposit is not routed to a vault", () => {
            let tx: ContractTransaction
            let nonRoutedReveal

            before(async () => {
              await createSnapshot()

              nonRoutedReveal = { ...reveal }
              nonRoutedReveal.vault = ZERO_ADDRESS
              tx = await bridge.revealDeposit(P2SHFundingTx, nonRoutedReveal)
            })

            after(async () => {
              await restoreSnapshot()
            })

            it("should accept the deposit", async () => {
              await expect(tx)
                .to.emit(bridge, "DepositRevealed")
                .withArgs(
                  "0x17350f81cdb61cd8d7014ad1507d4af8d032b75812cf88d2c636c1c022991af2",
                  reveal.fundingOutputIndex,
                  "0x934B98637cA318a4D6E7CA6ffd1690b8e77df637",
                  "0xf9f0c90d00039523",
                  "0x8db50eb52063ea9d98b3eac91489a90f738986f6",
                  "0x28e081f285138ccbe389c1eb8985716230129f89",
                  "0x60bcea61",
                  ZERO_ADDRESS
                )
            })
          })

          context("when deposit is routed to a non-trusted vault", () => {
            let nonTrustedVaultReveal

            before(async () => {
              await createSnapshot()

              nonTrustedVaultReveal = { ...reveal }
              nonTrustedVaultReveal.vault =
                "0x92499afEAD6c41f757Ec3558D0f84bf7ec5aD967"
            })

            after(async () => {
              await restoreSnapshot()
            })

            it("should revert", async () => {
              await expect(
                bridge.revealDeposit(P2SHFundingTx, nonTrustedVaultReveal)
              ).to.be.revertedWith("Vault is not trusted")
            })
          })
        })

        context("when deposit was already revealed", () => {
          before(async () => {
            await createSnapshot()

            await bridge.revealDeposit(P2SHFundingTx, reveal)
          })

          after(async () => {
            await restoreSnapshot()
          })

          it("should revert", async () => {
            await expect(
              bridge.revealDeposit(P2SHFundingTx, reveal)
            ).to.be.revertedWith("Deposit already revealed")
          })
        })
      })

      context("when funding output script hash is wrong", () => {
        it("should revert", async () => {
          // Corrupt reveal data by setting a wrong depositor address.
          const corruptedReveal = { ...reveal }
          corruptedReveal.depositor =
            "0x24CbaB95C69e5bcbE328252F957A39d906eE75f3"

          await expect(
            bridge.revealDeposit(P2SHFundingTx, corruptedReveal)
          ).to.be.revertedWith("Wrong 20-byte script hash")
        })
      })
    })

    context("when funding transaction is P2WSH", () => {
      context("when funding output script hash is correct", () => {
        context("when deposit was not revealed yet", () => {
          context("when deposit is routed to a trusted vault", () => {
            let tx: ContractTransaction

            before(async () => {
              await createSnapshot()

              tx = await bridge.revealDeposit(P2WSHFundingTx, reveal)
            })

            after(async () => {
              await restoreSnapshot()
            })

            it("should store proper deposit data", async () => {
              // Deposit key is keccak256(fundingTxHash | fundingOutputIndex).
              const depositKey = ethers.utils.solidityKeccak256(
                ["bytes32", "uint8"],
                [
                  "0x6a81de17ce3da1eadc833c5fd9d85dac307d3b78235f57afbcd9f068fc01b99e",
                  reveal.fundingOutputIndex,
                ]
              )

              const deposit = await bridge.unswept(depositKey)

              // Should contain: depositor, amount, revealedAt and vault.
              expect(deposit.length).to.be.equal(4)
              // Depositor address, same as in `reveal.depositor`.
              expect(deposit[0]).to.be.equal(
                "0x934B98637cA318a4D6E7CA6ffd1690b8e77df637"
              )
              // Deposit amount encoded as 8-byte LE. In this case it's
              // 10000 satoshi because the P2SH deposit transaction set this
              // value for the funding output.
              expect(deposit[1]).to.be.equal("0x1027000000000000")
              // Revealed time should be set.
              expect(deposit[2]).to.be.equal(await lastBlockTime())
              // Deposit vault, same as in `reveal.vault`.
              expect(deposit[3]).to.be.equal(
                "0x594cfd89700040163727828AE20B52099C58F02C"
              )
            })

            it("should emit DepositRevealed event", async () => {
              await expect(tx)
                .to.emit(bridge, "DepositRevealed")
                .withArgs(
                  "0x6a81de17ce3da1eadc833c5fd9d85dac307d3b78235f57afbcd9f068fc01b99e",
                  reveal.fundingOutputIndex,
                  "0x934B98637cA318a4D6E7CA6ffd1690b8e77df637",
                  "0xf9f0c90d00039523",
                  "0x8db50eb52063ea9d98b3eac91489a90f738986f6",
                  "0x28e081f285138ccbe389c1eb8985716230129f89",
                  "0x60bcea61",
                  reveal.vault
                )
            })
          })

          context("when deposit is not routed to a vault", () => {
            let tx: ContractTransaction
            let nonRoutedReveal

            before(async () => {
              await createSnapshot()

              nonRoutedReveal = { ...reveal }
              nonRoutedReveal.vault = ZERO_ADDRESS
              tx = await bridge.revealDeposit(P2WSHFundingTx, nonRoutedReveal)
            })

            after(async () => {
              await restoreSnapshot()
            })

            it("should accept the deposit", async () => {
              await expect(tx)
                .to.emit(bridge, "DepositRevealed")
                .withArgs(
                  "0x6a81de17ce3da1eadc833c5fd9d85dac307d3b78235f57afbcd9f068fc01b99e",
                  reveal.fundingOutputIndex,
                  "0x934B98637cA318a4D6E7CA6ffd1690b8e77df637",
                  "0xf9f0c90d00039523",
                  "0x8db50eb52063ea9d98b3eac91489a90f738986f6",
                  "0x28e081f285138ccbe389c1eb8985716230129f89",
                  "0x60bcea61",
                  ZERO_ADDRESS
                )
            })
          })

          context("when deposit is routed to a non-trusted vault", () => {
            let nonTrustedVaultReveal

            before(async () => {
              await createSnapshot()

              nonTrustedVaultReveal = { ...reveal }
              nonTrustedVaultReveal.vault =
                "0x92499afEAD6c41f757Ec3558D0f84bf7ec5aD967"
            })

            after(async () => {
              await restoreSnapshot()
            })

            it("should revert", async () => {
              await expect(
                bridge.revealDeposit(P2WSHFundingTx, nonTrustedVaultReveal)
              ).to.be.revertedWith("Vault is not trusted")
            })
          })
        })

        context("when deposit was already revealed", () => {
          before(async () => {
            await createSnapshot()

            await bridge.revealDeposit(P2WSHFundingTx, reveal)
          })

          after(async () => {
            await restoreSnapshot()
          })

          it("should revert", async () => {
            await expect(
              bridge.revealDeposit(P2WSHFundingTx, reveal)
            ).to.be.revertedWith("Deposit already revealed")
          })
        })
      })

      context("when funding output script hash is wrong", () => {
        it("should revert", async () => {
          // Corrupt reveal data by setting a wrong depositor address.
          const corruptedReveal = { ...reveal }
          corruptedReveal.depositor =
            "0x24CbaB95C69e5bcbE328252F957A39d906eE75f3"

          await expect(
            bridge.revealDeposit(P2WSHFundingTx, corruptedReveal)
          ).to.be.revertedWith("Wrong 32-byte script hash")
        })
      })
    })

    context("when funding transaction is neither P2SH nor P2WSH", () => {
      it("should revert", async () => {
        // Corrupt transaction output data by making a 21-byte script hash.
        const corruptedP2SHFundingTx = { ...P2SHFundingTx }
        corruptedP2SHFundingTx.outputVector =
          "0x02102700000000000017a9156a6ade1c799a3e5a59678e776f21be14d66dc" +
          "15ed8877ed73b00000000001600147ac2d9378a1c47e589dfb8095ca95ed2" +
          "140d2726"

        await expect(
          bridge.revealDeposit(corruptedP2SHFundingTx, reveal)
        ).to.be.revertedWith("Wrong script hash length")
      })
    })
  })
})
