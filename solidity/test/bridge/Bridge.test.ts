import { ethers, helpers, waffle } from "hardhat"
import { SignerWithAddress } from "@nomiclabs/hardhat-ethers/signers"
import { expect } from "chai"
import { ContractTransaction } from "ethers"
import type { Bank, Bridge, TestRelay } from "../../typechain"
import {
  MultipleDepositsNoPreviousSweep,
  SingleP2SHDeposit,
  SweepTestData,
} from "../data/sweep"

const { createSnapshot, restoreSnapshot } = helpers.snapshot
const { lastBlockTime } = helpers.time

const ZERO_ADDRESS = ethers.constants.AddressZero

const fixture = async () => {
  const [deployer, governance, thirdParty] = await ethers.getSigners()

  const Bank = await ethers.getContractFactory("Bank")
  const bank: Bank = await Bank.deploy()
  await bank.deployed()

  const TestRelay = await ethers.getContractFactory("TestRelay")
  const relay: TestRelay = await TestRelay.deploy()
  await relay.deployed()

  const Bridge = await ethers.getContractFactory("Bridge")
  const bridge: Bridge = await Bridge.deploy(bank.address, relay.address, 1)
  await bridge.deployed()

  await bank.updateBridge(bridge.address)
  await bridge.connect(deployer).transferOwnership(governance.address)

  return {
    governance,
    thirdParty,
    bank,
    relay,
    bridge,
  }
}

describe("Bridge", () => {
  let governance: SignerWithAddress
  let thirdParty: SignerWithAddress

  let bank: Bank
  let relay: TestRelay
  let bridge: Bridge

  before(async () => {
    // eslint-disable-next-line @typescript-eslint/no-extra-semi
    ;({ governance, thirdParty, bank, relay, bridge } =
      await waffle.loadFixture(fixture))
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
    // this is the same as `expectedP2SHDepositTransaction` mentioned in
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
    // 0xf54d69b5c5e07917032a8bf14137fa67752fad5ce73bc9544c9b2f87ff5b4cb7 and
    // this is the same as `expectedP2WSHDepositTransaction` mentioned in
    // tbtc-ts/test/deposit.test.ts file.
    const P2WSHFundingTx = {
      version: "0x01000000",
      inputVector:
        "0x018348cdeb551134fe1f19d378a8adec9b146671cb67b945b71bf56b20d" +
        "c2b952f0100000000ffffffff",
      outputVector:
        "0x02102700000000000022002058afcec524e78c289a03df1ca88e29a664b" +
        "d06481cfcd71101ccf7d041ed3b9110d73b00000000001600147ac2d9378a" +
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
                ["bytes32", "uint32"],
                [
                  "0x17350f81cdb61cd8d7014ad1507d4af8d032b75812cf88d2c636c1c022991af2",
                  reveal.fundingOutputIndex,
                ]
              )

              const deposit = await bridge.deposits(depositKey)

              // Should contain: depositor, amount, revealedAt, vault, sweptAt.
              expect(deposit.length).to.be.equal(5)
              // Depositor address, same as in `reveal.depositor`.
              expect(deposit[0]).to.be.equal(
                "0x934B98637cA318a4D6E7CA6ffd1690b8e77df637"
              )
              // Deposit amount in satoshi. In this case it's 10000 satoshi
              // because the P2SH deposit transaction set this value for the
              // funding output.
              expect(deposit[1]).to.be.equal(10000)
              // Revealed time should be set.
              expect(deposit[2]).to.be.equal(await lastBlockTime())
              // Deposit vault, same as in `reveal.vault`.
              expect(deposit[3]).to.be.equal(
                "0x594cfd89700040163727828AE20B52099C58F02C"
              )
              // Swept time should be unset.
              expect(deposit[4]).to.be.equal(0)
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
                ["bytes32", "uint32"],
                [
                  "0xf54d69b5c5e07917032a8bf14137fa67752fad5ce73bc9544c9b2f87ff5b4cb7",
                  reveal.fundingOutputIndex,
                ]
              )

              const deposit = await bridge.deposits(depositKey)

              // Should contain: depositor, amount, revealedAt and vault.
              expect(deposit.length).to.be.equal(5)
              // Depositor address, same as in `reveal.depositor`.
              expect(deposit[0]).to.be.equal(
                "0x934B98637cA318a4D6E7CA6ffd1690b8e77df637"
              )
              // Deposit amount in satoshi. In this case it's 10000 satoshi
              // because the P2WSH deposit transaction set this value for the
              // funding output.
              expect(deposit[1]).to.be.equal(10000)
              // Revealed time should be set.
              expect(deposit[2]).to.be.equal(await lastBlockTime())
              // Deposit vault, same as in `reveal.vault`.
              expect(deposit[3]).to.be.equal(
                "0x594cfd89700040163727828AE20B52099C58F02C"
              )
              // Swept time should be unset.
              expect(deposit[4]).to.be.equal(0)
            })

            it("should emit DepositRevealed event", async () => {
              await expect(tx)
                .to.emit(bridge, "DepositRevealed")
                .withArgs(
                  "0xf54d69b5c5e07917032a8bf14137fa67752fad5ce73bc9544c9b2f87ff5b4cb7",
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
                  "0xf54d69b5c5e07917032a8bf14137fa67752fad5ce73bc9544c9b2f87ff5b4cb7",
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

  describe("sweep", () => {
    context("when transaction proof is valid", () => {
      context("when there is only one output", () => {
        context("when wallet public key hash length is 20 bytes", () => {
          context("when previous sweep data are valid", () => {
            context("when there is only one input", () => {
              context(
                "when the single input is a revealed unswept P2SH deposit",
                () => {
                  let tx: ContractTransaction
                  const data: SweepTestData = SingleP2SHDeposit

                  before(async () => {
                    await createSnapshot()

                    tx = await runSweepScenario(data)
                  })

                  after(async () => {
                    await restoreSnapshot()
                  })

                  it("should mark deposit as swept", async () => {
                    // Deposit key is keccak256(fundingTxHash | fundingOutputIndex).
                    const depositKey = ethers.utils.solidityKeccak256(
                      ["bytes32", "uint32"],
                      [
                        data.deposits[0].fundingTx.hash,
                        data.deposits[0].reveal.fundingOutputIndex,
                      ]
                    )

                    const deposit = await bridge.deposits(depositKey)

                    // Swept time is the last item.
                    expect(deposit[4]).to.be.equal(await lastBlockTime())
                  })

                  it("should save sweep hash for given wallet", async () => {
                    // Take wallet public key hash from first deposit. All deposits
                    // in same sweep batch should have the same value of that field.
                    const { walletPubKeyHash } = data.deposits[0].reveal

                    const sweepHash = await bridge.sweeps(walletPubKeyHash)

                    // Amount can be checked by opening the sweep tx in a Bitcoin
                    // testnet explorer. In this case, the sum of inputs is
                    // 20000 satoshi (from the single deposit) and there is a
                    // fee of 1500 so the output value is 18500.
                    const expectedSweepHash = ethers.utils.solidityKeccak256(
                      ["bytes32", "uint64"],
                      [data.sweepTx.hash, 18500]
                    )

                    expect(sweepHash).to.be.equal(expectedSweepHash)
                  })

                  it("should update the depositor's balance", async () => {
                    // The sum of sweep tx inputs is 20000 satoshi. The output
                    // value is 18500 so the fee is 1500. There is only one
                    // deposit so it incurs the entire fee.
                    expect(
                      await bank.balanceOf(data.deposits[0].reveal.depositor)
                    ).to.be.equal(18500)
                  })
                }
              )

              context(
                "when the single input is a revealed unswept P2WSH deposit",
                () => {}
              )

              context(
                "when the single input is the expected previous sweep",
                () => {}
              )

              context(
                "when the single input is a revealed but already swept deposit",
                () => {
                  it("should revert", () => {
                    // TODO: Implementation.
                  })
                }
              )

              context("when the single input is an unknown", () => {
                it("should revert", () => {
                  // TODO: Implementation.
                })
              })
            })

            // Since P2SH vs P2WSH path has been already checked in the scenario
            // "when there is only one input", we no longer differentiate deposits
            // using that criterion during "when there are multiple inputs" scenario.
            context("when there are multiple inputs", () => {
              context(
                "when input vector consists only of revealed unswept " +
                  "deposits and the expected previous sweep",
                () => {}
              )

              context(
                "when input vector consists only of revealed unswept " +
                  "deposits but there is no previous sweep since it is not expected",
                () => {
                  let tx: ContractTransaction
                  const data: SweepTestData = MultipleDepositsNoPreviousSweep

                  before(async () => {
                    await createSnapshot()

                    tx = await runSweepScenario(data)
                  })

                  after(async () => {
                    await restoreSnapshot()
                  })

                  // TODO: Replace with proper assertions.
                  it("should work", async () => {
                    expect(tx.hash.length).to.be.greaterThan(0)
                  })
                }
              )

              context(
                "when input vector consists only of revealed unswept " +
                  "deposits but there is no previous sweep despite it is expected",
                () => {
                  it("should revert", () => {
                    // TODO: Implementation.
                  })
                }
              )

              context(
                "when input vector contains a revealed but already swept deposit",
                () => {
                  it("should revert", () => {
                    // TODO: Implementation.
                  })
                }
              )

              context("when input vector contains an unknown input", () => {
                it("should revert", () => {
                  // TODO: Implementation.
                })
              })
            })
          })

          context("when previous sweep data are invalid", () => {
            it("should revert", () => {
              // TODO: Implementation.
            })
          })
        })

        context(
          "when wallet public key hash length is other than 20 bytes",
          () => {
            it("should revert", () => {
              // TODO: Implementation.
            })
          }
        )
      })

      context("when output count is other than one", () => {
        it("should revert", () => {
          // TODO: Implementation.
        })
      })
    })

    context("when transaction proof is not valid", () => {
      context("when input vector is not valid", () => {
        it("should revert", () => {
          // TODO: Implementation.
        })
      })

      context("when output vector is not valid", () => {
        it("should revert", () => {
          // TODO: Implementation.
        })
      })

      context("when merkle proof is not valid", () => {
        it("should revert", () => {
          // TODO: Implementation.
        })
      })

      context("when proof difficulty is not current nor previous", () => {
        it("should revert", () => {
          // TODO: Implementation.
        })
      })

      context("when headers chain length is not valid", () => {
        it("should revert", () => {
          // TODO: Implementation.
        })
      })

      context("when headers chain is not valid", () => {
        it("should revert", () => {
          // TODO: Implementation.
        })
      })

      context("when the work in the header is insufficient", () => {
        it("should revert", () => {
          // TODO: Implementation.
        })
      })

      context(
        "when accumulated difficulty in headers chain is insufficient",
        () => {
          it("should revert", () => {
            // TODO: Implementation.
          })
        }
      )
    })
  })

  async function runSweepScenario(
    data: SweepTestData
  ): Promise<ContractTransaction> {
    await relay.setCurrentEpochDifficulty(data.chainDifficulty)
    await relay.setPrevEpochDifficulty(data.chainDifficulty)

    for (let i = 0; i < data.deposits.length; i++) {
      const { fundingTx, reveal } = data.deposits[i]
      // eslint-disable-next-line no-await-in-loop
      await bridge.revealDeposit(fundingTx, reveal)
    }

    return bridge.sweep(data.sweepTx, data.sweepProof, {
      txHash:
        "0x0000000000000000000000000000000000000000000000000000000000000000",
      txOutputValue: 0,
    })
  }
})
