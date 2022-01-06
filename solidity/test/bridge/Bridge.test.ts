import { ethers, waffle } from "hardhat"
import { expect } from "chai"
import { ContractTransaction } from "ethers"
import { bridgeDeployment } from "../fixtures"
import { Bridge } from "../../typechain"

describe("Bridge", () => {
  let bridge: Bridge

  beforeEach(async () => {
    const contracts = await waffle.loadFixture(bridgeDeployment)
    bridge = contracts.bridge as Bridge
  })

  describe("revealDeposit", () => {
    // Data of a proper P2SH deposit funding transaction. Little-endian hash is:
    // 0xc6d5e443a55db477fae3cdcc371c0e825bda82864410a43e5386f689a9aab312
    const P2SHFundingTx = {
      version: "0x01000000",
      inputVector:
        "0x018348cdeb551134fe1f19d378a8adec9b146671cb67b945b71bf56b20d" +
        "c2b952f0100000000ffffffff",
      outputVector:
        "0x02102700000000000017a9146ade1c799a3e5a59678e776f21be14d66dc" +
        "15ed8877ed73b00000000001600147ac2d9378a1c47e589dfb8095ca95ed2" +
        "140d2726",
      locktime: "0x00000000",
    }

    // Data of a proper P2WSH deposit funding transaction. Little-endian hash is:
    // 0xe2cac89528cb4f145633823d9e5531640617bebc755082bd63ad82a15fc71d39
    const P2WSHFundingTx = {
      version: "0x01000000",
      inputVector:
        "0x018348cdeb551134fe1f19d378a8adec9b146671cb67b945b71bf56b20d" +
        "c2b952f0100000000ffffffff",
      outputVector:
        "0x021027000000000000220020835d670ed1c807810fcf0c50ded64c3a0a8" +
        "689af8dadf79b1ddcf3563aceaf2810d73b00000000001600147ac2d9378a" +
        "1c47e589dfb8095ca95ed2140d2726",
      locktime: "0x00000000",
    }

    // Data matching the redeem script locking the funding output of
    // P2SHFundingTx and P2WSHFundingTx.
    const reveal = {
      fundingOutputIndex: 0,
      depositor: "0x934B98637cA318a4D6E7CA6ffd1690b8e77df637",
      blindingFactor: "0xf9f0c90d00039523",
      walletPubKey:
        "0x03989d253b17a6a0f41838b84ff0d20e8898f9d7b1a98f2564da4cc29dcf8581d9",
      refundPubKey:
        "0x0300d6f28a2f6bf9836f57fcda5d284c9a8f849316119779f0d6090830d97763a9",
      refundLocktime: "0x60bcea61",
      vault: "0x594cfd89700040163727828AE20B52099C58F02C",
    }

    context("when funding transaction is P2SH", () => {
      context("when funding output script hash is correct", () => {
        context("when deposit was not revealed yet", () => {
          let tx: ContractTransaction

          beforeEach(async () => {
            tx = await bridge.revealDeposit(P2SHFundingTx, reveal)
          })

          it("should store proper deposit data", async () => {
            // Deposit key is keccak256(fundingTxHash | fundingOutputIndex).
            const depositKey = ethers.utils.solidityKeccak256(
              ["bytes32", "uint8"],
              [
                "0xc6d5e443a55db477fae3cdcc371c0e825bda82864410a43e5386f689a9aab312",
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
            expect(deposit[2]).to.be.greaterThan(0)
            // Deposit vault, same as in `reveal.vault`.
            expect(deposit[3]).to.be.equal(
              "0x594cfd89700040163727828AE20B52099C58F02C"
            )
          })

          it("should emit DepositRevealed event", async () => {
            await expect(tx)
              .to.emit(bridge, "DepositRevealed")
              .withArgs(
                "0xc6d5e443a55db477fae3cdcc371c0e825bda82864410a43e5386f689a9aab312",
                0,
                "0x934B98637cA318a4D6E7CA6ffd1690b8e77df637",
                "0xf9f0c90d00039523",
                "0x03989d253b17a6a0f41838b84ff0d20e8898f9d7b1a98f2564da4cc29dcf8581d9",
                "0x0300d6f28a2f6bf9836f57fcda5d284c9a8f849316119779f0d6090830d97763a9",
                "0x60bcea61"
              )
          })
        })

        context("when deposit was already revealed", () => {
          beforeEach(async () => {
            await bridge.revealDeposit(P2SHFundingTx, reveal)
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
          let tx: ContractTransaction

          beforeEach(async () => {
            tx = await bridge.revealDeposit(P2WSHFundingTx, reveal)
          })

          it("should store proper deposit data", async () => {
            // Deposit key is keccak256(fundingTxHash | fundingOutputIndex).
            const depositKey = ethers.utils.solidityKeccak256(
              ["bytes32", "uint8"],
              [
                "0xe2cac89528cb4f145633823d9e5531640617bebc755082bd63ad82a15fc71d39",
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
            expect(deposit[2]).to.be.greaterThan(0)
            // Deposit vault, same as in `reveal.vault`.
            expect(deposit[3]).to.be.equal(
              "0x594cfd89700040163727828AE20B52099C58F02C"
            )
          })

          it("should emit DepositRevealed event", async () => {
            await expect(tx)
              .to.emit(bridge, "DepositRevealed")
              .withArgs(
                "0xe2cac89528cb4f145633823d9e5531640617bebc755082bd63ad82a15fc71d39",
                0,
                "0x934B98637cA318a4D6E7CA6ffd1690b8e77df637",
                "0xf9f0c90d00039523",
                "0x03989d253b17a6a0f41838b84ff0d20e8898f9d7b1a98f2564da4cc29dcf8581d9",
                "0x0300d6f28a2f6bf9836f57fcda5d284c9a8f849316119779f0d6090830d97763a9",
                "0x60bcea61"
              )
          })
        })

        context("when deposit was already revealed", () => {
          beforeEach(async () => {
            await bridge.revealDeposit(P2WSHFundingTx, reveal)
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
