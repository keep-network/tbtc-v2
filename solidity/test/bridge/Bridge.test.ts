import { ethers, helpers, waffle } from "hardhat"
import { SignerWithAddress } from "@nomiclabs/hardhat-ethers/signers"
import { expect } from "chai"
import {
  BigNumber,
  BigNumberish,
  ContractTransaction,
  Transaction,
} from "ethers"
import { BytesLike } from "@ethersproject/bytes"
import type {
  Bank,
  BankStub,
  Bridge,
  BridgeStub,
  FraudVerification,
  TestRelay,
} from "../../typechain"
import {
  MultipleDepositsNoMainUtxo,
  MultipleDepositsWithMainUtxo,
  NO_MAIN_UTXO,
  SingleP2SHDeposit,
  SingleP2WSHDeposit,
  SingleMainUtxo,
  SweepTestData,
} from "../data/sweep"
import {
  MultiplePendingRequestedRedemptionsWithChange,
  RedemptionBalanceChange,
  RedemptionTestData,
} from "../data/redemption"

const { createSnapshot, restoreSnapshot } = helpers.snapshot
const { lastBlockTime } = helpers.time
const { impersonateAccount } = helpers.account

const ZERO_ADDRESS = ethers.constants.AddressZero

const fixture = async () => {
  const [deployer, governance, thirdParty, treasury] = await ethers.getSigners()

  const Bank = await ethers.getContractFactory("BankStub")
  const bank: Bank & BankStub = await Bank.deploy()
  await bank.deployed()

  const TestRelay = await ethers.getContractFactory("TestRelay")
  const relay: TestRelay = await TestRelay.deploy()
  await relay.deployed()

  const FraudVerification = await ethers.getContractFactory("FraudVerification")
  const fraudVerification: FraudVerification = await FraudVerification.deploy()
  await fraudVerification.deployed()

  const Bridge = await ethers.getContractFactory("BridgeStub", {
    libraries: {
      FraudVerification: fraudVerification.address,
    },
  })
  const bridge: Bridge & BridgeStub = await Bridge.deploy(
    bank.address,
    relay.address,
    treasury.address,
    1
  )
  await bridge.deployed()

  await bank.updateBridge(bridge.address)
  await bridge.connect(deployer).transferOwnership(governance.address)

  return {
    governance,
    thirdParty,
    treasury,
    bank,
    relay,
    bridge,
  }
}

describe("Bridge", () => {
  let governance: SignerWithAddress
  let thirdParty: SignerWithAddress
  let treasury: SignerWithAddress

  let bank: Bank & BankStub
  let relay: TestRelay
  let bridge: Bridge & BridgeStub

  before(async () => {
    // eslint-disable-next-line @typescript-eslint/no-extra-semi
    ;({ governance, thirdParty, treasury, bank, relay, bridge } =
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

  describe("setFraudChallengeDepositAmount", () => {
    const fraudChallengeDepositAmount = ethers.utils.parseEther("2")

    describe("when called not by the governance", () => {
      it("should revert", async () => {
        await expect(
          bridge
            .connect(thirdParty)
            .setFraudChallengeDepositAmount(fraudChallengeDepositAmount)
        ).to.be.revertedWith("Ownable: caller is not the owner")
      })
    })

    describe("when called with zero", () => {
      it("should revert", async () => {
        await expect(
          bridge.connect(governance).setFraudChallengeDepositAmount(0)
        ).to.be.revertedWith("Fraud challenge deposit amount must be > 0")
      })
    })

    describe("when called by the governance", () => {
      let tx: ContractTransaction

      describe("when setting vault status as trusted", () => {
        before(async () => {
          await createSnapshot()
          tx = await bridge
            .connect(governance)
            .setFraudChallengeDepositAmount(fraudChallengeDepositAmount)
        })

        after(async () => {
          await restoreSnapshot()
        })

        it("should correctly update vault status", async () => {
          expect(await bridge.fraudChallengeDepositAmount()).to.equal(
            fraudChallengeDepositAmount
          )
        })

        it("should emit VaultStatusUpdated event", async () => {
          await expect(tx)
            .to.emit(bridge, "FraudChallengeDepositAmountUpdated")
            .withArgs(fraudChallengeDepositAmount)
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
                  10000,
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
                  10000,
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
                  "0x6a81de17ce3da1eadc833c5fd9d85dac307d3b78235f57afbcd9f068fc01b99e",
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
                  "0x6a81de17ce3da1eadc833c5fd9d85dac307d3b78235f57afbcd9f068fc01b99e",
                  reveal.fundingOutputIndex,
                  "0x934B98637cA318a4D6E7CA6ffd1690b8e77df637",
                  10000,
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
                  10000,
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

  describe("submitSweepProof", () => {
    context("when transaction proof is valid", () => {
      context("when there is only one output", () => {
        context("when wallet public key hash length is 20 bytes", () => {
          context("when main UTXO data are valid", () => {
            context("when there is only one input", () => {
              context(
                "when the single input is a revealed unswept P2SH deposit",
                () => {
                  let tx: ContractTransaction
                  const data: SweepTestData = SingleP2SHDeposit
                  // Take wallet public key hash from first deposit. All
                  // deposits in same sweep batch should have the same value
                  // of that field.
                  const { walletPubKeyHash } = data.deposits[0].reveal

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

                  it("should update main UTXO for the given wallet", async () => {
                    const mainUtxoHash = await bridge.mainUtxos(
                      walletPubKeyHash
                    )

                    // Amount can be checked by opening the sweep tx in a Bitcoin
                    // testnet explorer. In this case, the sum of inputs is
                    // 20000 satoshi (from the single deposit) and there is a
                    // fee of 1500 so the output value is 18500.
                    const expectedMainUtxo = ethers.utils.solidityKeccak256(
                      ["bytes32", "uint32", "uint64"],
                      [data.sweepTx.hash, 0, 18500]
                    )

                    expect(mainUtxoHash).to.be.equal(expectedMainUtxo)
                  })

                  it("should update the depositor's balance", async () => {
                    // The sum of sweep tx inputs is 20000 satoshi. The output
                    // value is 18500 so the fee is 1500. There is only one
                    // deposit so it incurs the entire fee.
                    expect(
                      await bank.balanceOf(data.deposits[0].reveal.depositor)
                    ).to.be.equal(18500)
                  })

                  it("should emit DepositsSwept event", async () => {
                    await expect(tx)
                      .to.emit(bridge, "DepositsSwept")
                      .withArgs(walletPubKeyHash, data.sweepTx.hash)
                  })
                }
              )

              context(
                "when the single input is a revealed unswept P2WSH deposit",
                () => {
                  let tx: ContractTransaction
                  const data: SweepTestData = SingleP2WSHDeposit
                  // Take wallet public key hash from first deposit. All
                  // deposits in same sweep batch should have the same value
                  // of that field.
                  const { walletPubKeyHash } = data.deposits[0].reveal

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

                  it("should update main UTXO for the given wallet", async () => {
                    const mainUtxoHash = await bridge.mainUtxos(
                      walletPubKeyHash
                    )

                    // Amount can be checked by opening the sweep tx in a Bitcoin
                    // testnet explorer. In this case, the sum of inputs is
                    // 80000 satoshi (from the single deposit) and there is a
                    // fee of 2000 so the output value is 78000.
                    const expectedMainUtxo = ethers.utils.solidityKeccak256(
                      ["bytes32", "uint32", "uint64"],
                      [data.sweepTx.hash, 0, 78000]
                    )

                    expect(mainUtxoHash).to.be.equal(expectedMainUtxo)
                  })

                  it("should update the depositor's balance", async () => {
                    // The sum of sweep tx inputs is 80000 satoshi. The output
                    // value is 78000 so the fee is 2000. There is only one
                    // deposit so it incurs the entire fee.
                    expect(
                      await bank.balanceOf(data.deposits[0].reveal.depositor)
                    ).to.be.equal(78000)
                  })

                  it("should emit DepositsSwept event", async () => {
                    await expect(tx)
                      .to.emit(bridge, "DepositsSwept")
                      .withArgs(walletPubKeyHash, data.sweepTx.hash)
                  })
                }
              )

              context("when the single input is the expected main UTXO", () => {
                const previousData: SweepTestData = SingleP2SHDeposit
                const data: SweepTestData = SingleMainUtxo

                before(async () => {
                  await createSnapshot()

                  // Make the first sweep which is actually the predecessor
                  // of the sweep tested within this scenario.
                  await runSweepScenario(previousData)
                })

                after(async () => {
                  await restoreSnapshot()
                })

                it("should revert", async () => {
                  await expect(runSweepScenario(data)).to.be.revertedWith(
                    "Sweep transaction must process at least one deposit"
                  )
                })
              })

              context(
                "when the single input is a revealed but already swept deposit",
                () => {
                  const data: SweepTestData = SingleP2SHDeposit

                  before(async () => {
                    await createSnapshot()

                    // Make a proper sweep to turn the tested deposit into
                    // the swept state.
                    await runSweepScenario(data)
                  })

                  after(async () => {
                    await restoreSnapshot()
                  })

                  it("should revert", async () => {
                    // Main UTXO parameter must point to the properly
                    // made sweep to avoid revert at validation stage.
                    const mainUtxo = {
                      txHash: data.sweepTx.hash,
                      txOutputIndex: 0,
                      txOutputValue: 18500,
                    }

                    // Try replaying the already done sweep.
                    await expect(
                      bridge.submitSweepProof(
                        data.sweepTx,
                        data.sweepProof,
                        mainUtxo
                      )
                    ).to.be.revertedWith("Deposit already swept")
                  })
                }
              )

              context("when the single input is an unknown", () => {
                const data: SweepTestData = SingleP2SHDeposit

                before(async () => {
                  await createSnapshot()

                  // Necessary to pass the proof validation.
                  await relay.setCurrentEpochDifficulty(data.chainDifficulty)
                  await relay.setPrevEpochDifficulty(data.chainDifficulty)
                })

                after(async () => {
                  await restoreSnapshot()
                })

                it("should revert", async () => {
                  // Try to sweep a deposit which was not revealed before and
                  // is unknown from system's point of view.
                  await expect(
                    bridge.submitSweepProof(
                      data.sweepTx,
                      data.sweepProof,
                      NO_MAIN_UTXO
                    )
                  ).to.be.revertedWith("Unknown input type")
                })
              })
            })

            // Since P2SH vs P2WSH path has been already checked in the scenario
            // "when there is only one input", we no longer differentiate deposits
            // using that criterion during "when there are multiple inputs" scenario.
            context("when there are multiple inputs", () => {
              context(
                "when input vector consists only of revealed unswept " +
                  "deposits and the expected main UTXO",
                () => {
                  let tx: ContractTransaction
                  const previousData: SweepTestData = MultipleDepositsNoMainUtxo
                  const data: SweepTestData = MultipleDepositsWithMainUtxo
                  // Take wallet public key hash from first deposit. All
                  // deposits in same sweep batch should have the same value
                  // of that field.
                  const { walletPubKeyHash } = data.deposits[0].reveal

                  before(async () => {
                    await createSnapshot()

                    // Make the first sweep which is actually the predecessor
                    // of the sweep tested within this scenario.
                    await runSweepScenario(previousData)

                    tx = await runSweepScenario(data)
                  })

                  after(async () => {
                    await restoreSnapshot()
                  })

                  it("should mark deposits as swept", async () => {
                    for (let i = 0; i < data.deposits.length; i++) {
                      // Deposit key is keccak256(fundingTxHash | fundingOutputIndex).
                      const depositKey = ethers.utils.solidityKeccak256(
                        ["bytes32", "uint32"],
                        [
                          data.deposits[i].fundingTx.hash,
                          data.deposits[i].reveal.fundingOutputIndex,
                        ]
                      )

                      // eslint-disable-next-line no-await-in-loop
                      const deposit = await bridge.deposits(depositKey)

                      // Swept time is the last item.
                      expect(deposit[4]).to.be.equal(
                        // eslint-disable-next-line no-await-in-loop
                        await lastBlockTime(),
                        `Deposit with index ${i} has an unexpected swept time`
                      )
                    }
                  })

                  it("should update main UTXO for the given wallet", async () => {
                    const mainUtxoHash = await bridge.mainUtxos(
                      walletPubKeyHash
                    )

                    // Amount can be checked by opening the sweep tx in a Bitcoin
                    // testnet explorer. In this case, the sum of inputs is
                    // 4148000 satoshi and there is a fee of 2999 so the output
                    // value is 4145001.
                    const expectedMainUtxo = ethers.utils.solidityKeccak256(
                      ["bytes32", "uint32", "uint64"],
                      [data.sweepTx.hash, 0, 4145001]
                    )

                    expect(mainUtxoHash).to.be.equal(expectedMainUtxo)
                  })

                  it("should update the depositors balances", async () => {
                    // The sum of sweep tx inputs is 4148000 satoshi. The output
                    // value is 4145001 so the fee is 2999. There is 5 deposits
                    // so 599 satoshi fee should be incurred per deposit.
                    expect(
                      await bank.balanceOf(data.deposits[0].reveal.depositor)
                    ).to.be.equal(219401)
                    expect(
                      await bank.balanceOf(data.deposits[1].reveal.depositor)
                    ).to.be.equal(759401)
                    expect(
                      await bank.balanceOf(data.deposits[2].reveal.depositor)
                    ).to.be.equal(939401)
                    expect(
                      await bank.balanceOf(data.deposits[3].reveal.depositor)
                    ).to.be.equal(879401)
                    expect(
                      await bank.balanceOf(data.deposits[4].reveal.depositor)
                    ).to.be.equal(289401)
                  })

                  it("should emit DepositsSwept event", async () => {
                    await expect(tx)
                      .to.emit(bridge, "DepositsSwept")
                      .withArgs(walletPubKeyHash, data.sweepTx.hash)
                  })
                }
              )

              context(
                "when input vector consists only of revealed unswept " +
                  "deposits but there is no main UTXO since it is not expected",
                () => {
                  let tx: ContractTransaction
                  const data: SweepTestData = MultipleDepositsNoMainUtxo
                  // Take wallet public key hash from first deposit. All
                  // deposits in same sweep batch should have the same value
                  // of that field.
                  const { walletPubKeyHash } = data.deposits[0].reveal

                  before(async () => {
                    await createSnapshot()

                    tx = await runSweepScenario(data)
                  })

                  after(async () => {
                    await restoreSnapshot()
                  })

                  it("should mark deposits as swept", async () => {
                    for (let i = 0; i < data.deposits.length; i++) {
                      // Deposit key is keccak256(fundingTxHash | fundingOutputIndex).
                      const depositKey = ethers.utils.solidityKeccak256(
                        ["bytes32", "uint32"],
                        [
                          data.deposits[i].fundingTx.hash,
                          data.deposits[i].reveal.fundingOutputIndex,
                        ]
                      )

                      // eslint-disable-next-line no-await-in-loop
                      const deposit = await bridge.deposits(depositKey)

                      // Swept time is the last item.
                      expect(deposit[4]).to.be.equal(
                        // eslint-disable-next-line no-await-in-loop
                        await lastBlockTime(),
                        `Deposit with index ${i} has an unexpected swept time`
                      )
                    }
                  })

                  it("should update main UTXO for the given wallet", async () => {
                    const mainUtxoHash = await bridge.mainUtxos(
                      walletPubKeyHash
                    )

                    // Amount can be checked by opening the sweep tx in a Bitcoin
                    // testnet explorer. In this case, the sum of inputs is
                    // 1060000 satoshi and there is a fee of 2000 so the output
                    // value is 1058000.
                    const expectedMainUtxo = ethers.utils.solidityKeccak256(
                      ["bytes32", "uint32", "uint64"],
                      [data.sweepTx.hash, 0, 1058000]
                    )

                    expect(mainUtxoHash).to.be.equal(expectedMainUtxo)
                  })

                  it("should update the depositors balances", async () => {
                    // The sum of sweep tx inputs is 1060000 satoshi. The output
                    // value is 1058000 so the fee is 2000. There is 5 deposits
                    // so 400 satoshi fee should be incurred per deposit.
                    expect(
                      await bank.balanceOf(data.deposits[0].reveal.depositor)
                    ).to.be.equal(29600)
                    expect(
                      await bank.balanceOf(data.deposits[1].reveal.depositor)
                    ).to.be.equal(9600)
                    expect(
                      await bank.balanceOf(data.deposits[2].reveal.depositor)
                    ).to.be.equal(209600)
                    expect(
                      await bank.balanceOf(data.deposits[3].reveal.depositor)
                    ).to.be.equal(369600)
                    expect(
                      await bank.balanceOf(data.deposits[4].reveal.depositor)
                    ).to.be.equal(439600)
                  })

                  it("should emit DepositsSwept event", async () => {
                    await expect(tx)
                      .to.emit(bridge, "DepositsSwept")
                      .withArgs(walletPubKeyHash, data.sweepTx.hash)
                  })
                }
              )

              context(
                "when input vector consists only of revealed unswept " +
                  "deposits but there is no main UTXO despite it is expected",
                () => {
                  const previousData: SweepTestData = SingleP2WSHDeposit
                  const data: SweepTestData = {
                    ...MultipleDepositsNoMainUtxo,
                  }

                  before(async () => {
                    await createSnapshot()

                    // Make the first sweep to create an on-chain expectation
                    // that the tested sweep will contain the main UTXO
                    // input.
                    await runSweepScenario(previousData)
                  })

                  after(async () => {
                    await restoreSnapshot()
                  })

                  it("should revert", async () => {
                    // Use sweep data which doesn't reference the main UTXO.
                    // However, pass a correct main UTXO parameter in order
                    // to pass main UTXO validation in the contract.
                    data.mainUtxo = {
                      txHash: previousData.sweepTx.hash,
                      txOutputIndex: 0,
                      txOutputValue: 78000,
                    }

                    await expect(runSweepScenario(data)).to.be.revertedWith(
                      "Expected main UTXO not present in sweep transaction inputs"
                    )
                  })
                }
              )

              context(
                "when input vector contains a revealed but already swept deposit",
                () => {
                  const data: SweepTestData = MultipleDepositsNoMainUtxo

                  before(async () => {
                    await createSnapshot()

                    // Make a proper sweep to turn the tested deposits into
                    // the swept state.
                    await runSweepScenario(data)
                  })

                  after(async () => {
                    await restoreSnapshot()
                  })

                  it("should revert", async () => {
                    // Main UTXO parameter must point to the properly
                    // made sweep to avoid revert at validation stage.
                    const mainUtxo = {
                      txHash: data.sweepTx.hash,
                      txOutputIndex: 0,
                      txOutputValue: 1058000,
                    }

                    // Try replaying the already done sweep.
                    await expect(
                      bridge.submitSweepProof(
                        data.sweepTx,
                        data.sweepProof,
                        mainUtxo
                      )
                    ).to.be.revertedWith("Deposit already swept")
                  })
                }
              )

              context("when input vector contains an unknown input", () => {
                const data: SweepTestData = MultipleDepositsWithMainUtxo

                before(async () => {
                  await createSnapshot()
                })

                after(async () => {
                  await restoreSnapshot()
                })

                it("should revert", async () => {
                  // Used test data contains an actual main UTXO input
                  // but the previous action proof was not submitted on-chain
                  // so input is unknown from contract's perspective.
                  await expect(runSweepScenario(data)).to.be.revertedWith(
                    "Unknown input type"
                  )
                })
              })
            })
          })

          context("when main UTXO data are invalid", () => {
            const previousData: SweepTestData = MultipleDepositsNoMainUtxo
            const data: SweepTestData = JSON.parse(
              JSON.stringify(MultipleDepositsWithMainUtxo)
            )

            before(async () => {
              await createSnapshot()

              // Make the first sweep which is actually the predecessor
              // of the sweep tested within this scenario.
              await runSweepScenario(previousData)
            })

            after(async () => {
              await restoreSnapshot()
            })

            it("should revert", async () => {
              // Forge the main UTXO parameter to force validation crash.
              data.mainUtxo = NO_MAIN_UTXO

              await expect(runSweepScenario(data)).to.be.revertedWith(
                "Invalid main UTXO data"
              )
            })
          })
        })

        context(
          "when wallet public key hash length is other than 20 bytes",
          () => {
            before(async () => {
              await createSnapshot()

              // Necessary to pass the proof validation.
              await relay.setCurrentEpochDifficulty(20870012)
              await relay.setPrevEpochDifficulty(20870012)
            })

            after(async () => {
              await restoreSnapshot()
            })

            it("should revert", async () => {
              // To test this case, an arbitrary transaction with single
              // P2WSH output is used. In that case, the wallet public key
              // hash will have a wrong length of 32 bytes. Used transaction:
              // https://live.blockcypher.com/btc-testnet/tx/af56cae479215c5e44a6a4db0eeb10a1abdd98020a6c01b9c26ea7b829aa2809
              const sweepTx = {
                version: "0x01000000",
                inputVector:
                  "0x01d32586237f6a832c3aa324bb83151e43e6cca2e4312d676f14" +
                  "dbbd6b1f04f4680100000000ffffffff",
                outputVector:
                  "0x012ea3090000000000220020af802a76c10b6a646fff8d358241" +
                  "c121c9be1c53628adb26bd6554631bfc7d8b",
                locktime: "0x00000000",
              }

              const sweepProof = {
                merkleProof:
                  "0xf09955dcfb05b1c369eb9f58b6e583e49f47b9b8d6e63537dcac" +
                  "10bf0cc5407d06e76ee2d75b5be5ec365a4c1272067b786d79a64d" +
                  "c015eb40dedd3c813f4dee40c149ee21036bba713d14b3c22454ef" +
                  "44c958293a015e9e186983f20c46d74a29ca5f705913e210229078" +
                  "af993e89d90bb731dab3c8cf8907d683ab60faca1866036118737e" +
                  "07aaa74d489e80f773b4d9ff2887a4855b805aaf1b5a7a1b0bf382" +
                  "be8dab2401ec758a705b648724f93d14c3b72ce4fb3cd7d414e8a1" +
                  "75ef173e",
                txIndexInBlock: 20,
                bitcoinHeaders:
                  "0x0000e020fbeb3a876746438f1fd793add061b0b7af2f88a387ee" +
                  "f5b38600000000000000933a0cec98a028727df04dafbbe691c8ad" +
                  "442351db7321c9f7cc169aa9f64a9a7af6f361cbcd001a65073028",
              }

              await expect(
                bridge.submitSweepProof(sweepTx, sweepProof, NO_MAIN_UTXO)
              ).to.be.revertedWith(
                "Wallet public key hash should have 20 bytes"
              )
            })
          }
        )
      })

      context("when output count is other than one", () => {
        before(async () => {
          await createSnapshot()

          // Necessary to pass the proof validation.
          await relay.setCurrentEpochDifficulty(1)
          await relay.setPrevEpochDifficulty(1)
        })

        after(async () => {
          await restoreSnapshot()
        })

        it("should revert", async () => {
          // To test this case, an arbitrary transaction with two
          // outputs is used. Used transaction:
          // https://live.blockcypher.com/btc-testnet/tx/af56cae479215c5e44a6a4db0eeb10a1abdd98020a6c01b9c26ea7b829aa2809
          const sweepTx = {
            version: "0x01000000",
            inputVector:
              "0x011d9b71144a3ddbb56dd099ee94e6dd8646d7d1eb37fe1195367e6f" +
              "a844a388e7010000006a47304402206f8553c07bcdc0c3b90631188810" +
              "3d623ca9096ca0b28b7d04650a029a01fcf9022064cda02e39e65ace71" +
              "2029845cfcf58d1b59617d753c3fd3556f3551b609bbb00121039d61d6" +
              "2dcd048d3f8550d22eb90b4af908db60231d117aeede04e7bc11907bfa" +
              "ffffffff",
            outputVector:
              "0x02204e00000000000017a9143ec459d0f3c29286ae5df5fcc421e278" +
              "6024277e87a6c2140000000000160014e257eccafbc07c381642ce6e7e" +
              "55120fb077fbed",
            locktime: "0x00000000",
          }

          const sweepProof = {
            merkleProof:
              "0x161d24e53fc61db783f0271d45ef43b76e69fc975cf38decbba654ae" +
              "3d09f5d1a060c3448c0c06ededa9749e559ffa65e2d5f3abac749b278e" +
              "1189aa5b49a499b032963ea3fad337c4a9c8df4e748865503b5aea083f" +
              "b32efe4dca057a741a020790cde5b50acc2cdbd231e43594036388f1e5" +
              "d20ebba319465c56e85bf4e4b4f8b7276402b6c114000c59149494f852" +
              "84507c253bbc505fec7ea50f370aa150",
            txIndexInBlock: 8,
            bitcoinHeaders:
              "0x00000020fbee5222c9fc99c8071cee3fed39b4c0d39f41075469ce9f" +
              "52000000000000003fd9c72d0611b373ce2b1996e0ebb8bc36dc12d431" +
              "cae5b9371f343111f3d7519015da61ffff001dbddfb528000040208a9f" +
              "e49585b4cd8a94daeeb926c6f1e96151c74ae1ae0b18c6a6d564000000" +
              "0065c05d9ea40cace1b6b0ad0b8a9a18646096b54484fbdd96b1596560" +
              "f6999194a815da612ac0001a2e4c6405",
          }

          await expect(
            bridge.submitSweepProof(sweepTx, sweepProof, NO_MAIN_UTXO)
          ).to.be.revertedWith("Sweep transaction must have a single output")
        })
      })
    })

    context("when transaction proof is not valid", () => {
      context("when input vector is not valid", () => {
        const data: SweepTestData = JSON.parse(
          JSON.stringify(SingleP2SHDeposit)
        )

        before(async () => {
          await createSnapshot()
        })

        after(async () => {
          await restoreSnapshot()
        })

        it("should revert", async () => {
          // Corrupt the input vector by setting a compactSize uint claiming
          // there is no inputs at all.
          data.sweepTx.inputVector =
            "0x0079544f374199c68869ce7df906eeb0ee5c0506a512d903e3900d5752" +
            "e3e080c500000000c847304402205eff3ae003a5903eb33f32737e3442b6" +
            "516685a1addb19339c2d02d400cf67ce0220707435fc2a0577373c63c99d" +
            "242c30bea5959ec180169978d43ece50618fe0ff012103989d253b17a6a0" +
            "f41838b84ff0d20e8898f9d7b1a98f2564da4cc29dcf8581d94c5c14934b" +
            "98637ca318a4d6e7ca6ffd1690b8e77df6377508f9f0c90d000395237576" +
            "a9148db50eb52063ea9d98b3eac91489a90f738986f68763ac6776a914e2" +
            "57eccafbc07c381642ce6e7e55120fb077fbed8804e0250162b175ac68ff" +
            "ffffff"

          await expect(runSweepScenario(data)).to.be.revertedWith(
            "Invalid input vector provided"
          )
        })
      })

      context("when output vector is not valid", () => {
        const data: SweepTestData = JSON.parse(
          JSON.stringify(SingleP2SHDeposit)
        )

        before(async () => {
          await createSnapshot()
        })

        after(async () => {
          await restoreSnapshot()
        })

        it("should revert", async () => {
          // Corrupt the output vector by setting a compactSize uint claiming
          // there is no outputs at all.
          data.sweepTx.outputVector =
            "0x0044480000000000001600148db50eb52063ea9d98b3eac91489a90f73" +
            "8986f6"

          await expect(runSweepScenario(data)).to.be.revertedWith(
            "Invalid output vector provided"
          )
        })
      })

      context("when merkle proof is not valid", () => {
        const data: SweepTestData = JSON.parse(
          JSON.stringify(SingleP2SHDeposit)
        )

        before(async () => {
          await createSnapshot()
        })

        after(async () => {
          await restoreSnapshot()
        })

        it("should revert", async () => {
          // Corrupt the merkle proof by changing tx index in block to an
          // invalid one. The proper one is 36 so any other will do the trick.
          data.sweepProof.txIndexInBlock = 30

          await expect(runSweepScenario(data)).to.be.revertedWith(
            "Tx merkle proof is not valid for provided header and tx hash"
          )
        })
      })

      context("when proof difficulty is not current nor previous", () => {
        const data: SweepTestData = JSON.parse(
          JSON.stringify(SingleP2SHDeposit)
        )

        before(async () => {
          await createSnapshot()
        })

        after(async () => {
          await restoreSnapshot()
        })

        it("should revert", async () => {
          // To pass the proof validation, the difficulty returned by the relay
          // must be 22350181 for test data used in this scenario. Setting
          // a different value will cause difficulty comparison failure.
          data.chainDifficulty = 1

          await expect(runSweepScenario(data)).to.be.revertedWith(
            "Not at current or previous difficulty"
          )
        })
      })

      context("when headers chain length is not valid", () => {
        const data: SweepTestData = JSON.parse(
          JSON.stringify(SingleP2SHDeposit)
        )

        before(async () => {
          await createSnapshot()
        })

        after(async () => {
          await restoreSnapshot()
        })

        it("should revert", async () => {
          // Corrupt the bitcoin headers length in the sweep proof. The proper
          // value is length divisible by 80 so any length violating this
          // rule will cause failure. In this case, we just remove the last
          // byte from proper headers chain.
          const properHeaders = data.sweepProof.bitcoinHeaders.toString()
          data.sweepProof.bitcoinHeaders = properHeaders.substring(
            0,
            properHeaders.length - 2
          )

          await expect(runSweepScenario(data)).to.be.revertedWith(
            "Invalid length of the headers chain"
          )
        })
      })

      context("when headers chain is not valid", () => {
        const data: SweepTestData = JSON.parse(
          JSON.stringify(SingleP2SHDeposit)
        )

        before(async () => {
          await createSnapshot()
        })

        after(async () => {
          await restoreSnapshot()
        })

        it("should revert", async () => {
          // Bitcoin headers must form a chain to pass the proof validation.
          // That means the `previous block hash` encoded in the given block
          // header must match the actual previous header's hash. To test
          // that scenario, we corrupt the `previous block hash` of the
          // second header. Each header is 80 bytes length. First 4 bytes
          // of each header is `version` and 32 subsequent bytes is
          // `previous block hash`. Changing byte 85 of the whole chain will
          // do the work.
          const properHeaders = data.sweepProof.bitcoinHeaders.toString()
          data.sweepProof.bitcoinHeaders = `${properHeaders.substring(
            0,
            170
          )}ff${properHeaders.substring(172)}`

          await expect(runSweepScenario(data)).to.be.revertedWith(
            "Invalid headers chain"
          )
        })
      })

      context("when the work in the header is insufficient", () => {
        const data: SweepTestData = JSON.parse(
          JSON.stringify(SingleP2SHDeposit)
        )

        before(async () => {
          await createSnapshot()
        })

        after(async () => {
          await restoreSnapshot()
        })

        it("should revert", async () => {
          // Each header encodes a `diffuculty target` field in bytes 72-76.
          // The given header's hash (interpreted as uint) must be bigger than
          // the `difficulty target`. To test this scenario, we change the
          // last byte of the last header in such a way their hash becomes
          // lower than their `difficulty target`.
          const properHeaders = data.sweepProof.bitcoinHeaders.toString()
          data.sweepProof.bitcoinHeaders = `${properHeaders.substring(
            0,
            properHeaders.length - 2
          )}ff`

          await expect(runSweepScenario(data)).to.be.revertedWith(
            "Insufficient work in a header"
          )
        })
      })

      context(
        "when accumulated difficulty in headers chain is insufficient",
        () => {
          let otherBridge: Bridge
          const data: SweepTestData = JSON.parse(
            JSON.stringify(SingleP2SHDeposit)
          )

          before(async () => {
            await createSnapshot()

            // Necessary to pass the first part of proof validation.
            await relay.setCurrentEpochDifficulty(data.chainDifficulty)
            await relay.setPrevEpochDifficulty(data.chainDifficulty)

            // Deploy another bridge which has higher `txProofDifficultyFactor`
            // than the original bridge. That means it will need 12 confirmations
            // to deem transaction proof validity. This scenario uses test
            // data which has only 6 confirmations. That should force the
            // failure we expect within this scenario.
            const FraudVerification = await ethers.getContractFactory(
              "FraudVerification"
            )
            const fraudVerification: FraudVerification =
              await FraudVerification.deploy()
            await fraudVerification.deployed()
            const Bridge = await ethers.getContractFactory("BridgeStub", {
              libraries: {
                FraudVerification: fraudVerification.address,
              },
            })
            otherBridge = await Bridge.deploy(
              bank.address,
              relay.address,
              treasury.address,
              12
            )
            await otherBridge.deployed()
          })

          after(async () => {
            await restoreSnapshot()
          })

          it("should revert", async () => {
            await expect(
              otherBridge.submitSweepProof(
                data.sweepTx,
                data.sweepProof,
                data.mainUtxo
              )
            ).to.be.revertedWith(
              "Insufficient accumulated difficulty in header chain"
            )
          })
        }
      )
    })
  })

  describe("requestRedemption", () => {
    context("when wallet state is active", () => {
      const walletPubKeyHash = "0x8db50eb52063ea9d98b3eac91489a90f738986f6"

      before(async () => {
        await createSnapshot()

        // Simulate the wallet is an active one and is known in the system.
        await bridge.setWallet(walletPubKeyHash, {
          state: 1,
          pendingRedemptionsValue: 0,
        })
      })

      after(async () => {
        await restoreSnapshot()
      })

      context("when there is a main UTXO for the given wallet", () => {
        // Prepare a dumb main UTXO with 10M satoshi as value. This will
        // be the wallet BTC balance.
        const mainUtxo = {
          txHash:
            "0x3835ecdee2daa83c9a19b5012104ace55ecab197b5e16489c26d372e475f5d2a",
          txOutputIndex: 0,
          txOutputValue: 10000000,
        }

        before(async () => {
          await createSnapshot()

          // Simulate the prepared main UTXO belongs to the wallet.
          await bridge.setMainUtxo(walletPubKeyHash, mainUtxo)
        })

        after(async () => {
          await restoreSnapshot()
        })

        context("when main UTXO data are valid", () => {
          context("when redeemer output script is standard type", () => {
            context(
              "when redeemer output script does not point to the wallet public key hash",
              () => {
                context("when amount is not below the dust threshold", () => {
                  context(
                    "when there is no pending request for the given redemption key",
                    () => {
                      context("when wallet has sufficient funds", () => {
                        context(
                          "when redeemer made a sufficient allowance in Bank",
                          () => {
                            // Use an arbitrary P2WPKH as redemption output.
                            // TODO: Assert it works for P2PKH, P2SH and P2WSH as well.
                            const redeemerOutputScript =
                              "0x160014f4eedc8f40d4b8e30771f792b065ebec0abaddef"
                            // Requested amount is 3M satoshi.
                            const requestedAmount = BigNumber.from(3000000)

                            let redeemer: SignerWithAddress
                            let initialBridgeBalance: BigNumber
                            let initialRedeemerBalance: BigNumber
                            let initialWalletPendingRedemptionValue: BigNumber
                            let tx: ContractTransaction

                            before(async () => {
                              await createSnapshot()

                              // Use an arbitrary ETH account as redeemer.
                              redeemer = thirdParty

                              // Simulate the redeemer has a TBTC balance of
                              // 5M satoshi.
                              await bank.setBalance(redeemer.address, 5000000)
                              // Redeemer must allow the Bridge to spent the
                              // requested 3M satoshi.
                              await bank
                                .connect(redeemer)
                                .increaseBalanceAllowance(
                                  bridge.address,
                                  requestedAmount
                                )

                              // Capture initial TBTC balance of Bridge and redeemer.
                              initialBridgeBalance = await bank.balanceOf(
                                bridge.address
                              )
                              initialRedeemerBalance = await bank.balanceOf(
                                redeemer.address
                              )

                              // Capture the initial pending redemptions value
                              // for the given wallet.
                              initialWalletPendingRedemptionValue = (
                                await bridge.wallets(walletPubKeyHash)
                              ).pendingRedemptionsValue

                              // Perform the redemption request.
                              tx = await bridge
                                .connect(redeemer)
                                .requestRedemption(
                                  walletPubKeyHash,
                                  mainUtxo,
                                  redeemerOutputScript,
                                  requestedAmount
                                )
                            })

                            after(async () => {
                              await restoreSnapshot()
                            })

                            it("should increase the wallet's pending redemptions value", async () => {
                              const walletPendingRedemptionValue = (
                                await bridge.wallets(walletPubKeyHash)
                              ).pendingRedemptionsValue
                              const treasuryFee =
                                await bridge.redemptionTreasuryFee()
                              expect(
                                walletPendingRedemptionValue.sub(
                                  initialWalletPendingRedemptionValue
                                )
                              ).to.be.equal(requestedAmount.sub(treasuryFee))
                            })

                            it("should store the redemption request", async () => {
                              const redemptionKey = buildRedemptionKey(
                                walletPubKeyHash,
                                redeemerOutputScript
                              )

                              const redemptionRequest =
                                await bridge.pendingRedemptions(redemptionKey)

                              expect(redemptionRequest.redeemer).to.be.equal(
                                redeemer.address
                              )
                              expect(
                                redemptionRequest.requestedAmount
                              ).to.be.equal(requestedAmount)
                              expect(redemptionRequest.treasuryFee).to.be.equal(
                                await bridge.redemptionTreasuryFee()
                              )
                              expect(redemptionRequest.txMaxFee).to.be.equal(
                                await bridge.redemptionTxMaxFee()
                              )
                              expect(redemptionRequest.requestedAt).to.be.equal(
                                await lastBlockTime()
                              )
                            })

                            it("should emit RedemptionRequested event", async () => {
                              await expect(tx)
                                .to.emit(bridge, "RedemptionRequested")
                                .withArgs(
                                  walletPubKeyHash,
                                  redeemerOutputScript,
                                  redeemer.address,
                                  requestedAmount,
                                  await bridge.redemptionTreasuryFee(),
                                  await bridge.redemptionTxMaxFee()
                                )
                            })

                            it("should take the right TBTC balance from Bank", async () => {
                              const bridgeBalance = await bank.balanceOf(
                                bridge.address
                              )
                              expect(
                                bridgeBalance.sub(initialBridgeBalance)
                              ).to.equal(requestedAmount)

                              const redeemerBalance = await bank.balanceOf(
                                redeemer.address
                              )
                              expect(
                                redeemerBalance.sub(initialRedeemerBalance)
                              ).to.equal(requestedAmount.mul(-1))
                            })
                          }
                        )

                        context(
                          "when redeemer has not made a sufficient allowance in Bank",
                          () => {
                            it("should revert", async () => {
                              // TODO: Implementation.
                            })
                          }
                        )
                      })

                      context("when wallet has insufficient funds", () => {
                        it("should revert", async () => {
                          // TODO: Implementation.
                        })
                      })
                    }
                  )

                  context(
                    "when there is a pending request for the given redemption key",
                    () => {
                      it("should revert", async () => {
                        // TODO: Implementation.
                      })
                    }
                  )
                })

                context("when amount is below the dust threshold", () => {
                  it("should revert", async () => {
                    // TODO: Implementation.
                  })
                })
              }
            )

            context(
              "when redeemer output script points to the wallet public key hash",
              () => {
                it("should revert", async () => {
                  // TODO: Implementation. Make sure there is not possibility
                  //       to pass the 20-byte wallet PKH under P2PKH, P2WPKH
                  //       and P2SH.
                })
              }
            )
          })

          context("when redeemer output script is not standard type", () => {
            it("should revert", async () => {
              // TODO: Implementation.
            })
          })
        })

        context("when main UTXO data are invalid", () => {
          it("should revert", async () => {
            // TODO: Implementation.
          })
        })
      })

      context("when there is no main UTXO for the given wallet", () => {
        it("should revert", async () => {
          // TODO: Implementation.
        })
      })
    })

    context("when wallet state is other than Active", () => {
      it("should revert", async () => {
        // TODO: Implementation. Make sure we check each other state in
        //       separate sub-contexts.
      })
    })
  })

  describe("submitRedemptionProof", () => {
    context("when transaction proof is valid", () => {
      context("when there is a main UTXO for the given wallet", () => {
        context("when main UTXO data are valid", () => {
          context("when there is only one input", () => {
            context(
              "when the single input points to the wallet's main UTXO",
              () => {
                context("when wallet state is Active", () => {
                  context("when there is only one output", () => {
                    context(
                      "when the single output is a pending requested redemption",
                      () => {
                        // TODO: Implementation.
                      }
                    )

                    context(
                      "when the single output is a non-reported timed out requested redemption",
                      () => {
                        // TODO: Implementation.
                      }
                    )

                    context(
                      "when the single output is a reported timed out requested redemption",
                      () => {
                        // TODO: Implementation.
                      }
                    )

                    context(
                      "when the single output is a pending requested redemption but amount is wrong",
                      () => {
                        it("should revert", async () => {
                          // TODO: Implementation.
                        })
                      }
                    )

                    context(
                      "when the single output is a timed out requested redemption but amount is wrong",
                      () => {
                        it("should revert", async () => {
                          // TODO: Implementation.
                        })
                      }
                    )

                    context(
                      "when the single output is a legal P2PKH change with a non-zero value",
                      () => {
                        // Should be deemed as valid change though rejected
                        // because this change is a single output.
                        it("should revert", async () => {
                          // TODO: Implementation.
                        })
                      }
                    )

                    context(
                      "when the single output is a legal P2WPKH change with a non-zero value",
                      () => {
                        // Should be deemed as valid change though rejected
                        // because this change is a single output.
                        it("should revert", async () => {
                          // TODO: Implementation.
                        })
                      }
                    )

                    context(
                      "when the single output is an illegal P2SH change with a non-zero value",
                      () => {
                        // We have this case because P2SH script has a 20-byte
                        // payload which may match the 20-byte wallet public
                        // key hash though it should be always rejected as
                        // non-requested output. There is no need to check for
                        // P2WSH since the payload is always 32-byte there.
                        it("should revert", async () => {
                          // TODO: Implementation.
                        })
                      }
                    )

                    context(
                      "when the single output is a change with a zero as value",
                      () => {
                        it("should revert", async () => {
                          // TODO: Implementation.
                        })
                      }
                    )

                    context(
                      "when the single output is a non-requested redemption to an arbitrary script hash",
                      () => {
                        it("should revert", async () => {
                          // TODO: Implementation.
                        })
                      }
                    )

                    context(
                      "when the single output is provably unspendable OP_RETURN",
                      () => {
                        it("should revert", async () => {
                          // TODO: Implementation.
                        })
                      }
                    )
                  })

                  context("when there are multiple outputs", () => {
                    context(
                      "when output vector consists only of pending requested redemptions",
                      () => {
                        // TODO: Implementation.
                      }
                    )

                    context(
                      "when output vector consists of pending requested redemptions and a non-zero change",
                      () => {
                        const data: RedemptionTestData =
                          MultiplePendingRequestedRedemptionsWithChange

                        let tx: ContractTransaction
                        let bridgeBalance: RedemptionBalanceChange
                        let walletPendingRedemptionsValue: RedemptionBalanceChange
                        let treasuryBalance: RedemptionBalanceChange
                        let redeemersBalances: RedemptionBalanceChange[]

                        before(async () => {
                          await createSnapshot()

                          // eslint-disable-next-line @typescript-eslint/no-extra-semi
                          ;({
                            tx,
                            bridgeBalance,
                            walletPendingRedemptionsValue,
                            treasuryBalance,
                            redeemersBalances,
                          } = await runRedemptionScenario(data))
                        })

                        after(async () => {
                          await restoreSnapshot()
                        })

                        it("should close processed redemption requests", async () => {
                          for (
                            let i = 0;
                            i < data.redemptionRequests.length;
                            i++
                          ) {
                            const redemptionRequest =
                              // eslint-disable-next-line no-await-in-loop
                              await bridge.pendingRedemptions(
                                buildRedemptionKey(
                                  data.wallet.pubKeyHash,
                                  data.redemptionRequests[i]
                                    .redeemerOutputScript
                                )
                              )

                            expect(redemptionRequest.requestedAt).to.be.equal(
                              0,
                              `Redemption request with index ${i} has not been closed`
                            )
                          }
                        })

                        it("should update the wallet's main UTXO", async () => {
                          // Change index and value can be taken by exploring
                          // the redemption transaction structure and getting
                          // the output pointing back to wallet PKH.
                          const expectedMainUtxoHash = buildMainUtxoHash(
                            data.redemptionTx.hash,
                            5,
                            137130866
                          )

                          expect(
                            await bridge.mainUtxos(data.wallet.pubKeyHash)
                          ).to.be.equal(expectedMainUtxoHash)
                        })

                        it("should decrease the wallet's pending redemptions value", async () => {
                          expect(
                            walletPendingRedemptionsValue.afterProof.sub(
                              walletPendingRedemptionsValue.beforeProof
                            )
                          ).to.equal(-6434567)
                        })

                        it("should decrease Bridge's balance in Bank", async () => {
                          // Balance should be decreased by the total
                          // redeemable amount. See docs of the used test
                          // data for details.
                          await expect(tx)
                            .to.emit(bank, "BalanceDecreased")
                            .withArgs(bridge.address, 6434567)
                          // However, the total balance change of the
                          // Bridge should also consider the treasury
                          // fee collected upon requests and transferred
                          // to the treasury at the end of the proof.
                          // This is why the total Bridge's balance change
                          // is equal to the total requested amount for
                          // all requests. See docs of the used test data
                          // for details.
                          expect(
                            bridgeBalance.afterProof.sub(
                              bridgeBalance.beforeProof
                            )
                          ).to.equal(-6934567)
                        })

                        it("should transfer collected treasury fee", async () => {
                          // Treasury balance should be increased by the total
                          // treasury fee for all requests. See docs of the
                          // used test data for details.
                          expect(
                            treasuryBalance.afterProof.sub(
                              treasuryBalance.beforeProof
                            )
                          ).to.equal(500000)
                        })

                        it("should not change redeemers balances in any way", async () => {
                          for (
                            let i = 0;
                            i < data.redemptionRequests.length;
                            i++
                          ) {
                            const redeemerBalance = redeemersBalances[i]

                            expect(
                              redeemerBalance.afterProof.sub(
                                redeemerBalance.beforeProof
                              )
                            ).to.be.equal(
                              0,
                              `Balance of redeemer with index ${i} has changed`
                            )
                          }
                        })
                      }
                    )

                    context(
                      "when output vector consists only of timed out requested redemptions",
                      () => {
                        // TODO: Implementation.
                      }
                    )

                    context(
                      "when output vector consists of timed out requested redemptions and a non-zero change",
                      () => {
                        // TODO: Implementation.
                      }
                    )

                    context(
                      "when output vector consists of pending requested redemptions and timed out requested redemptions",
                      () => {
                        // TODO: Implementation.
                      }
                    )

                    context(
                      "when output vector consists of pending requested redemptions, timed out requested redemptions and a non-zero change",
                      () => {
                        // TODO: Implementation.
                      }
                    )

                    context(
                      "when output vector contains a pending requested redemption with wrong amount",
                      () => {
                        it("should revert", async () => {
                          // TODO: Implementation.
                        })
                      }
                    )

                    context(
                      "when output vector contains a timed out requested redemption with wrong amount",
                      () => {
                        it("should revert", async () => {
                          // TODO: Implementation.
                        })
                      }
                    )

                    context(
                      "when output vector contains a non-zero P2SH change output",
                      () => {
                        // We have this case because P2SH script has a 20-byte
                        // payload which may match the 20-byte wallet public
                        // key hash though it should be always rejected as
                        // non-requested output. There is no need to check for
                        // P2WSH since the payload is always 32-byte there.
                        it("should revert", async () => {
                          // TODO: Implementation.
                        })
                      }
                    )

                    context(
                      "when output vector contains multiple non-zero change outputs",
                      () => {
                        it("should revert", async () => {
                          // TODO: Implementation.
                        })
                      }
                    )

                    context(
                      "when output vector contains one change but with zero as value",
                      () => {
                        it("should revert", async () => {
                          // TODO: Implementation.
                        })
                      }
                    )

                    context(
                      "when output vector contains a non-requested redemption to an arbitrary script hash",
                      () => {
                        it("should revert", async () => {
                          // TODO: Implementation.
                        })
                      }
                    )

                    context(
                      "when output vector contains a provably unspendable OP_RETURN output",
                      () => {
                        it("should revert", async () => {
                          // TODO: Implementation.
                        })
                      }
                    )
                  })
                })

                context("when wallet state is MovingFunds", () => {
                  // TODO: Just assert it passes without revert without
                  //       repeating checks from Active state scenario.
                })

                context(
                  "when wallet state is neither Active nor MovingFunds",
                  () => {
                    it("should revert", async () => {
                      // TODO: Implementation. Make sure we check each other
                      //       state in a separate sub-context.
                    })
                  }
                )
              }
            )

            context(
              "when the single input doesn't point to the wallet's main UTXO",
              () => {
                it("should revert", async () => {
                  // TODO: Implementation.
                })
              }
            )
          })

          context("when input count is other than one", () => {
            it("should revert", async () => {
              // TODO: Implementation.
            })
          })
        })

        context("when main UTXO data are invalid", () => {
          it("should revert", async () => {
            // TODO: Implementation.
          })
        })
      })

      context("when there is no main UTXO for the given wallet", () => {
        it("should revert", async () => {
          // TODO: Implementation.
        })
      })
    })

    context("when transaction proof is not valid", () => {
      context("when input vector is not valid", () => {
        it("should revert", async () => {
          // TODO: Implementation.
        })
      })

      context("when output vector is not valid", () => {
        it("should revert", async () => {
          // TODO: Implementation.
        })
      })

      context("when merkle proof is not valid", () => {
        it("should revert", async () => {
          // TODO: Implementation.
        })
      })

      context("when proof difficulty is not current nor previous", () => {
        it("should revert", async () => {
          // TODO: Implementation.
        })
      })

      context("when headers chain length is not valid", () => {
        it("should revert", async () => {
          // TODO: Implementation.
        })
      })

      context("when headers chain is not valid", () => {
        it("should revert", async () => {
          // TODO: Implementation.
        })
      })

      context("when the work in the header is insufficient", () => {
        it("should revert", async () => {
          // TODO: Implementation.
        })
      })

      context(
        "when accumulated difficulty in headers chain is insufficient",
        () => {
          it("should revert", async () => {
            // TODO: Implementation.
          })
        }
      )
    })
  })

  describe("submitFraudChallenge", () => {
    const fraudChallengeDepositAmount = ethers.utils.parseEther("2")

    // r and s values were extracted from signature with DER format:
    // 3045022100be367625b075362d13a46a71e91e99b633ab476d6e76870c6daaa078
    // 991e41b50220041e65394627554cf832d073c47760e96ca5f3a554c01cf7b1d96d
    // 79c200202a01
    const r =
      "0xbe367625b075362d13a46a71e91e99b633ab476d6e76870c6daaa078991e41b5"
    const s =
      "0x041e65394627554cf832d073c47760e96ca5f3a554c01cf7b1d96d79c200202a"
    const v = 27

    const sighash =
      "0xb8994753efd78cc66075991d3a21beef96d4e8a5e9ff06bc692401203df02610"

    // Uncompressed and unprefixed version of the public key:
    // 03989d253b17a6a0f41838b84ff0d20e8898f9d7b1a98f2564da4cc29dcf8581d9
    const walletPublicKey =
      "0x989d253b17a6a0f41838b84ff0d20e8898f9d7b1a98f2564da4cc29dcf8581d9" +
      "d218b65e7d91c752f7b22eaceb771a9af3a6f3d3f010a5d471a1aeef7d7713af"

    // Hash 160 of the public key:
    // 03989d253b17a6a0f41838b84ff0d20e8898f9d7b1a98f2564da4cc29dcf8581d9
    const walletPubKeyHash = "0x8db50eb52063ea9d98b3eac91489a90f738986f6"

    context("when the amount of sent ether is too small", () => {
      before(async () => {
        await createSnapshot()
        await bridge
          .connect(governance)
          .setFraudChallengeDepositAmount(fraudChallengeDepositAmount)
      })

      after(async () => {
        await restoreSnapshot()
      })

      it("should revert", async () => {
        await expect(
          bridge
            .connect(thirdParty)
            .submitFraudChallenge(walletPublicKey, walletPubKeyHash, sighash, v, r, s, {
              value: fraudChallengeDepositAmount.sub(1),
            })
        ).to.be.revertedWith("The amount of ETH deposited is too low")
      })
    })

    context("when incorrect wallet public key is used", () => {
      const incorrectWalletPublicKey =
        "0x9d61d62dcd048d3f8550d22eb90b4af908db60231d117aeede04e7bc11907bf" +
        "a5a3d0aa5ca31521e6efb5e643aa161a3ea770cb30c98e7d3e290c9315b67d149"

      before(async () => {
        await createSnapshot()
        await bridge
          .connect(governance)
          .setFraudChallengeDepositAmount(fraudChallengeDepositAmount)
      })

      after(async () => {
        await restoreSnapshot()
      })

      it("should revert", async () => {
        await expect(
          bridge
            .connect(thirdParty)
            .submitFraudChallenge(incorrectWalletPublicKey, walletPubKeyHash, sighash, v, r, s, {
              value: fraudChallengeDepositAmount,
            })
        ).to.be.revertedWith("Signature verification failure")
      })
    })

    context("when incorrect sighash is used", () => {
      const incorrectSighash =
        "0x9e8e249791a5636e5e007fc15487b5a5bd6e60f73f7e236a7025cd63b904650b"

      before(async () => {
        await createSnapshot()
        await bridge
          .connect(governance)
          .setFraudChallengeDepositAmount(fraudChallengeDepositAmount)
      })

      after(async () => {
        await restoreSnapshot()
      })

      it("should revert", async () => {
        await expect(
          bridge
            .connect(thirdParty)
            .submitFraudChallenge(walletPublicKey, walletPubKeyHash, incorrectSighash, v, r, s, {
              value: fraudChallengeDepositAmount,
            })
        ).to.be.revertedWith("Signature verification failure")
      })
    })

    context("when incorrect recovery ID is used", () => {
      const incorrectV = v + 1

      before(async () => {
        await createSnapshot()
        await bridge
          .connect(governance)
          .setFraudChallengeDepositAmount(fraudChallengeDepositAmount)
      })

      after(async () => {
        await restoreSnapshot()
      })

      it("should revert", async () => {
        await expect(
          bridge
            .connect(thirdParty)
            .submitFraudChallenge(walletPublicKey, walletPubKeyHash, sighash, incorrectV, r, s, {
              value: fraudChallengeDepositAmount,
            })
        ).to.be.revertedWith("Signature verification failure")
      })
    })

    context("when incorrect signature data is used", () => {
      // just swap r and s
      const incorrectS = r
      const incorrectR = s

      before(async () => {
        await createSnapshot()
        await bridge
          .connect(governance)
          .setFraudChallengeDepositAmount(fraudChallengeDepositAmount)
      })

      after(async () => {
        await restoreSnapshot()
      })

      it("should revert", async () => {
        await expect(
          bridge
            .connect(thirdParty)
            .submitFraudChallenge(
              walletPublicKey,
              walletPubKeyHash,
              sighash,
              v,
              incorrectR,
              incorrectS,
              {
                value: fraudChallengeDepositAmount,
              }
            )
        ).to.be.revertedWith("Signature verification failure")
      })
    })

    context("when the same fraud challenge called twice", () => {
      before(async () => {
        await createSnapshot()
        await bridge
          .connect(governance)
          .setFraudChallengeDepositAmount(fraudChallengeDepositAmount)
        await bridge
          .connect(thirdParty)
          .submitFraudChallenge(walletPublicKey, walletPubKeyHash, sighash, v, r, s, {
            value: fraudChallengeDepositAmount,
          })
      })

      after(async () => {
        await restoreSnapshot()
      })

      it("should revert", async () => {
        await expect(
          bridge
            .connect(thirdParty)
            .submitFraudChallenge(walletPublicKey, walletPubKeyHash, sighash, v, r, s, {
              value: fraudChallengeDepositAmount,
            })
        ).to.be.revertedWith("Fraud already challenged")
      })
    })

    context(
      "when the provided data is correct and amount of ether sent is enough",
      () => {
        let tx: Transaction

        before(async () => {
          await createSnapshot()
          await bridge
            .connect(governance)
            .setFraudChallengeDepositAmount(fraudChallengeDepositAmount)
          tx = await bridge
            .connect(thirdParty)
            .submitFraudChallenge(walletPublicKey, walletPubKeyHash, sighash, v, r, s, {
              value: fraudChallengeDepositAmount,
            })
        })

        after(async () => {
          await restoreSnapshot()
        })

        it("should transfer ether from the caller to the bridge", async () => {
          await expect(tx).to.changeEtherBalance(
            thirdParty,
            fraudChallengeDepositAmount.mul(-1)
          )
          await expect(tx).to.changeEtherBalance(
            bridge,
            fraudChallengeDepositAmount
          )
        })

        it("should store the fraud challenge data", async () => {
          const challengeKey = buildChallengeKey(
            walletPublicKey,
            sighash,
            v,
            r,
            s
          )
          const fraudChallenge = await bridge.fraudChallenges(challengeKey)
          expect(fraudChallenge.challenger).to.equal(
            await thirdParty.getAddress()
          )
          expect(fraudChallenge.ethDepositAmount).to.equal(
            fraudChallengeDepositAmount
          )
          expect(fraudChallenge.reportedAt).to.equal(await lastBlockTime())
          expect(fraudChallenge.defended).to.equal(false)
        })

        it("should emit FraudChallengeSubmitted event", async () => {
          await expect(tx)
            .to.emit(bridge, "FraudChallengeSubmitted")
            .withArgs(walletPublicKey, walletPubKeyHash, sighash, v, r, s)
        })
      }
    )
  })

  describe("submitFraudChallengeResponse", () => {
    const fraudChallengeDepositAmount = ethers.utils.parseEther("2")
    // Uncompressed and unprefixed version of the public key:
    // 03989d253b17a6a0f41838b84ff0d20e8898f9d7b1a98f2564da4cc29dcf8581d9
    const walletPublicKey =
      "0x989d253b17a6a0f41838b84ff0d20e8898f9d7b1a98f2564da4cc29dcf8581d9" +
      "d218b65e7d91c752f7b22eaceb771a9af3a6f3d3f010a5d471a1aeef7d7713af"

    // Hash 160 of the public key:
    // 03989d253b17a6a0f41838b84ff0d20e8898f9d7b1a98f2564da4cc29dcf8581d9
    const walletPubKeyHash = "0x8db50eb52063ea9d98b3eac91489a90f738986f6"

    context("when the transaction has only one input", () => {
      context("when the transaction input comes from P2WSH", () => {
        context(
          "when there was a challenge and the response data is correct",
          () => {
            // r and s values were extracted from signature with DER format:
            // 3045022100be367625b075362d13a46a71e91e99b633ab476d6e76870c6daaa078
            // 991e41b50220041e65394627554cf832d073c47760e96ca5f3a554c01cf7b1d96d
            // 79c200202a01
            const r =
              "0xbe367625b075362d13a46a71e91e99b633ab476d6e76870c6daaa078991e41b5"
            const s =
              "0x041e65394627554cf832d073c47760e96ca5f3a554c01cf7b1d96d79c200202a"
            const v = 27

            // From tx eccc55030fb7c3c7eda6d12d69014aa55bb6a942997e388c4aadb0930facb4cb
            const preimage =
              "0x01000000bb7f55b88160c46023b4f2f5356df30e6032f0cc4ebb896462a11be4a0" +
              "1b9a523bb13029ce7b1f559ef5e747fcac439f1455a2ec7c5f09b72290795e7066" +
              "5044cbb4ac0f93b0ad4a8c387e9942a9b65ba54a01692dd1a6edc7c3b70f0355cc" +
              "ec000000005c14934b98637ca318a4d6e7ca6ffd1690b8e77df6377508f9f0c90d" +
              "000395237576a9148db50eb52063ea9d98b3eac91489a90f738986f68763ac6776" +
              "a914e257eccafbc07c381642ce6e7e55120fb077fbed8804e0250162b175ac68f0" +
              "55000000000000fffffffff5ef547c0c70b4a4747f180b1cc244b99a3d2c12e71d" +
              "73d68ca9da53591139f10000000001000000"

            const sighash =
              "0xb8994753efd78cc66075991d3a21beef96d4e8a5e9ff06bc692401203df02610"

            let tx: Transaction

            before(async () => {
              await createSnapshot()
              await bridge
                .connect(governance)
                .setFraudChallengeDepositAmount(fraudChallengeDepositAmount)
              await bridge
                .connect(thirdParty)
                .submitFraudChallenge(walletPublicKey, walletPubKeyHash, sighash, v, r, s, {
                  value: fraudChallengeDepositAmount,
                })
              tx = await bridge
                .connect(thirdParty)
                .submitFraudChallengeResponse(
                  walletPublicKey,
                  preimage,
                  v,
                  r,
                  s,
                  true
                )
            })

            after(async () => {
              await restoreSnapshot()
            })

            it("should emit FraudChallengeDefended event", async () => {
              await expect(tx)
                .to.emit(bridge, "FraudChallengeDefended")
                .withArgs(walletPublicKey, sighash, v, r, s)
            })
          }
        )
      })

      context("when the transaction input comes from P2SH", () => {
        context(
          "when there was a challenge and the response data is correct",
          () => {
            const r =
              "0x918157d51c1c74858b577d039f0a936aea6236c2510cf31828d1025e4dfd803d"
            const s =
              "0x27905b4bd56fa9a2ee15c2bc4478bccb83dd8340db272ec5fad5b3b4faf32fcd"
            const v = 28

            // From tx 25725b6110fdd095282e61f714e72ec14ebdba7d2c29e93a89a9fb11504a5f10
            const preimage =
              "0x0100000001fb26e52365437fc4fce01864d1303e0e1ed2824ef83345ea6e8517" +
              "4060778acb000000005c14934b98637ca318a4d6e7ca6ffd1690b8e77df6377508" +
              "f9f0c90d000395237576a9148db50eb52063ea9d98b3eac91489a90f738986f687" +
              "63ac6776a914e257eccafbc07c381642ce6e7e55120fb077fbed8804e0250162b1" +
              "75ac68ffffffff01b8240000000000001600148db50eb52063ea9d98b3eac91489" +
              "a90f738986f60000000001000000"

            const sighash =
              "0x5d09cd07392c7163335b67eacc999491a3794c15b88e2b59094be5c5b157064b"

            let tx: Transaction

            before(async () => {
              await createSnapshot()
              await bridge
                .connect(governance)
                .setFraudChallengeDepositAmount(fraudChallengeDepositAmount)
              await bridge
                .connect(thirdParty)
                .submitFraudChallenge(walletPublicKey, walletPubKeyHash, sighash, v, r, s, {
                  value: fraudChallengeDepositAmount,
                })
              tx = await bridge
                .connect(thirdParty)
                .submitFraudChallengeResponse(
                  walletPublicKey,
                  preimage,
                  v,
                  r,
                  s,
                  false
                )
            })

            after(async () => {
              await restoreSnapshot()
            })

            it.only("should emit FraudChallengeDefended event", async () => {
              await expect(tx)
                .to.emit(bridge, "FraudChallengeDefended")
                .withArgs(walletPublicKey, sighash, v, r, s)
            })
          }
        )
      })
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

    return bridge.submitSweepProof(data.sweepTx, data.sweepProof, data.mainUtxo)
  }

  async function runRedemptionScenario(data: RedemptionTestData): Promise<{
    tx: ContractTransaction
    bridgeBalance: RedemptionBalanceChange
    walletPendingRedemptionsValue: RedemptionBalanceChange
    treasuryBalance: RedemptionBalanceChange
    redeemersBalances: RedemptionBalanceChange[]
  }> {
    await relay.setCurrentEpochDifficulty(data.chainDifficulty)
    await relay.setPrevEpochDifficulty(data.chainDifficulty)

    // Simulate the wallet is an active one and is known in the system.
    await bridge.setWallet(data.wallet.pubKeyHash, {
      state: data.wallet.state,
      pendingRedemptionsValue: data.wallet.pendingRedemptionsValue,
    })
    // Simulate the prepared main UTXO belongs to the wallet.
    await bridge.setMainUtxo(data.wallet.pubKeyHash, data.mainUtxo)

    for (let i = 0; i < data.redemptionRequests.length; i++) {
      const { redeemer, redeemerOutputScript, amount } =
        data.redemptionRequests[i]

      /* eslint-disable no-await-in-loop */
      const redeemerSigner = await impersonateAccount(redeemer, {
        from: governance,
        value: null, // use default value
      })
      // Simulate the redeemer has a TBTC balance allowing to make the request.
      await bank.setBalance(redeemer, amount)
      // Redeemer must allow the Bridge to spent the requested amount.
      await bank
        .connect(redeemerSigner)
        .increaseBalanceAllowance(bridge.address, amount)

      await bridge
        .connect(redeemerSigner)
        .requestRedemption(
          data.wallet.pubKeyHash,
          data.mainUtxo,
          redeemerOutputScript,
          amount
        )
      /* eslint-enable no-await-in-loop */
    }

    const bridgeBalanceBeforeProof = await bank.balanceOf(bridge.address)
    const walletPendingRedemptionsValueBeforeProof = (
      await bridge.wallets(data.wallet.pubKeyHash)
    ).pendingRedemptionsValue
    const treasuryBalanceBeforeProof = await bank.balanceOf(treasury.address)

    const redeemersBalancesBeforeProof = []
    for (let i = 0; i < data.redemptionRequests.length; i++) {
      const { redeemer } = data.redemptionRequests[i]
      // eslint-disable-next-line no-await-in-loop
      redeemersBalancesBeforeProof.push(await bank.balanceOf(redeemer))
    }

    const tx = await bridge.submitRedemptionProof(
      data.redemptionTx,
      data.redemptionProof,
      data.mainUtxo,
      data.wallet.pubKeyHash
    )

    const bridgeBalanceAfterProof = await bank.balanceOf(bridge.address)
    const walletPendingRedemptionsValueAfterProof = (
      await bridge.wallets(data.wallet.pubKeyHash)
    ).pendingRedemptionsValue
    const treasuryBalanceAfterProof = await bank.balanceOf(treasury.address)

    const redeemersBalances = []
    for (let i = 0; i < data.redemptionRequests.length; i++) {
      const { redeemer } = data.redemptionRequests[i]
      redeemersBalances.push({
        beforeProof: redeemersBalancesBeforeProof[i],
        // eslint-disable-next-line no-await-in-loop
        afterProof: await bank.balanceOf(redeemer),
      })
    }

    return {
      tx,
      bridgeBalance: {
        beforeProof: bridgeBalanceBeforeProof,
        afterProof: bridgeBalanceAfterProof,
      },
      walletPendingRedemptionsValue: {
        beforeProof: walletPendingRedemptionsValueBeforeProof,
        afterProof: walletPendingRedemptionsValueAfterProof,
      },
      treasuryBalance: {
        beforeProof: treasuryBalanceBeforeProof,
        afterProof: treasuryBalanceAfterProof,
      },
      redeemersBalances,
    }
  }

  function buildRedemptionKey(
    walletPubKeyHash: BytesLike,
    redeemerOutputScript: BytesLike
  ): string {
    return ethers.utils.solidityKeccak256(
      ["bytes20", "bytes"],
      [walletPubKeyHash, redeemerOutputScript]
    )
  }

  function buildChallengeKey(
    walletPublicKey: BytesLike,
    sighash: BytesLike,
    v: number,
    r: BytesLike,
    s: BytesLike
  ): string {
    return ethers.utils.solidityKeccak256(
      ["bytes", "bytes32", "uint8", "bytes32", "bytes32"],
      [walletPublicKey, sighash, v, r, s]
    )
  }

  function buildMainUtxoHash(
    txHash: BytesLike,
    txOutputIndex: BigNumberish,
    txOutputValue: BigNumberish
  ): string {
    return ethers.utils.solidityKeccak256(
      ["bytes32", "uint32", "uint64"],
      [txHash, txOutputIndex, txOutputValue]
    )
  }
})
