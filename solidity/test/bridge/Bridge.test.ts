/* eslint-disable @typescript-eslint/no-unused-expressions */

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
  Fraud,
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
  MultiplePendingRequestedRedemptions,
  MultiplePendingRequestedRedemptionsWithP2WPKHChange,
  RedemptionBalanceChange,
  RedemptionTestData,
  SingleP2PKHChange,
  SingleP2SHChange,
  SingleP2WPKHChange,
  SingleP2WPKHChangeZeroValue,
  SingleNonRequestedRedemption,
  SinglePendingRequestedRedemption,
  SingleProvablyUnspendable,
  MultiplePendingRequestedRedemptionsWithP2SHChange,
  MultiplePendingRequestedRedemptionsWithMultipleP2WPKHChanges,
  MultiplePendingRequestedRedemptionsWithP2WPKHChangeZeroValue,
  MultiplePendingRequestedRedemptionsWithNonRequestedRedemption,
  MultiplePendingRequestedRedemptionsWithProvablyUnspendable,
  MultiplePendingRequestedRedemptionsWithMultipleInputs,
} from "../data/redemption"
import {
  fraudWalletPublicKey,
  fraudWalletPublicKeyHash,
  nonWitnessSignSingleInputTx,
  nonWitnessSignMultipleInputsTx,
  witnessSignSingleInputTx,
} from "../data/fraud"
import { BridgeStub__factory } from "../../typechain"

const { createSnapshot, restoreSnapshot } = helpers.snapshot
const { lastBlockTime, increaseTime } = helpers.time
const { impersonateAccount } = helpers.account

const ZERO_ADDRESS = ethers.constants.AddressZero
const ZERO_32_BYTES =
  "0x0000000000000000000000000000000000000000000000000000000000000000"

const fixture = async () => {
  const [deployer, governance, thirdParty, treasury] = await ethers.getSigners()

  const Bank = await ethers.getContractFactory("BankStub")
  const bank: Bank & BankStub = await Bank.deploy()
  await bank.deployed()

  const TestRelay = await ethers.getContractFactory("TestRelay")
  const relay: TestRelay = await TestRelay.deploy()
  await relay.deployed()

  const Fraud = await ethers.getContractFactory("Fraud")
  const fraud: Fraud = await Fraud.deploy()
  await fraud.deployed()

  const BitcoinTx = await ethers.getContractFactory("BitcoinTx")
  const bitcoinTx = await BitcoinTx.deploy()
  await bitcoinTx.deployed()

  const Bridge = await ethers.getContractFactory("BridgeStub", {
    libraries: {
      Fraud: fraud.address,
      BitcoinTx: bitcoinTx.address,
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

  // Set the deposit dust threshold to 0.0001 BTC, i.e. 100x smaller than
  // the initial value in the Bridge in order to save test Bitcoins.
  await bridge.setDepositDustThreshold(10000)
  // Set the deposit transaction max fee to 10000 satoshi, i.e. 10x bigger than
  // the initial value in the Bridge. This is required because `depositTxMaxFee`
  // was introduced after BTC testnet transactions used in sweep tests were
  // created and many of them used a high fee to speed up mining. A bigger
  // value of this parameter gives more flexibility in general.
  await bridge.setDepositTxMaxFee(10000)
  // Set the redemption dust threshold to 0.001 BTC, i.e. 10x smaller than
  // the initial value in the Bridge in order to save test Bitcoins.
  await bridge.setRedemptionDustThreshold(100000)

  return {
    governance,
    thirdParty,
    treasury,
    bank,
    relay,
    Bridge,
    bridge,
  }
}

describe("Bridge", () => {
  let governance: SignerWithAddress
  let thirdParty: SignerWithAddress
  let treasury: SignerWithAddress

  let bank: Bank & BankStub
  let relay: TestRelay
  let Bridge: BridgeStub__factory
  let bridge: Bridge & BridgeStub

  before(async () => {
    // eslint-disable-next-line @typescript-eslint/no-extra-semi
    ;({ governance, thirdParty, treasury, bank, relay, Bridge, bridge } =
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

  // TODO: Add unit tests for the other fraud parameters
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
          context("when amount is not below the dust threshold", () => {
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

                // Depositor address, same as in `reveal.depositor`.
                expect(deposit.depositor).to.be.equal(
                  "0x934B98637cA318a4D6E7CA6ffd1690b8e77df637"
                )
                // Deposit amount in satoshi. In this case it's 10000 satoshi
                // because the P2SH deposit transaction set this value for the
                // funding output.
                expect(deposit.amount).to.be.equal(10000)
                // Revealed time should be set.
                expect(deposit.revealedAt).to.be.equal(await lastBlockTime())
                // Deposit vault, same as in `reveal.vault`.
                expect(deposit.vault).to.be.equal(
                  "0x594cfd89700040163727828AE20B52099C58F02C"
                )
                // Treasury fee should be computed according to the current
                // value of the `depositTreasuryFeeDivisor`.
                expect(deposit.treasuryFee).to.be.equal(5)
                // Swept time should be unset.
                expect(deposit.sweptAt).to.be.equal(0)
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

          context("when amount is below the dust threshold", () => {
            before(async () => {
              await createSnapshot()

              // The `P2SHFundingTx` used within this scenario has an output
              // whose value is 10000 satoshi. To make the scenario happen, it
              // is enough that the contract's deposit dust threshold is
              // bigger by 1 satoshi.
              await bridge.setDepositDustThreshold(10001)
            })

            after(async () => {
              await restoreSnapshot()
            })

            it("should revert", async () => {
              await expect(
                bridge.revealDeposit(P2SHFundingTx, reveal)
              ).to.be.revertedWith("Deposit amount too small")
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

              // Depositor address, same as in `reveal.depositor`.
              expect(deposit.depositor).to.be.equal(
                "0x934B98637cA318a4D6E7CA6ffd1690b8e77df637"
              )
              // Deposit amount in satoshi. In this case it's 10000 satoshi
              // because the P2SH deposit transaction set this value for the
              // funding output.
              expect(deposit.amount).to.be.equal(10000)
              // Revealed time should be set.
              expect(deposit.revealedAt).to.be.equal(await lastBlockTime())
              // Deposit vault, same as in `reveal.vault`.
              expect(deposit.vault).to.be.equal(
                "0x594cfd89700040163727828AE20B52099C58F02C"
              )
              // Treasury fee should be computed according to the current
              // value of the `depositTreasuryFeeDivisor`.
              expect(deposit.treasuryFee).to.be.equal(5)
              // Swept time should be unset.
              expect(deposit.sweptAt).to.be.equal(0)
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
            context(
              "when transaction fee does not exceed the deposit transaction maximum fee",
              () => {
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

                        expect(deposit.sweptAt).to.be.equal(
                          await lastBlockTime()
                        )
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
                        // value is 18500 so the transaction fee is 1500. There is
                        // only one deposit so it incurs the entire transaction fee.
                        // The deposit should also incur the treasury fee whose
                        // initial value is 0.05% of the deposited amount so the
                        // final depositor balance should be cut by 10 satoshi.
                        expect(
                          await bank.balanceOf(
                            data.deposits[0].reveal.depositor
                          )
                        ).to.be.equal(18490)
                      })

                      it("should transfer collected treasury fee", async () => {
                        expect(
                          await bank.balanceOf(treasury.address)
                        ).to.be.equal(10)
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

                        expect(deposit.sweptAt).to.be.equal(
                          await lastBlockTime()
                        )
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
                        // deposit so it incurs the entire fee. The deposit should
                        // also incur the treasury fee whose initial value is 0.05%
                        // of the deposited amount so the final depositor balance
                        // should be cut by 40 satoshi.
                        expect(
                          await bank.balanceOf(
                            data.deposits[0].reveal.depositor
                          )
                        ).to.be.equal(77960)
                      })

                      it("should transfer collected treasury fee", async () => {
                        expect(
                          await bank.balanceOf(treasury.address)
                        ).to.be.equal(40)
                      })

                      it("should emit DepositsSwept event", async () => {
                        await expect(tx)
                          .to.emit(bridge, "DepositsSwept")
                          .withArgs(walletPubKeyHash, data.sweepTx.hash)
                      })
                    }
                  )

                  context(
                    "when the single input is the expected main UTXO",
                    () => {
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
                    }
                  )

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
                      await relay.setCurrentEpochDifficulty(
                        data.chainDifficulty
                      )
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
                      const previousData: SweepTestData =
                        MultipleDepositsNoMainUtxo
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

                          expect(deposit.sweptAt).to.be.equal(
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
                        // value is 4145001 so the sweep transaction fee is 2999.
                        // There are 5 deposits so the fee per deposit is 599
                        // and the indivisible remainder is 4 which means the
                        // last deposit should incur 603 satoshi. Worth noting
                        // the order of deposits used by this test scenario
                        // data does not correspond to the order of sweep
                        // transaction inputs. Each deposit should also incur
                        // the treasury fee whose initial value is 0.05% of the
                        // deposited amount.

                        // Deposit with index 0 used as input with index 5
                        // in the sweep transaction. This is the last deposit
                        // (according to inputs order) and it should incur the
                        // remainder of the transaction fee.
                        expect(
                          await bank.balanceOf(
                            data.deposits[0].reveal.depositor
                          )
                        ).to.be.equal(219287)

                        // Deposit with index 1 used as input with index 3
                        // in the sweep transaction.
                        expect(
                          await bank.balanceOf(
                            data.deposits[1].reveal.depositor
                          )
                        ).to.be.equal(759021)

                        // Deposit with index 2 used as input with index 1
                        // in the sweep transaction.
                        expect(
                          await bank.balanceOf(
                            data.deposits[2].reveal.depositor
                          )
                        ).to.be.equal(938931)

                        // Deposit with index 3 used as input with index 2
                        // in the sweep transaction.
                        expect(
                          await bank.balanceOf(
                            data.deposits[3].reveal.depositor
                          )
                        ).to.be.equal(878961)

                        // Deposit with index 4 used as input with index 4
                        // in the sweep transaction.
                        expect(
                          await bank.balanceOf(
                            data.deposits[4].reveal.depositor
                          )
                        ).to.be.equal(289256)
                      })

                      it("should transfer collected treasury fee", async () => {
                        expect(
                          await bank.balanceOf(treasury.address)
                        ).to.be.equal(2075)
                      })

                      it("should mark the previous main UTXO as spent", async () => {
                        const mainUtxoKey = ethers.utils.solidityKeccak256(
                          ["bytes32", "uint32"],
                          [data.mainUtxo.txHash, data.mainUtxo.txOutputIndex]
                        )

                        expect(await bridge.spentMainUTXOs(mainUtxoKey)).to.be
                          .true
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

                          expect(deposit.sweptAt).to.be.equal(
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
                        // value is 1058000 so the sweep transaction fee is 2000.
                        // There are 5 deposits so the fee per deposit is 400
                        // and there is no indivisible remainder. Each deposit
                        // should also incur the treasury fee whose initial
                        // value is 0.05% of the deposited amount.
                        expect(
                          await bank.balanceOf(
                            data.deposits[0].reveal.depositor
                          )
                        ).to.be.equal(29585)

                        expect(
                          await bank.balanceOf(
                            data.deposits[1].reveal.depositor
                          )
                        ).to.be.equal(9595)

                        expect(
                          await bank.balanceOf(
                            data.deposits[2].reveal.depositor
                          )
                        ).to.be.equal(209495)

                        expect(
                          await bank.balanceOf(
                            data.deposits[3].reveal.depositor
                          )
                        ).to.be.equal(369415)

                        expect(
                          await bank.balanceOf(
                            data.deposits[4].reveal.depositor
                          )
                        ).to.be.equal(439380)
                      })

                      it("should transfer collected treasury fee", async () => {
                        expect(
                          await bank.balanceOf(treasury.address)
                        ).to.be.equal(530)
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
                      const data: SweepTestData = JSON.parse(
                        JSON.stringify(MultipleDepositsNoMainUtxo)
                      )

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
              }
            )

            context(
              "when transaction fee exceeds the deposit transaction maximum fee",
              () => {
                const data: SweepTestData = SingleP2SHDeposit

                before(async () => {
                  await createSnapshot()

                  // Set the deposit transaction maximum fee to a value much
                  // lower than the fee used by the test data transaction.
                  await bridge.setDepositTxMaxFee(100)
                })

                after(async () => {
                  await restoreSnapshot()
                })

                it("should revert", async () => {
                  await expect(runSweepScenario(data)).to.be.revertedWith(
                    "'Transaction fee is too high"
                  )
                })
              }
            )
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
          // Each header encodes a `difficulty target` field in bytes 72-76.
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
    const walletPubKeyHash = "0x8db50eb52063ea9d98b3eac91489a90f738986f6"

    context("when wallet state is active", () => {
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
            // Arbitrary standard output scripts.
            const redeemerOutputScriptP2WPKH =
              "0x160014f4eedc8f40d4b8e30771f792b065ebec0abaddef"
            const redeemerOutputScriptP2WSH =
              "0x220020ef0b4d985752aa5ef6243e4c6f6bebc2a007e7d671ef27d4b1d0db8dcc93bc1c"
            const redeemerOutputScriptP2PKH =
              "0x1976a914f4eedc8f40d4b8e30771f792b065ebec0abaddef88ac"
            const redeemerOutputScriptP2SH =
              "0x17a914f4eedc8f40d4b8e30771f792b065ebec0abaddef87"

            context(
              "when redeemer output script does not point to the wallet public key hash",
              () => {
                context("when amount is not below the dust threshold", () => {
                  // Requested amount is 1901000 satoshi.
                  const requestedAmount = BigNumber.from(1901000)
                  // Treasury fee is `requestedAmount / redemptionTreasuryFeeDivisor`
                  // where the divisor is `2000` initially. So, we
                  // have 1901000 / 2000 = 950.5 though Solidity
                  // loses the decimal part.
                  const treasuryFee = 950

                  context(
                    "when there is no pending request for the given redemption key",
                    () => {
                      context("when wallet has sufficient funds", () => {
                        context(
                          "when redeemer made a sufficient allowance in Bank",
                          () => {
                            let redeemer: SignerWithAddress

                            before(async () => {
                              await createSnapshot()

                              // Use an arbitrary ETH account as redeemer.
                              redeemer = thirdParty

                              await makeRedemptionAllowance(
                                redeemer,
                                requestedAmount
                              )
                            })

                            after(async () => {
                              await restoreSnapshot()
                            })

                            context(
                              "when redeemer output script is P2WPKH",
                              () => {
                                const redeemerOutputScript =
                                  redeemerOutputScriptP2WPKH

                                let initialBridgeBalance: BigNumber
                                let initialRedeemerBalance: BigNumber
                                let initialWalletPendingRedemptionValue: BigNumber
                                let tx: ContractTransaction

                                before(async () => {
                                  await createSnapshot()

                                  // Capture initial TBTC balance of Bridge and
                                  // redeemer.
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

                                  expect(
                                    walletPendingRedemptionValue.sub(
                                      initialWalletPendingRedemptionValue
                                    )
                                  ).to.be.equal(
                                    requestedAmount.sub(treasuryFee)
                                  )
                                })

                                it("should store the redemption request", async () => {
                                  const redemptionKey = buildRedemptionKey(
                                    walletPubKeyHash,
                                    redeemerOutputScript
                                  )

                                  const redemptionRequest =
                                    await bridge.pendingRedemptions(
                                      redemptionKey
                                    )

                                  expect(
                                    redemptionRequest.redeemer
                                  ).to.be.equal(redeemer.address)
                                  expect(
                                    redemptionRequest.requestedAmount
                                  ).to.be.equal(requestedAmount)
                                  expect(
                                    redemptionRequest.treasuryFee
                                  ).to.be.equal(treasuryFee)
                                  expect(
                                    redemptionRequest.txMaxFee
                                  ).to.be.equal(
                                    await bridge.redemptionTxMaxFee()
                                  )
                                  expect(
                                    redemptionRequest.requestedAt
                                  ).to.be.equal(await lastBlockTime())
                                })

                                it("should emit RedemptionRequested event", async () => {
                                  await expect(tx)
                                    .to.emit(bridge, "RedemptionRequested")
                                    .withArgs(
                                      walletPubKeyHash,
                                      redeemerOutputScript,
                                      redeemer.address,
                                      requestedAmount,
                                      treasuryFee,
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
                              "when redeemer output script is P2WSH",
                              () => {
                                before(async () => {
                                  await createSnapshot()
                                })

                                after(async () => {
                                  await restoreSnapshot()
                                })

                                // Do not repeat all check made in the
                                // "when redeemer output script is P2WPKH"
                                // scenario but just assert the call succeeds
                                // for an P2WSH output script.
                                it("should succeed", async () => {
                                  await expect(
                                    bridge
                                      .connect(redeemer)
                                      .requestRedemption(
                                        walletPubKeyHash,
                                        mainUtxo,
                                        redeemerOutputScriptP2WSH,
                                        requestedAmount
                                      )
                                  ).to.not.be.reverted
                                })
                              }
                            )

                            context(
                              "when redeemer output script is P2PKH",
                              () => {
                                before(async () => {
                                  await createSnapshot()
                                })

                                after(async () => {
                                  await restoreSnapshot()
                                })

                                // Do not repeat all check made in the
                                // "when redeemer output script is P2WPKH"
                                // scenario but just assert the call succeeds
                                // for an P2PKH output script.
                                it("should succeed", async () => {
                                  await expect(
                                    bridge
                                      .connect(redeemer)
                                      .requestRedemption(
                                        walletPubKeyHash,
                                        mainUtxo,
                                        redeemerOutputScriptP2PKH,
                                        requestedAmount
                                      )
                                  ).to.not.be.reverted
                                })
                              }
                            )

                            context(
                              "when redeemer output script is P2SH",
                              () => {
                                before(async () => {
                                  await createSnapshot()
                                })

                                after(async () => {
                                  await restoreSnapshot()
                                })

                                // Do not repeat all check made in the
                                // "when redeemer output script is P2WPKH"
                                // scenario but just assert the call succeeds
                                // for an P2SH output script.
                                it("should succeed", async () => {
                                  await expect(
                                    bridge
                                      .connect(redeemer)
                                      .requestRedemption(
                                        walletPubKeyHash,
                                        mainUtxo,
                                        redeemerOutputScriptP2SH,
                                        requestedAmount
                                      )
                                  ).to.not.be.reverted
                                })
                              }
                            )
                          }
                        )

                        context(
                          "when redeemer has not made a sufficient allowance in Bank",
                          () => {
                            it("should revert", async () => {
                              await expect(
                                bridge
                                  .connect(thirdParty)
                                  .requestRedemption(
                                    walletPubKeyHash,
                                    mainUtxo,
                                    redeemerOutputScriptP2WPKH,
                                    requestedAmount
                                  )
                              ).to.be.revertedWith(
                                "Transfer amount exceeds allowance"
                              )
                            })
                          }
                        )
                      })

                      context("when wallet has insufficient funds", () => {
                        before(async () => {
                          await createSnapshot()

                          // Simulate a situation when the wallet has so many
                          // pending redemptions that a new request will
                          // exceed its Bitcoin balance. This is done by making
                          // a redemption request that will request the entire
                          // wallet's balance right before the tested request.
                          await makeRedemptionAllowance(
                            thirdParty,
                            mainUtxo.txOutputValue
                          )
                          await bridge
                            .connect(thirdParty)
                            .requestRedemption(
                              walletPubKeyHash,
                              mainUtxo,
                              redeemerOutputScriptP2WPKH,
                              mainUtxo.txOutputValue
                            )
                        })

                        after(async () => {
                          await restoreSnapshot()
                        })

                        it("should revert", async () => {
                          await expect(
                            bridge
                              .connect(thirdParty)
                              .requestRedemption(
                                walletPubKeyHash,
                                mainUtxo,
                                redeemerOutputScriptP2WSH,
                                requestedAmount
                              )
                          ).to.be.revertedWith("Insufficient wallet funds")
                        })
                      })
                    }
                  )

                  context(
                    "when there is a pending request for the given redemption key",
                    () => {
                      before(async () => {
                        await createSnapshot()

                        // Make a request targeting the given wallet and
                        // redeemer output script. Tested request will use
                        // the same parameters.
                        await makeRedemptionAllowance(
                          thirdParty,
                          mainUtxo.txOutputValue
                        )
                        await bridge
                          .connect(thirdParty)
                          .requestRedemption(
                            walletPubKeyHash,
                            mainUtxo,
                            redeemerOutputScriptP2WPKH,
                            mainUtxo.txOutputValue
                          )
                      })

                      after(async () => {
                        await restoreSnapshot()
                      })

                      it("should revert", async () => {
                        await expect(
                          bridge
                            .connect(thirdParty)
                            .requestRedemption(
                              walletPubKeyHash,
                              mainUtxo,
                              redeemerOutputScriptP2WPKH,
                              requestedAmount
                            )
                        ).to.be.revertedWith(
                          "There is a pending redemption request from this wallet to the same address"
                        )
                      })
                    }
                  )
                })

                context("when amount is below the dust threshold", () => {
                  it("should revert", async () => {
                    // Initial dust threshold set in the tests `fixture`
                    // for tests is 100000. A value lower by 1 sat should
                    // trigger the tested condition.
                    await expect(
                      bridge
                        .connect(thirdParty)
                        .requestRedemption(
                          walletPubKeyHash,
                          mainUtxo,
                          redeemerOutputScriptP2WPKH,
                          99999
                        )
                    ).to.be.revertedWith("Redemption amount too small")
                  })
                })
              }
            )

            context(
              "when redeemer output script points to the wallet public key hash",
              () => {
                it("should revert", async () => {
                  // Wallet public key hash hidden under P2WPKH.
                  await expect(
                    bridge
                      .connect(thirdParty)
                      .requestRedemption(
                        walletPubKeyHash,
                        mainUtxo,
                        `0x160014${walletPubKeyHash.substring(2)}`,
                        100000
                      )
                  ).to.be.revertedWith(
                    "Redeemer output script must not point to the wallet PKH"
                  )

                  // Wallet public key hash hidden under P2PKH.
                  await expect(
                    bridge
                      .connect(thirdParty)
                      .requestRedemption(
                        walletPubKeyHash,
                        mainUtxo,
                        `0x1976a914${walletPubKeyHash.substring(2)}88ac`,
                        100000
                      )
                  ).to.be.revertedWith(
                    "Redeemer output script must not point to the wallet PKH"
                  )

                  // Wallet public key hash hidden under P2SH.
                  await expect(
                    bridge
                      .connect(thirdParty)
                      .requestRedemption(
                        walletPubKeyHash,
                        mainUtxo,
                        `0x17a914${walletPubKeyHash.substring(2)}87`,
                        100000
                      )
                  ).to.be.revertedWith(
                    "Redeemer output script must not point to the wallet PKH"
                  )

                  // There is no need to check for P2WSH since that type
                  // uses 32-byte hashes. Because wallet public key hash is
                  // always 20-byte, there is no possibility those hashes
                  // can be confused during change output recognition.
                })
              }
            )
          })

          context("when redeemer output script is not standard type", () => {
            it("should revert", async () => {
              // The set of non-standard/malformed scripts is infinite.
              // A malformed P2PKH redeemer script is used as example.
              await expect(
                bridge
                  .connect(thirdParty)
                  .requestRedemption(
                    walletPubKeyHash,
                    mainUtxo,
                    "0x1988a914f4eedc8f40d4b8e30771f792b065ebec0abaddef88ac",
                    100000
                  )
              ).to.be.revertedWith(
                "Redeemer output script must be a standard type"
              )
            })
          })
        })

        context("when main UTXO data are invalid", () => {
          it("should revert", async () => {
            // The proper main UTXO hash `0` as `txOutputIndex`.
            await expect(
              bridge.connect(thirdParty).requestRedemption(
                walletPubKeyHash,
                {
                  txHash:
                    "0x3835ecdee2daa83c9a19b5012104ace55ecab197b5e16489c26d372e475f5d2a",
                  txOutputIndex: 1,
                  txOutputValue: 10000000,
                },
                "0x160014f4eedc8f40d4b8e30771f792b065ebec0abaddef",
                100000
              )
            ).to.be.revertedWith("Invalid main UTXO data")
          })
        })
      })

      context("when there is no main UTXO for the given wallet", () => {
        it("should revert", async () => {
          // Since there is no main UTXO for this wallet recorded in the
          // Bridge, the `mainUtxo` parameter can be anything.
          await expect(
            bridge
              .connect(thirdParty)
              .requestRedemption(
                walletPubKeyHash,
                NO_MAIN_UTXO,
                "0x160014f4eedc8f40d4b8e30771f792b065ebec0abaddef",
                100000
              )
          ).to.be.revertedWith("No main UTXO for the given wallet")
        })
      })
    })

    context("when wallet state is other than Active", () => {
      context("when wallet state is Unknown", () => {
        // No need to set wallet state explicitly as Unknown is the default
        // for wallets not being in the `wallets` mapping.
        it("should revert", async () => {
          await expect(
            bridge
              .connect(thirdParty)
              .requestRedemption(
                walletPubKeyHash,
                NO_MAIN_UTXO,
                "0x160014f4eedc8f40d4b8e30771f792b065ebec0abaddef",
                100000
              )
          ).to.be.revertedWith("Wallet must be in Active state")
        })
      })

      context("when wallet state is MovingFunds", () => {
        before(async () => {
          await createSnapshot()

          await bridge.setWallet(walletPubKeyHash, {
            state: 2,
            pendingRedemptionsValue: 0,
          })
        })

        after(async () => {
          await restoreSnapshot()
        })

        it("should revert", async () => {
          await expect(
            bridge
              .connect(thirdParty)
              .requestRedemption(
                walletPubKeyHash,
                NO_MAIN_UTXO,
                "0x160014f4eedc8f40d4b8e30771f792b065ebec0abaddef",
                100000
              )
          ).to.be.revertedWith("Wallet must be in Active state")
        })
      })

      context("when wallet state is Closed", () => {
        before(async () => {
          await createSnapshot()

          await bridge.setWallet(walletPubKeyHash, {
            state: 3,
            pendingRedemptionsValue: 0,
          })
        })

        after(async () => {
          await restoreSnapshot()
        })

        it("should revert", async () => {
          await expect(
            bridge
              .connect(thirdParty)
              .requestRedemption(
                walletPubKeyHash,
                NO_MAIN_UTXO,
                "0x160014f4eedc8f40d4b8e30771f792b065ebec0abaddef",
                100000
              )
          ).to.be.revertedWith("Wallet must be in Active state")
        })
      })

      context("when wallet state is Terminated", () => {
        before(async () => {
          await createSnapshot()

          await bridge.setWallet(walletPubKeyHash, {
            state: 4,
            pendingRedemptionsValue: 0,
          })
        })

        after(async () => {
          await restoreSnapshot()
        })

        it("should revert", async () => {
          await expect(
            bridge
              .connect(thirdParty)
              .requestRedemption(
                walletPubKeyHash,
                NO_MAIN_UTXO,
                "0x160014f4eedc8f40d4b8e30771f792b065ebec0abaddef",
                100000
              )
          ).to.be.revertedWith("Wallet must be in Active state")
        })
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
                        const data: RedemptionTestData =
                          SinglePendingRequestedRedemption

                        let tx: ContractTransaction
                        let bridgeBalance: RedemptionBalanceChange
                        let walletPendingRedemptionsValue: RedemptionBalanceChange
                        let treasuryBalance: RedemptionBalanceChange
                        let redeemersBalances: RedemptionBalanceChange[]

                        before(async () => {
                          await createSnapshot()

                          // Simulate the situation when treasury fee is 0% to
                          // allow using the whole wallet's main UTXO value
                          // to fulfill the redemption request.
                          await bridge.setRedemptionTreasuryFeeDivisor(0)

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

                        it("should close processed redemption request", async () => {
                          const redemptionRequest =
                            await bridge.pendingRedemptions(
                              buildRedemptionKey(
                                data.wallet.pubKeyHash,
                                data.redemptionRequests[0].redeemerOutputScript
                              )
                            )

                          expect(redemptionRequest.requestedAt).to.be.equal(
                            0,
                            "Redemption request has not been closed"
                          )
                        })

                        it("should delete the wallet's main UTXO", async () => {
                          // The Bitcoin redemption transaction has no change
                          // output so the wallet's main UTXO should be
                          // deleted on the Bridge side.
                          expect(
                            await bridge.mainUtxos(data.wallet.pubKeyHash)
                          ).to.be.equal(ZERO_32_BYTES)
                        })

                        it("should mark the previous main UTXO as spent", async () => {
                          const mainUtxoKey = ethers.utils.solidityKeccak256(
                            ["bytes32", "uint32"],
                            [data.mainUtxo.txHash, data.mainUtxo.txOutputIndex]
                          )

                          expect(await bridge.spentMainUTXOs(mainUtxoKey)).to.be
                            .true
                        })

                        it("should decrease the wallet's pending redemptions value", async () => {
                          // Wallet pending redemptions value should be
                          // decreased by the total redeemable amount but since
                          // the treasury fee is 0% in this test case, the
                          // total redeemable amount is equal to the total
                          // requested amount. See docs of the used test
                          // data for details.
                          expect(
                            walletPendingRedemptionsValue.afterProof.sub(
                              walletPendingRedemptionsValue.beforeProof
                            )
                          ).to.equal(-1177424)
                        })

                        it("should decrease Bridge's balance in Bank", async () => {
                          // Balance should be decreased by the total
                          // redeemable amount but since the treasury fee
                          // is 0% in this test case, the total redeemable
                          // amount is equal to the total requested amount.
                          // See docs of the used test data for details.
                          await expect(tx)
                            .to.emit(bank, "BalanceDecreased")
                            .withArgs(bridge.address, 1177424)
                          // In this case, the total Bridge balance change
                          // should be also equal to the same amount.
                          expect(
                            bridgeBalance.afterProof.sub(
                              bridgeBalance.beforeProof
                            )
                          ).to.equal(-1177424)
                        })

                        it("should not transfer anything to the treasury", async () => {
                          // Treasury balance should not be increased because
                          // the treasury fee is 0% in this test case.
                          expect(
                            treasuryBalance.afterProof.sub(
                              treasuryBalance.beforeProof
                            )
                          ).to.equal(0)
                        })

                        it("should not change redeemer balance in any way", async () => {
                          // Redemption proof submission should NEVER cause
                          // any change of the redeemer balance.
                          const redeemerBalance = redeemersBalances[0]

                          expect(
                            redeemerBalance.afterProof.sub(
                              redeemerBalance.beforeProof
                            )
                          ).to.be.equal(0, "Balance of redeemer has changed")
                        })
                      }
                    )

                    context(
                      "when the single output is a non-reported timed out requested redemption",
                      () => {
                        const data: RedemptionTestData =
                          SinglePendingRequestedRedemption

                        let tx: ContractTransaction
                        let bridgeBalance: RedemptionBalanceChange
                        let walletPendingRedemptionsValue: RedemptionBalanceChange
                        let treasuryBalance: RedemptionBalanceChange
                        let redeemersBalances: RedemptionBalanceChange[]

                        before(async () => {
                          await createSnapshot()

                          // Simulate the situation when treasury fee is 0% to
                          // allow using the whole wallet's main UTXO value
                          // to fulfill the redemption request.
                          await bridge.setRedemptionTreasuryFeeDivisor(0)

                          // Before submitting the redemption proof, wait
                          // an amount of time that will make the request
                          // timed out though don't report the timeout.
                          const beforeProofActions = async () => {
                            await increaseTime(await bridge.redemptionTimeout())
                          }

                          // eslint-disable-next-line @typescript-eslint/no-extra-semi
                          ;({
                            tx,
                            bridgeBalance,
                            walletPendingRedemptionsValue,
                            treasuryBalance,
                            redeemersBalances,
                          } = await runRedemptionScenario(
                            data,
                            beforeProofActions
                          ))
                        })

                        after(async () => {
                          await restoreSnapshot()
                        })

                        it("should close processed redemption request", async () => {
                          const redemptionRequest =
                            await bridge.pendingRedemptions(
                              buildRedemptionKey(
                                data.wallet.pubKeyHash,
                                data.redemptionRequests[0].redeemerOutputScript
                              )
                            )

                          expect(redemptionRequest.requestedAt).to.be.equal(
                            0,
                            "Redemption request has not been closed"
                          )
                        })

                        it("should delete the wallet's main UTXO", async () => {
                          // The Bitcoin redemption transaction has no change
                          // output so the wallet's main UTXO should be
                          // deleted on the Bridge side.
                          expect(
                            await bridge.mainUtxos(data.wallet.pubKeyHash)
                          ).to.be.equal(ZERO_32_BYTES)
                        })

                        it("should mark the previous main UTXO as spent", async () => {
                          const mainUtxoKey = ethers.utils.solidityKeccak256(
                            ["bytes32", "uint32"],
                            [data.mainUtxo.txHash, data.mainUtxo.txOutputIndex]
                          )

                          expect(await bridge.spentMainUTXOs(mainUtxoKey)).to.be
                            .true
                        })

                        it("should decrease the wallet's pending redemptions value", async () => {
                          // Wallet pending redemptions value should be
                          // decreased by the total redeemable amount but since
                          // the treasury fee is 0% in this test case, the
                          // total redeemable amount is equal to the total
                          // requested amount. See docs of the used test
                          // data for details.
                          expect(
                            walletPendingRedemptionsValue.afterProof.sub(
                              walletPendingRedemptionsValue.beforeProof
                            )
                          ).to.equal(-1177424)
                        })

                        it("should decrease Bridge's balance in Bank", async () => {
                          // Balance should be decreased by the total
                          // redeemable amount but since the treasury fee
                          // is 0% in this test case, the total redeemable
                          // amount is equal to the total requested amount.
                          // See docs of the used test data for details.
                          await expect(tx)
                            .to.emit(bank, "BalanceDecreased")
                            .withArgs(bridge.address, 1177424)
                          // In this case, the total Bridge balance change
                          // should be also equal to the same amount.
                          expect(
                            bridgeBalance.afterProof.sub(
                              bridgeBalance.beforeProof
                            )
                          ).to.equal(-1177424)
                        })

                        it("should not transfer anything to the treasury", async () => {
                          // Treasury balance should not be increased because
                          // the treasury fee is 0% in this test case.
                          expect(
                            treasuryBalance.afterProof.sub(
                              treasuryBalance.beforeProof
                            )
                          ).to.equal(0)
                        })

                        it("should not change redeemer balance in any way", async () => {
                          // Redemption proof submission should NEVER cause
                          // any change of the redeemer balance.
                          const redeemerBalance = redeemersBalances[0]

                          expect(
                            redeemerBalance.afterProof.sub(
                              redeemerBalance.beforeProof
                            )
                          ).to.be.equal(0, "Balance of redeemer has changed")
                        })
                      }
                    )

                    context(
                      "when the single output is a reported timed out requested redemption",
                      () => {
                        const data: RedemptionTestData =
                          SinglePendingRequestedRedemption

                        let tx: ContractTransaction
                        let bridgeBalance: RedemptionBalanceChange
                        let walletPendingRedemptionsValue: RedemptionBalanceChange
                        let treasuryBalance: RedemptionBalanceChange
                        let redeemersBalances: RedemptionBalanceChange[]

                        before(async () => {
                          await createSnapshot()

                          // Simulate the situation when treasury fee is 0% to
                          // allow using the whole wallet's main UTXO value
                          // to fulfill the redemption request.
                          await bridge.setRedemptionTreasuryFeeDivisor(0)

                          // Before submitting the redemption proof, wait
                          // an amount of time that will make the request
                          // timed out and then report the timeout.
                          const beforeProofActions = async () => {
                            await increaseTime(await bridge.redemptionTimeout())
                            await bridge.notifyRedemptionTimeout(
                              data.wallet.pubKeyHash,
                              data.redemptionRequests[0].redeemerOutputScript
                            )
                          }

                          // eslint-disable-next-line @typescript-eslint/no-extra-semi
                          ;({
                            tx,
                            bridgeBalance,
                            walletPendingRedemptionsValue,
                            treasuryBalance,
                            redeemersBalances,
                          } = await runRedemptionScenario(
                            data,
                            beforeProofActions
                          ))
                        })

                        after(async () => {
                          await restoreSnapshot()
                        })

                        it("should hold the timed out request in the contract state", async () => {
                          const redemptionRequest =
                            await bridge.timedOutRedemptions(
                              buildRedemptionKey(
                                data.wallet.pubKeyHash,
                                data.redemptionRequests[0].redeemerOutputScript
                              )
                            )

                          expect(
                            redemptionRequest.requestedAt
                          ).to.be.greaterThan(
                            0,
                            "Timed out request was removed from the contract state"
                          )
                        })

                        it("should delete the wallet's main UTXO", async () => {
                          // The Bitcoin redemption transaction has no change
                          // output so the wallet's main UTXO should be
                          // deleted on the Bridge side. It doesn't matter
                          // the only redemption handled by the transaction
                          // is reported as timed out.
                          expect(
                            await bridge.mainUtxos(data.wallet.pubKeyHash)
                          ).to.be.equal(ZERO_32_BYTES)
                        })

                        it("should mark the previous main UTXO as spent", async () => {
                          const mainUtxoKey = ethers.utils.solidityKeccak256(
                            ["bytes32", "uint32"],
                            [data.mainUtxo.txHash, data.mainUtxo.txOutputIndex]
                          )

                          expect(await bridge.spentMainUTXOs(mainUtxoKey)).to.be
                            .true
                        })

                        it("should not change the wallet's pending redemptions value", async () => {
                          // All the bookkeeping regarding the timed out
                          // request was done upon timeout report. The
                          // wallet pending redemptions value should not
                          // be changed in any way.
                          expect(
                            walletPendingRedemptionsValue.afterProof.sub(
                              walletPendingRedemptionsValue.beforeProof
                            )
                          ).to.equal(0)
                        })

                        it("should not change Bridge's balance in Bank", async () => {
                          // All the bookkeeping regarding the timed out
                          // request was done upon timeout report. The Bridge
                          // balance in the bank should neither be decreased...
                          await expect(tx)
                            .to.emit(bank, "BalanceDecreased")
                            .withArgs(bridge.address, 0)
                          // ...nor changed in any other way.
                          expect(
                            bridgeBalance.afterProof.sub(
                              bridgeBalance.beforeProof
                            )
                          ).to.equal(0)
                        })

                        it("should not transfer anything to the treasury", async () => {
                          // Treasury balance should not be increased in any way
                          // since the only request handled by the redemption
                          // transaction is reported as timed out and is just
                          // skipped during processing.
                          expect(
                            treasuryBalance.afterProof.sub(
                              treasuryBalance.beforeProof
                            )
                          ).to.equal(0)
                        })

                        it("should not change redeemer balance in any way", async () => {
                          // Redemption proof submission should NEVER cause
                          // any change of the redeemer balance.
                          const redeemerBalance = redeemersBalances[0]

                          expect(
                            redeemerBalance.afterProof.sub(
                              redeemerBalance.beforeProof
                            )
                          ).to.be.equal(0, "Balance of redeemer has changed")
                        })
                      }
                    )

                    context(
                      "when the single output is a pending requested redemption but redeemed amount is wrong",
                      () => {
                        const data: RedemptionTestData = JSON.parse(
                          JSON.stringify(SinglePendingRequestedRedemption)
                        )

                        let outcome: Promise<RedemptionScenarioOutcome>

                        before(async () => {
                          await createSnapshot()

                          // Alter the single redemption request in the test
                          // data and set such an amount that will cause
                          // the Bitcoin redemption transaction to be deemed
                          // as invalid due to a wrong amount. The transaction
                          // output has the value of 1176924 so to make this
                          // test scenario happen, the request amount must be
                          // way different (lesser or greater) than the output
                          // value. Worth noting that this test scenario tests
                          // the amount condition in a general and simplified
                          // way without stressing all specific edge cases.
                          // Doing a detailed check would require more dedicated
                          // test data sets which would make it far more
                          // complicated without giving much value in return.
                          data.redemptionRequests[0].amount = 300000

                          outcome = runRedemptionScenario(data)
                        })

                        after(async () => {
                          await restoreSnapshot()
                        })

                        it("should revert", async () => {
                          await expect(outcome).to.be.revertedWith(
                            "Output value is not within the acceptable range of the pending request"
                          )
                        })
                      }
                    )

                    context(
                      "when the single output is a reported timed out requested redemption but amount is wrong",
                      () => {
                        const data: RedemptionTestData = JSON.parse(
                          JSON.stringify(SinglePendingRequestedRedemption)
                        )

                        let outcome: Promise<RedemptionScenarioOutcome>

                        before(async () => {
                          await createSnapshot()

                          // Alter the single redemption request in the test
                          // data and set such an amount that will cause
                          // the Bitcoin redemption transaction to be deemed
                          // as invalid due to a wrong amount. The transaction
                          // output has the value of 1176924 so to make this
                          // test scenario happen, the request amount must be
                          // way different (lesser or greater) than the output
                          // value. Worth noting that this test scenario tests
                          // the amount condition in a general and simplified
                          // way without stressing all specific edge cases.
                          // Doing a detailed check would require more dedicated
                          // test data sets which would make it far more
                          // complicated without giving much value in return.
                          data.redemptionRequests[0].amount = 300000

                          // Before submitting the redemption proof, wait
                          // an amount of time that will make the request
                          // timed out and then report the timeout.
                          const beforeProofActions = async () => {
                            await increaseTime(await bridge.redemptionTimeout())
                            await bridge.notifyRedemptionTimeout(
                              data.wallet.pubKeyHash,
                              data.redemptionRequests[0].redeemerOutputScript
                            )
                          }

                          outcome = runRedemptionScenario(
                            data,
                            beforeProofActions
                          )
                        })

                        after(async () => {
                          await restoreSnapshot()
                        })

                        it("should revert", async () => {
                          await expect(outcome).to.be.revertedWith(
                            "Output value is not within the acceptable range of the timed out request"
                          )
                        })
                      }
                    )

                    context(
                      "when the single output is a legal P2PKH change with a non-zero value",
                      () => {
                        const data: RedemptionTestData = SingleP2PKHChange

                        let outcome: Promise<RedemptionScenarioOutcome>

                        before(async () => {
                          await createSnapshot()

                          outcome = runRedemptionScenario(data)
                        })

                        after(async () => {
                          await restoreSnapshot()
                        })

                        // Should be deemed as valid change though rejected
                        // because this change is a single output and at least
                        // one requested redemption is expected.
                        it("should revert", async () => {
                          await expect(outcome).to.be.revertedWith(
                            "Redemption transaction must process at least one redemption"
                          )
                        })
                      }
                    )

                    context(
                      "when the single output is a legal P2WPKH change with a non-zero value",
                      () => {
                        const data: RedemptionTestData = SingleP2WPKHChange

                        let outcome: Promise<RedemptionScenarioOutcome>

                        before(async () => {
                          await createSnapshot()

                          outcome = runRedemptionScenario(data)
                        })

                        after(async () => {
                          await restoreSnapshot()
                        })

                        // Should be deemed as valid change though rejected
                        // because this change is a single output and at least
                        // one requested redemption is expected.
                        it("should revert", async () => {
                          await expect(outcome).to.be.revertedWith(
                            "Redemption transaction must process at least one redemption"
                          )
                        })
                      }
                    )

                    context(
                      "when the single output is an illegal P2SH change with a non-zero value",
                      () => {
                        const data: RedemptionTestData = SingleP2SHChange

                        let outcome: Promise<RedemptionScenarioOutcome>

                        before(async () => {
                          await createSnapshot()

                          outcome = runRedemptionScenario(data)
                        })

                        after(async () => {
                          await restoreSnapshot()
                        })

                        // We have this case because P2SH script has a 20-byte
                        // payload which may match the 20-byte wallet public
                        // key hash though it should be always rejected as
                        // non-requested output. There is no need to check for
                        // P2WSH since the payload is always 32-byte there.
                        // The main reason we need to bother about 20-byte
                        // hashes is because the wallet public key hash has
                        // always 20-bytes and we must make sure no redemption
                        // request uses it as a redeemer script to not confuse
                        // an output that will try to handle that request with
                        // a proper change output also referencing the wallet
                        // public key hash.
                        it("should revert", async () => {
                          await expect(outcome).to.be.revertedWith(
                            "Output is a non-requested redemption"
                          )
                        })
                      }
                    )

                    context(
                      "when the single output is a change with a zero as value",
                      () => {
                        const data: RedemptionTestData =
                          SingleP2WPKHChangeZeroValue

                        let outcome: Promise<RedemptionScenarioOutcome>

                        before(async () => {
                          await createSnapshot()

                          outcome = runRedemptionScenario(data)
                        })

                        after(async () => {
                          await restoreSnapshot()
                        })

                        it("should revert", async () => {
                          await expect(outcome).to.be.revertedWith(
                            "Output is a non-requested redemption"
                          )
                        })
                      }
                    )

                    context(
                      "when the single output is a non-requested redemption to an arbitrary script",
                      () => {
                        const data: RedemptionTestData =
                          SingleNonRequestedRedemption

                        let outcome: Promise<RedemptionScenarioOutcome>

                        before(async () => {
                          await createSnapshot()

                          outcome = runRedemptionScenario(data)
                        })

                        after(async () => {
                          await restoreSnapshot()
                        })

                        it("should revert", async () => {
                          await expect(outcome).to.be.revertedWith(
                            "Output is a non-requested redemption"
                          )
                        })
                      }
                    )

                    context(
                      "when the single output is provably unspendable OP_RETURN",
                      () => {
                        const data: RedemptionTestData =
                          SingleProvablyUnspendable

                        let outcome: Promise<RedemptionScenarioOutcome>

                        before(async () => {
                          await createSnapshot()

                          outcome = runRedemptionScenario(data)
                        })

                        after(async () => {
                          await restoreSnapshot()
                        })

                        it("should revert", async () => {
                          await expect(outcome).to.be.revertedWith(
                            "Output is a non-requested redemption"
                          )
                        })
                      }
                    )
                  })

                  context("when there are multiple outputs", () => {
                    context(
                      "when output vector consists only of pending requested redemptions",
                      () => {
                        const data: RedemptionTestData =
                          MultiplePendingRequestedRedemptions

                        let tx: ContractTransaction
                        let bridgeBalance: RedemptionBalanceChange
                        let walletPendingRedemptionsValue: RedemptionBalanceChange
                        let treasuryBalance: RedemptionBalanceChange
                        let redeemersBalances: RedemptionBalanceChange[]

                        before(async () => {
                          await createSnapshot()

                          // Simulate the situation when treasury fee is 0% to
                          // allow using the whole wallet's main UTXO value
                          // to fulfill the redemption requests.
                          await bridge.setRedemptionTreasuryFeeDivisor(0)

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

                        it("should delete the wallet's main UTXO", async () => {
                          // The Bitcoin redemption transaction has no change
                          // output so the wallet's main UTXO should be
                          // deleted on the Bridge side.
                          expect(
                            await bridge.mainUtxos(data.wallet.pubKeyHash)
                          ).to.be.equal(ZERO_32_BYTES)
                        })

                        it("should mark the previous main UTXO as spent", async () => {
                          const mainUtxoKey = ethers.utils.solidityKeccak256(
                            ["bytes32", "uint32"],
                            [data.mainUtxo.txHash, data.mainUtxo.txOutputIndex]
                          )

                          expect(await bridge.spentMainUTXOs(mainUtxoKey)).to.be
                            .true
                        })

                        it("should decrease the wallet's pending redemptions value", async () => {
                          // Wallet pending redemptions value should be
                          // decreased by the total redeemable amount but since
                          // the treasury fee is 0% in this test case, the
                          // total redeemable amount is equal to the total
                          // requested amount. See docs of the used test
                          // data for details.
                          expect(
                            walletPendingRedemptionsValue.afterProof.sub(
                              walletPendingRedemptionsValue.beforeProof
                            )
                          ).to.equal(-959845)
                        })

                        it("should decrease Bridge's balance in Bank", async () => {
                          // Balance should be decreased by the total
                          // redeemable amount but since the treasury fee
                          // is 0% in this test case, the total redeemable
                          // amount is equal to the total requested amount.
                          // See docs of the used test data for details.
                          await expect(tx)
                            .to.emit(bank, "BalanceDecreased")
                            .withArgs(bridge.address, 959845)
                          // In this case, the total Bridge balance change
                          // should be also equal to the same amount.
                          expect(
                            bridgeBalance.afterProof.sub(
                              bridgeBalance.beforeProof
                            )
                          ).to.equal(-959845)
                        })

                        it("should not transfer anything to the treasury", async () => {
                          // Treasury balance should not be increased because
                          // the treasury fee is 0% in this test case.
                          expect(
                            treasuryBalance.afterProof.sub(
                              treasuryBalance.beforeProof
                            )
                          ).to.equal(0)
                        })

                        it("should not change redeemers balances in any way", async () => {
                          // Redemption proof submission should NEVER cause
                          // any change of the redeemers balances.
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
                      "when output vector consists of pending requested redemptions and a non-zero change",
                      () => {
                        const data: RedemptionTestData =
                          MultiplePendingRequestedRedemptionsWithP2WPKHChange

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

                        it("should mark the previous main UTXO as spent", async () => {
                          const mainUtxoKey = ethers.utils.solidityKeccak256(
                            ["bytes32", "uint32"],
                            [data.mainUtxo.txHash, data.mainUtxo.txOutputIndex]
                          )

                          expect(await bridge.spentMainUTXOs(mainUtxoKey)).to.be
                            .true
                        })

                        it("should decrease the wallet's pending redemptions value", async () => {
                          // Wallet pending redemptions value should be
                          // decreased by the total redeemable amount. See docs
                          // of the used test data for details.
                          expect(
                            walletPendingRedemptionsValue.afterProof.sub(
                              walletPendingRedemptionsValue.beforeProof
                            )
                          ).to.equal(-6432350)
                        })

                        it("should decrease Bridge's balance in Bank", async () => {
                          // Balance should be decreased by the total
                          // redeemable amount. See docs of the used test
                          // data for details.
                          await expect(tx)
                            .to.emit(bank, "BalanceDecreased")
                            .withArgs(bridge.address, 6432350)
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
                          ).to.equal(-6435567)
                        })

                        it("should transfer collected treasury fee", async () => {
                          // Treasury balance should be increased by the total
                          // treasury fee for all requests. See docs of the
                          // used test data for details.
                          expect(
                            treasuryBalance.afterProof.sub(
                              treasuryBalance.beforeProof
                            )
                          ).to.equal(3217)
                        })

                        it("should not change redeemers balances in any way", async () => {
                          // Redemption proof submission should NEVER cause
                          // any change of the redeemers balances.
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
                      "when output vector consists only of reported timed out requested redemptions",
                      () => {
                        const data: RedemptionTestData =
                          MultiplePendingRequestedRedemptions

                        let tx: ContractTransaction
                        let bridgeBalance: RedemptionBalanceChange
                        let walletPendingRedemptionsValue: RedemptionBalanceChange
                        let treasuryBalance: RedemptionBalanceChange
                        let redeemersBalances: RedemptionBalanceChange[]

                        before(async () => {
                          await createSnapshot()

                          // Simulate the situation when treasury fee is 0% to
                          // allow using the whole wallet's main UTXO value
                          // to fulfill the redemption requests.
                          await bridge.setRedemptionTreasuryFeeDivisor(0)

                          // Before submitting the redemption proof, wait
                          // an amount of time that will make the requests
                          // timed out and then report the timeouts.
                          const beforeProofActions = async () => {
                            await increaseTime(await bridge.redemptionTimeout())

                            for (
                              let i = 0;
                              i < data.redemptionRequests.length;
                              i++
                            ) {
                              // eslint-disable-next-line no-await-in-loop
                              await bridge.notifyRedemptionTimeout(
                                data.wallet.pubKeyHash,
                                data.redemptionRequests[i].redeemerOutputScript
                              )
                            }
                          }

                          // eslint-disable-next-line @typescript-eslint/no-extra-semi
                          ;({
                            tx,
                            bridgeBalance,
                            walletPendingRedemptionsValue,
                            treasuryBalance,
                            redeemersBalances,
                          } = await runRedemptionScenario(
                            data,
                            beforeProofActions
                          ))
                        })

                        after(async () => {
                          await restoreSnapshot()
                        })

                        it("should hold the timed out requests in the contract state", async () => {
                          for (
                            let i = 0;
                            i < data.redemptionRequests.length;
                            i++
                          ) {
                            const redemptionRequest =
                              // eslint-disable-next-line no-await-in-loop
                              await bridge.timedOutRedemptions(
                                buildRedemptionKey(
                                  data.wallet.pubKeyHash,
                                  data.redemptionRequests[i]
                                    .redeemerOutputScript
                                )
                              )

                            expect(
                              redemptionRequest.requestedAt
                            ).to.be.greaterThan(
                              0,
                              `Timed out request with index ${i} was removed from the contract state`
                            )
                          }
                        })

                        it("should delete the wallet's main UTXO", async () => {
                          // The Bitcoin redemption transaction has no change
                          // output so the wallet's main UTXO should be
                          // deleted on the Bridge side. It doesn't matter
                          // that all redemptions handled by the transaction
                          // are reported as timed out.
                          expect(
                            await bridge.mainUtxos(data.wallet.pubKeyHash)
                          ).to.be.equal(ZERO_32_BYTES)
                        })

                        it("should mark the previous main UTXO as spent", async () => {
                          const mainUtxoKey = ethers.utils.solidityKeccak256(
                            ["bytes32", "uint32"],
                            [data.mainUtxo.txHash, data.mainUtxo.txOutputIndex]
                          )

                          expect(await bridge.spentMainUTXOs(mainUtxoKey)).to.be
                            .true
                        })

                        it("should not change the wallet's pending redemptions value", async () => {
                          // All the bookkeeping regarding the timed out
                          // requests was done upon timeout reports. The
                          // wallet pending redemptions value should not
                          // be changed in any way.
                          expect(
                            walletPendingRedemptionsValue.afterProof.sub(
                              walletPendingRedemptionsValue.beforeProof
                            )
                          ).to.equal(0)
                        })

                        it("should not change Bridge's balance in Bank", async () => {
                          // All the bookkeeping regarding the timed out
                          // requests was done upon timeout reports. The Bridge
                          // balance in the bank should neither be decreased...
                          await expect(tx)
                            .to.emit(bank, "BalanceDecreased")
                            .withArgs(bridge.address, 0)
                          // ...nor changed in any other way.
                          expect(
                            bridgeBalance.afterProof.sub(
                              bridgeBalance.beforeProof
                            )
                          ).to.equal(0)
                        })

                        it("should not transfer anything to the treasury", async () => {
                          // Treasury balance should not be increased in any way
                          // since all requests handled by the redemption
                          // transaction are reported as timed out and are just
                          // skipped during processing.
                          expect(
                            treasuryBalance.afterProof.sub(
                              treasuryBalance.beforeProof
                            )
                          ).to.equal(0)
                        })

                        it("should not change redeemers balances in any way", async () => {
                          // Redemption proof submission should NEVER cause
                          // any change of the redeemers balances.
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
                      "when output vector consists of reported timed out requested redemptions and a non-zero change",
                      () => {
                        const data: RedemptionTestData =
                          MultiplePendingRequestedRedemptionsWithP2WPKHChange

                        let tx: ContractTransaction
                        let bridgeBalance: RedemptionBalanceChange
                        let walletPendingRedemptionsValue: RedemptionBalanceChange
                        let treasuryBalance: RedemptionBalanceChange
                        let redeemersBalances: RedemptionBalanceChange[]

                        before(async () => {
                          await createSnapshot()

                          // Before submitting the redemption proof, wait
                          // an amount of time that will make the requests
                          // timed out and then report the timeouts.
                          const beforeProofActions = async () => {
                            await increaseTime(await bridge.redemptionTimeout())

                            for (
                              let i = 0;
                              i < data.redemptionRequests.length;
                              i++
                            ) {
                              // eslint-disable-next-line no-await-in-loop
                              await bridge.notifyRedemptionTimeout(
                                data.wallet.pubKeyHash,
                                data.redemptionRequests[i].redeemerOutputScript
                              )
                            }
                          }

                          // eslint-disable-next-line @typescript-eslint/no-extra-semi
                          ;({
                            tx,
                            bridgeBalance,
                            walletPendingRedemptionsValue,
                            treasuryBalance,
                            redeemersBalances,
                          } = await runRedemptionScenario(
                            data,
                            beforeProofActions
                          ))
                        })

                        after(async () => {
                          await restoreSnapshot()
                        })

                        it("should hold the timed out requests in the contract state", async () => {
                          for (
                            let i = 0;
                            i < data.redemptionRequests.length;
                            i++
                          ) {
                            const redemptionRequest =
                              // eslint-disable-next-line no-await-in-loop
                              await bridge.timedOutRedemptions(
                                buildRedemptionKey(
                                  data.wallet.pubKeyHash,
                                  data.redemptionRequests[i]
                                    .redeemerOutputScript
                                )
                              )

                            expect(
                              redemptionRequest.requestedAt
                            ).to.be.greaterThan(
                              0,
                              `Timed out request with index ${i} was removed from the contract state`
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

                        it("should mark the previous main UTXO as spent", async () => {
                          const mainUtxoKey = ethers.utils.solidityKeccak256(
                            ["bytes32", "uint32"],
                            [data.mainUtxo.txHash, data.mainUtxo.txOutputIndex]
                          )

                          expect(await bridge.spentMainUTXOs(mainUtxoKey)).to.be
                            .true
                        })

                        it("should not change the wallet's pending redemptions value", async () => {
                          // All the bookkeeping regarding the timed out
                          // requests was done upon timeout reports. The
                          // wallet pending redemptions value should not
                          // be changed in any way.
                          expect(
                            walletPendingRedemptionsValue.afterProof.sub(
                              walletPendingRedemptionsValue.beforeProof
                            )
                          ).to.equal(0)
                        })

                        it("should not change Bridge's balance in Bank", async () => {
                          // All the bookkeeping regarding the timed out
                          // requests was done upon timeout reports. The Bridge
                          // balance in the bank should neither be decreased...
                          await expect(tx)
                            .to.emit(bank, "BalanceDecreased")
                            .withArgs(bridge.address, 0)
                          // ...nor changed in any other way.
                          expect(
                            bridgeBalance.afterProof.sub(
                              bridgeBalance.beforeProof
                            )
                          ).to.equal(0)
                        })

                        it("should not transfer anything to the treasury", async () => {
                          // Treasury balance should not be increased in any way
                          // since all requests handled by the redemption
                          // transaction are reported as timed out and are just
                          // skipped during processing.
                          expect(
                            treasuryBalance.afterProof.sub(
                              treasuryBalance.beforeProof
                            )
                          ).to.equal(0)
                        })

                        it("should not change redeemers balances in any way", async () => {
                          // Redemption proof submission should NEVER cause
                          // any change of the redeemers balances.
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
                      "when output vector consists of pending requested redemptions and reported timed out requested redemptions",
                      () => {
                        const data: RedemptionTestData =
                          MultiplePendingRequestedRedemptions

                        let tx: ContractTransaction
                        let bridgeBalance: RedemptionBalanceChange
                        let walletPendingRedemptionsValue: RedemptionBalanceChange
                        let treasuryBalance: RedemptionBalanceChange
                        let redeemersBalances: RedemptionBalanceChange[]

                        before(async () => {
                          await createSnapshot()

                          // Simulate the situation when treasury fee is 0% to
                          // allow using the whole wallet's main UTXO value
                          // to fulfill the redemption requests.
                          await bridge.setRedemptionTreasuryFeeDivisor(0)

                          // Before submitting the redemption proof, wait
                          // an amount of time that will make the requests
                          // timed out but report timeout only the two first
                          // requests.
                          const beforeProofActions = async () => {
                            await increaseTime(await bridge.redemptionTimeout())

                            await bridge.notifyRedemptionTimeout(
                              data.wallet.pubKeyHash,
                              data.redemptionRequests[0].redeemerOutputScript
                            )
                            await bridge.notifyRedemptionTimeout(
                              data.wallet.pubKeyHash,
                              data.redemptionRequests[1].redeemerOutputScript
                            )
                          }

                          // eslint-disable-next-line @typescript-eslint/no-extra-semi
                          ;({
                            tx,
                            bridgeBalance,
                            walletPendingRedemptionsValue,
                            treasuryBalance,
                            redeemersBalances,
                          } = await runRedemptionScenario(
                            data,
                            beforeProofActions
                          ))
                        })

                        after(async () => {
                          await restoreSnapshot()
                        })

                        it("should hold the timed out requests in the contract state", async () => {
                          // Check the two first requests reported as timed out
                          // are actually held in the contract state after
                          // proof submission.
                          for (let i = 0; i < 2; i++) {
                            const redemptionRequest =
                              // eslint-disable-next-line no-await-in-loop
                              await bridge.timedOutRedemptions(
                                buildRedemptionKey(
                                  data.wallet.pubKeyHash,
                                  data.redemptionRequests[i]
                                    .redeemerOutputScript
                                )
                              )

                            expect(
                              redemptionRequest.requestedAt
                            ).to.be.greaterThan(
                              0,
                              `Timed out request with index ${i} was removed from the contract state`
                            )
                          }
                        })

                        it("should close processed redemption requests", async () => {
                          // Check the remaining requests not reported as
                          // timed out were actually closed after proof
                          // submission.
                          for (
                            let i = 2;
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

                        it("should delete the wallet's main UTXO", async () => {
                          // The Bitcoin redemption transaction has no change
                          // output so the wallet's main UTXO should be
                          // deleted on the Bridge side.
                          expect(
                            await bridge.mainUtxos(data.wallet.pubKeyHash)
                          ).to.be.equal(ZERO_32_BYTES)
                        })

                        it("should mark the previous main UTXO as spent", async () => {
                          const mainUtxoKey = ethers.utils.solidityKeccak256(
                            ["bytes32", "uint32"],
                            [data.mainUtxo.txHash, data.mainUtxo.txOutputIndex]
                          )

                          expect(await bridge.spentMainUTXOs(mainUtxoKey)).to.be
                            .true
                        })

                        it("should decrease the wallet's pending redemptions value", async () => {
                          // Wallet pending redemptions value should be
                          // decreased by the total redeemable amount but since
                          // the treasury fee is 0% in this test case, the
                          // total redeemable amount is equal to the total
                          // requested amount. However, only pending
                          // requests are taken into account and all reported
                          // timeouts should be ignored because the appropriate
                          // bookkeeping was already made upon timeout reports.
                          // See docs of the used test data for details.
                          expect(
                            walletPendingRedemptionsValue.afterProof.sub(
                              walletPendingRedemptionsValue.beforeProof
                            )
                          ).to.equal(-575907)
                        })

                        it("should decrease Bridge's balance in Bank", async () => {
                          // Balance should be decreased by the total
                          // redeemable amount but since the treasury fee
                          // is 0% in this test case, the total redeemable
                          // amount is equal to the total requested amount.
                          // However, only pending requests are taken into
                          // account and all reported timeouts should be
                          // ignored because the appropriate bookkeeping was
                          // already made upon timeout reports. See docs of the
                          // used test data for details.
                          await expect(tx)
                            .to.emit(bank, "BalanceDecreased")
                            .withArgs(bridge.address, 575907)
                          // In this case, the total Bridge balance change
                          // should be also equal to the same amount.
                          expect(
                            bridgeBalance.afterProof.sub(
                              bridgeBalance.beforeProof
                            )
                          ).to.equal(-575907)
                        })

                        it("should not transfer anything to the treasury", async () => {
                          // Treasury balance should not be increased because
                          // the treasury fee is 0% in this test case.
                          expect(
                            treasuryBalance.afterProof.sub(
                              treasuryBalance.beforeProof
                            )
                          ).to.equal(0)
                        })

                        it("should not change redeemers balances in any way", async () => {
                          // Redemption proof submission should NEVER cause
                          // any change of the redeemers balances.
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
                      "when output vector consists of pending requested redemptions, reported timed out requested redemptions and a non-zero change",
                      () => {
                        const data: RedemptionTestData =
                          MultiplePendingRequestedRedemptionsWithP2WPKHChange

                        let tx: ContractTransaction
                        let bridgeBalance: RedemptionBalanceChange
                        let walletPendingRedemptionsValue: RedemptionBalanceChange
                        let treasuryBalance: RedemptionBalanceChange
                        let redeemersBalances: RedemptionBalanceChange[]

                        before(async () => {
                          await createSnapshot()

                          // Before submitting the redemption proof, wait
                          // an amount of time that will make the requests
                          // timed out but report timeout only the two first
                          // requests.
                          const beforeProofActions = async () => {
                            await increaseTime(await bridge.redemptionTimeout())

                            await bridge.notifyRedemptionTimeout(
                              data.wallet.pubKeyHash,
                              data.redemptionRequests[0].redeemerOutputScript
                            )
                            await bridge.notifyRedemptionTimeout(
                              data.wallet.pubKeyHash,
                              data.redemptionRequests[1].redeemerOutputScript
                            )
                          }

                          // eslint-disable-next-line @typescript-eslint/no-extra-semi
                          ;({
                            tx,
                            bridgeBalance,
                            walletPendingRedemptionsValue,
                            treasuryBalance,
                            redeemersBalances,
                          } = await runRedemptionScenario(
                            data,
                            beforeProofActions
                          ))
                        })

                        after(async () => {
                          await restoreSnapshot()
                        })

                        it("should hold the timed out requests in the contract state", async () => {
                          // Check the two first requests reported as timed out
                          // are actually held in the contract state after
                          // proof submission.
                          for (let i = 0; i < 2; i++) {
                            const redemptionRequest =
                              // eslint-disable-next-line no-await-in-loop
                              await bridge.timedOutRedemptions(
                                buildRedemptionKey(
                                  data.wallet.pubKeyHash,
                                  data.redemptionRequests[i]
                                    .redeemerOutputScript
                                )
                              )

                            expect(
                              redemptionRequest.requestedAt
                            ).to.be.greaterThan(
                              0,
                              `Timed out request with index ${i} was removed from the contract state`
                            )
                          }
                        })

                        it("should close processed redemption requests", async () => {
                          // Check the remaining requests not reported as
                          // timed out were actually closed after proof
                          // submission.
                          for (
                            let i = 2;
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

                        it("should mark the previous main UTXO as spent", async () => {
                          const mainUtxoKey = ethers.utils.solidityKeccak256(
                            ["bytes32", "uint32"],
                            [data.mainUtxo.txHash, data.mainUtxo.txOutputIndex]
                          )

                          expect(await bridge.spentMainUTXOs(mainUtxoKey)).to.be
                            .true
                        })

                        it("should decrease the wallet's pending redemptions value", async () => {
                          // Wallet pending redemptions value should be
                          // decreased by the total redeemable amount. However,
                          // only pending requests are taken into account and
                          // all reported timeouts should be ignored because
                          // the appropriate bookkeeping was already made upon
                          // timeout reports. See docs of the used test data
                          // for details.
                          expect(
                            walletPendingRedemptionsValue.afterProof.sub(
                              walletPendingRedemptionsValue.beforeProof
                            )
                          ).to.equal(-4433350)
                        })

                        it("should decrease Bridge's balance in Bank", async () => {
                          // Balance should be decreased by the total
                          // redeemable amount. However, only pending requests
                          // are taken into account and all reported timeouts
                          // should be ignored because the appropriate
                          // bookkeeping was already made upon timeout reports.
                          // See docs of the used test data for details.
                          await expect(tx)
                            .to.emit(bank, "BalanceDecreased")
                            .withArgs(bridge.address, 4433350)
                          // However, the total balance change of the
                          // Bridge should also consider the treasury
                          // fee collected upon requests and transferred
                          // to the treasury at the end of the proof.
                          // This is why the total Bridge's balance change
                          // is equal to the total requested amount for
                          // all requests (without taking the reported timed
                          // out ones into account). See docs of the used test
                          // data for details.
                          expect(
                            bridgeBalance.afterProof.sub(
                              bridgeBalance.beforeProof
                            )
                          ).to.equal(-4435567)
                        })

                        it("should transfer collected treasury fee", async () => {
                          // Treasury balance should be increased by the total
                          // treasury fee for all requests. However, only
                          // pending requests are taken into account and all
                          // reported timeouts should be ignored because the
                          // appropriate bookkeeping was already made upon
                          // timeout reports. See docs of the used test data
                          // for details.
                          expect(
                            treasuryBalance.afterProof.sub(
                              treasuryBalance.beforeProof
                            )
                          ).to.equal(2217)
                        })

                        it("should not change redeemers balances in any way", async () => {
                          // Redemption proof submission should NEVER cause
                          // any change of the redeemers balances.
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
                      "when output vector contains a pending requested redemption with wrong amount redeemed",
                      () => {
                        const data: RedemptionTestData = JSON.parse(
                          JSON.stringify(MultiplePendingRequestedRedemptions)
                        )

                        let outcome: Promise<RedemptionScenarioOutcome>

                        before(async () => {
                          await createSnapshot()

                          // Alter the last redemption requests in the test
                          // data and set such an amount that will cause
                          // the Bitcoin redemption transaction to be deemed
                          // as invalid due to a wrong amount. The corresponding
                          // transaction output has the value of 191169 so to
                          // make this test scenario happen, the request amount
                          // must be way different (lesser or greater) than the
                          // output value. Worth noting that this test scenario
                          // tests the amount condition in a general and simplified
                          // way without stressing all specific edge cases.
                          // Doing a detailed check would require more dedicated
                          // test data sets which would make it far more
                          // complicated without giving much value in return.
                          data.redemptionRequests[4].amount = 100000

                          outcome = runRedemptionScenario(data)
                        })

                        after(async () => {
                          await restoreSnapshot()
                        })

                        it("should revert", async () => {
                          await expect(outcome).to.be.revertedWith(
                            "Output value is not within the acceptable range of the pending request"
                          )
                        })
                      }
                    )

                    context(
                      "when output vector contains a reported timed out requested redemption with wrong amount redeemed",
                      () => {
                        const data: RedemptionTestData = JSON.parse(
                          JSON.stringify(MultiplePendingRequestedRedemptions)
                        )

                        let outcome: Promise<RedemptionScenarioOutcome>

                        before(async () => {
                          await createSnapshot()

                          // Alter the last redemption requests in the test
                          // data and set such an amount that will cause
                          // the Bitcoin redemption transaction to be deemed
                          // as invalid due to a wrong amount. The corresponding
                          // transaction output has the value of 191169 so to
                          // make this test scenario happen, the request amount
                          // must be way different (lesser or greater) than the
                          // output value. Worth noting that this test scenario
                          // tests the amount condition in a general and simplified
                          // way without stressing all specific edge cases.
                          // Doing a detailed check would require more dedicated
                          // test data sets which would make it far more
                          // complicated without giving much value in return.
                          data.redemptionRequests[4].amount = 100000

                          // Before submitting the redemption proof, wait
                          // an amount of time that will make the last request
                          // timed out and then report the timeout.
                          const beforeProofActions = async () => {
                            await increaseTime(await bridge.redemptionTimeout())
                            await bridge.notifyRedemptionTimeout(
                              data.wallet.pubKeyHash,
                              data.redemptionRequests[4].redeemerOutputScript
                            )
                          }

                          outcome = runRedemptionScenario(
                            data,
                            beforeProofActions
                          )
                        })

                        after(async () => {
                          await restoreSnapshot()
                        })

                        it("should revert", async () => {
                          await expect(outcome).to.be.revertedWith(
                            "Output value is not within the acceptable range of the timed out request"
                          )
                        })
                      }
                    )

                    context(
                      "when output vector contains a non-zero P2SH change output",
                      () => {
                        const data: RedemptionTestData = JSON.parse(
                          JSON.stringify(
                            MultiplePendingRequestedRedemptionsWithP2SHChange
                          )
                        )

                        let outcome: Promise<RedemptionScenarioOutcome>

                        before(async () => {
                          await createSnapshot()

                          outcome = runRedemptionScenario(data)
                        })

                        after(async () => {
                          await restoreSnapshot()
                        })

                        // We have this case because P2SH script has a 20-byte
                        // payload which may match the 20-byte wallet public
                        // key hash though it should be always rejected as
                        // non-requested output. There is no need to check for
                        // P2WSH since the payload is always 32-byte there.
                        it("should revert", async () => {
                          await expect(outcome).to.be.revertedWith(
                            "Output is a non-requested redemption"
                          )
                        })
                      }
                    )

                    context(
                      "when output vector contains multiple non-zero change outputs",
                      () => {
                        const data: RedemptionTestData = JSON.parse(
                          JSON.stringify(
                            MultiplePendingRequestedRedemptionsWithMultipleP2WPKHChanges
                          )
                        )

                        let outcome: Promise<RedemptionScenarioOutcome>

                        before(async () => {
                          await createSnapshot()

                          outcome = runRedemptionScenario(data)
                        })

                        after(async () => {
                          await restoreSnapshot()
                        })

                        it("should revert", async () => {
                          await expect(outcome).to.be.revertedWith(
                            "Output is a non-requested redemption"
                          )
                        })
                      }
                    )

                    context(
                      "when output vector contains one change but with zero as value",
                      () => {
                        const data: RedemptionTestData = JSON.parse(
                          JSON.stringify(
                            MultiplePendingRequestedRedemptionsWithP2WPKHChangeZeroValue
                          )
                        )

                        let outcome: Promise<RedemptionScenarioOutcome>

                        before(async () => {
                          await createSnapshot()

                          outcome = runRedemptionScenario(data)
                        })

                        after(async () => {
                          await restoreSnapshot()
                        })

                        it("should revert", async () => {
                          await expect(outcome).to.be.revertedWith(
                            "Output is a non-requested redemption"
                          )
                        })
                      }
                    )

                    context(
                      "when output vector contains a non-requested redemption to an arbitrary script hash",
                      () => {
                        const data: RedemptionTestData = JSON.parse(
                          JSON.stringify(
                            MultiplePendingRequestedRedemptionsWithNonRequestedRedemption
                          )
                        )

                        let outcome: Promise<RedemptionScenarioOutcome>

                        before(async () => {
                          await createSnapshot()

                          outcome = runRedemptionScenario(data)
                        })

                        after(async () => {
                          await restoreSnapshot()
                        })

                        it("should revert", async () => {
                          await expect(outcome).to.be.revertedWith(
                            "Output is a non-requested redemption"
                          )
                        })
                      }
                    )

                    context(
                      "when output vector contains a provably unspendable OP_RETURN output",
                      () => {
                        const data: RedemptionTestData = JSON.parse(
                          JSON.stringify(
                            MultiplePendingRequestedRedemptionsWithProvablyUnspendable
                          )
                        )

                        let outcome: Promise<RedemptionScenarioOutcome>

                        before(async () => {
                          await createSnapshot()

                          outcome = runRedemptionScenario(data)
                        })

                        after(async () => {
                          await restoreSnapshot()
                        })

                        it("should revert", async () => {
                          await expect(outcome).to.be.revertedWith(
                            "Output is a non-requested redemption"
                          )
                        })
                      }
                    )
                  })
                })

                context("when wallet state is MovingFunds", () => {
                  const data: RedemptionTestData =
                    MultiplePendingRequestedRedemptionsWithP2WPKHChange

                  let outcome: Promise<RedemptionScenarioOutcome>

                  before(async () => {
                    await createSnapshot()

                    // Set wallet state to MovingFunds. That must be done
                    // just before proof submission since requests should
                    // be made against an Active wallet.
                    const beforeProofActions = async () => {
                      const wallet = await bridge.wallets(
                        data.wallet.pubKeyHash
                      )
                      await bridge.setWallet(data.wallet.pubKeyHash, {
                        ...wallet,
                        state: 2,
                      })
                    }

                    outcome = runRedemptionScenario(data, beforeProofActions)
                  })

                  after(async () => {
                    await restoreSnapshot()
                  })

                  // Just assert it passes without revert without repeating
                  // checks from Active state scenario.
                  it("should succeed", async () => {
                    await expect(outcome).to.not.be.reverted
                  })
                })

                context(
                  "when wallet state is neither Active nor MovingFunds",
                  () => {
                    context("when wallet state is Unknown", () => {
                      const data: RedemptionTestData =
                        MultiplePendingRequestedRedemptionsWithP2WPKHChange

                      let outcome: Promise<RedemptionScenarioOutcome>

                      before(async () => {
                        await createSnapshot()

                        // Set wallet state to Unknown. That must be done
                        // just before proof submission since requests should
                        // be made against an Active wallet.
                        const beforeProofActions = async () => {
                          const wallet = await bridge.wallets(
                            data.wallet.pubKeyHash
                          )
                          await bridge.setWallet(data.wallet.pubKeyHash, {
                            ...wallet,
                            state: 0,
                          })
                        }

                        outcome = runRedemptionScenario(
                          data,
                          beforeProofActions
                        )
                      })

                      after(async () => {
                        await restoreSnapshot()
                      })

                      it("should revert", async () => {
                        await expect(outcome).to.be.revertedWith(
                          "'Wallet must be in Active or MovingFuds state"
                        )
                      })
                    })

                    context("when wallet state is Closed", () => {
                      const data: RedemptionTestData =
                        MultiplePendingRequestedRedemptionsWithP2WPKHChange

                      let outcome: Promise<RedemptionScenarioOutcome>

                      before(async () => {
                        await createSnapshot()

                        // Set wallet state to Closed. That must be done
                        // just before proof submission since requests should
                        // be made against an Active wallet.
                        const beforeProofActions = async () => {
                          const wallet = await bridge.wallets(
                            data.wallet.pubKeyHash
                          )
                          await bridge.setWallet(data.wallet.pubKeyHash, {
                            ...wallet,
                            state: 3,
                          })
                        }

                        outcome = runRedemptionScenario(
                          data,
                          beforeProofActions
                        )
                      })

                      after(async () => {
                        await restoreSnapshot()
                      })

                      it("should revert", async () => {
                        await expect(outcome).to.be.revertedWith(
                          "'Wallet must be in Active or MovingFuds state"
                        )
                      })
                    })

                    context("when wallet state is Terminated", () => {
                      const data: RedemptionTestData =
                        MultiplePendingRequestedRedemptionsWithP2WPKHChange

                      let outcome: Promise<RedemptionScenarioOutcome>

                      before(async () => {
                        await createSnapshot()

                        // Set wallet state to Terminated. That must be done
                        // just before proof submission since requests should
                        // be made against an Active wallet.
                        const beforeProofActions = async () => {
                          const wallet = await bridge.wallets(
                            data.wallet.pubKeyHash
                          )
                          await bridge.setWallet(data.wallet.pubKeyHash, {
                            ...wallet,
                            state: 4,
                          })
                        }

                        outcome = runRedemptionScenario(
                          data,
                          beforeProofActions
                        )
                      })

                      after(async () => {
                        await restoreSnapshot()
                      })

                      it("should revert", async () => {
                        await expect(outcome).to.be.revertedWith(
                          "'Wallet must be in Active or MovingFuds state"
                        )
                      })
                    })
                  }
                )
              }
            )

            context(
              "when the single input doesn't point to the wallet's main UTXO",
              () => {
                const data: RedemptionTestData = JSON.parse(
                  JSON.stringify(
                    MultiplePendingRequestedRedemptionsWithP2WPKHChange
                  )
                )

                let outcome: Promise<RedemptionScenarioOutcome>

                before(async () => {
                  await createSnapshot()

                  // Corrupt the wallet's main UTXO that is injected to
                  // the Bridge state by the test runner in order to make it
                  // different than the input used by the actual Bitcoin
                  // transaction thus make the tested scenario happen. The
                  // proper value of `txOutputIndex` is `5` so any other value
                  // will do the trick.
                  data.mainUtxo.txOutputIndex = 10

                  outcome = runRedemptionScenario(data)
                })

                after(async () => {
                  await restoreSnapshot()
                })

                it("should revert", async () => {
                  await expect(outcome).to.be.revertedWith(
                    "Redemption transaction input must point to the wallet's main UTXO"
                  )
                })
              }
            )
          })

          context("when input count is other than one", () => {
            const data: RedemptionTestData =
              MultiplePendingRequestedRedemptionsWithMultipleInputs

            let outcome: Promise<RedemptionScenarioOutcome>

            before(async () => {
              await createSnapshot()

              outcome = runRedemptionScenario(data)
            })

            after(async () => {
              await restoreSnapshot()
            })

            it("should revert", async () => {
              await expect(outcome).to.be.revertedWith(
                "Redemption transaction must have a single input"
              )
            })
          })
        })

        context("when main UTXO data are invalid", () => {
          const data: RedemptionTestData =
            MultiplePendingRequestedRedemptionsWithP2WPKHChange

          before(async () => {
            await createSnapshot()

            // Required for a successful SPV proof.
            await relay.setPrevEpochDifficulty(data.chainDifficulty)
            await relay.setCurrentEpochDifficulty(data.chainDifficulty)

            // Wallet main UTXO must be set on the Bridge side to make
            // that scenario happen.
            await bridge.setMainUtxo(data.wallet.pubKeyHash, data.mainUtxo)
          })

          after(async () => {
            await restoreSnapshot()
          })

          it("should revert", async () => {
            // Corrupt the main UTXO parameter passed during
            // `submitRedemptionProof` call. The proper value of
            // `txOutputIndex` for this test data set is `5` so any other
            // value will make this test scenario happen.
            const corruptedMainUtxo = {
              ...data.mainUtxo,
              txOutputIndex: 10,
            }

            await expect(
              bridge.submitRedemptionProof(
                data.redemptionTx,
                data.redemptionProof,
                corruptedMainUtxo,
                data.wallet.pubKeyHash
              )
            ).to.be.revertedWith("Invalid main UTXO data")
          })
        })
      })

      context("when there is no main UTXO for the given wallet", () => {
        const data: RedemptionTestData =
          MultiplePendingRequestedRedemptionsWithP2WPKHChange

        before(async () => {
          await createSnapshot()

          // Required for a successful SPV proof.
          await relay.setPrevEpochDifficulty(data.chainDifficulty)
          await relay.setCurrentEpochDifficulty(data.chainDifficulty)
        })

        after(async () => {
          await restoreSnapshot()
        })

        it("should revert", async () => {
          // There was no preparations before `submitRedemptionProof` call
          // so no main UTXO is set for the given wallet.
          await expect(
            bridge.submitRedemptionProof(
              data.redemptionTx,
              data.redemptionProof,
              data.mainUtxo,
              data.wallet.pubKeyHash
            )
          ).to.be.revertedWith("No main UTXO for given wallet")
        })
      })
    })

    context("when transaction proof is not valid", () => {
      context("when input vector is not valid", () => {
        const data: RedemptionTestData = JSON.parse(
          JSON.stringify(SinglePendingRequestedRedemption)
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
          data.redemptionTx.inputVector =
            "0x00b69a2869840aa6fdfd143136ff4514ca46ea2d876855040892ad74ab" +
            "8c5274220100000000ffffffff"

          await expect(runRedemptionScenario(data)).to.be.revertedWith(
            "Invalid input vector provided"
          )
        })
      })

      context("when output vector is not valid", () => {
        const data: RedemptionTestData = JSON.parse(
          JSON.stringify(SinglePendingRequestedRedemption)
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
          data.redemptionTx.outputVector =
            "0x005cf511000000000017a91486884e6be1525dab5ae0b451bd2c72cee6" +
            "7dcf4187"

          await expect(runRedemptionScenario(data)).to.be.revertedWith(
            "Invalid output vector provided"
          )
        })
      })

      context("when merkle proof is not valid", () => {
        const data: RedemptionTestData = JSON.parse(
          JSON.stringify(SinglePendingRequestedRedemption)
        )

        before(async () => {
          await createSnapshot()
        })

        after(async () => {
          await restoreSnapshot()
        })

        it("should revert", async () => {
          // Corrupt the merkle proof by changing tx index in block to an
          // invalid one. The proper one is 33 so any other will do the trick.
          data.redemptionProof.txIndexInBlock = 30

          await expect(runRedemptionScenario(data)).to.be.revertedWith(
            "Tx merkle proof is not valid for provided header and tx hash"
          )
        })
      })

      context("when proof difficulty is not current nor previous", () => {
        const data: RedemptionTestData = JSON.parse(
          JSON.stringify(SinglePendingRequestedRedemption)
        )

        before(async () => {
          await createSnapshot()
        })

        after(async () => {
          await restoreSnapshot()
        })

        it("should revert", async () => {
          // To pass the proof validation, the difficulty returned by the relay
          // must be 1 for test data used in this scenario. Setting
          // a different value will cause difficulty comparison failure.
          data.chainDifficulty = 2

          await expect(runRedemptionScenario(data)).to.be.revertedWith(
            "Not at current or previous difficulty"
          )
        })
      })

      context("when headers chain length is not valid", () => {
        const data: RedemptionTestData = JSON.parse(
          JSON.stringify(SinglePendingRequestedRedemption)
        )

        before(async () => {
          await createSnapshot()
        })

        after(async () => {
          await restoreSnapshot()
        })

        it("should revert", async () => {
          // Corrupt the bitcoin headers length in the redemption proof. The
          // proper value is length divisible by 80 so any length violating
          // this rule will cause failure. In this case, we just remove the
          // last byte from proper headers chain.
          const properHeaders = data.redemptionProof.bitcoinHeaders.toString()
          data.redemptionProof.bitcoinHeaders = properHeaders.substring(
            0,
            properHeaders.length - 2
          )

          await expect(runRedemptionScenario(data)).to.be.revertedWith(
            "Invalid length of the headers chain"
          )
        })
      })

      context("when headers chain is not valid", () => {
        const data: RedemptionTestData = JSON.parse(
          JSON.stringify(SinglePendingRequestedRedemption)
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
          const properHeaders = data.redemptionProof.bitcoinHeaders.toString()
          data.redemptionProof.bitcoinHeaders = `${properHeaders.substring(
            0,
            170
          )}ff${properHeaders.substring(172)}`

          await expect(runRedemptionScenario(data)).to.be.revertedWith(
            "Invalid headers chain"
          )
        })
      })

      context("when the work in the header is insufficient", () => {
        const data: RedemptionTestData = JSON.parse(
          JSON.stringify(SinglePendingRequestedRedemption)
        )

        before(async () => {
          await createSnapshot()
        })

        after(async () => {
          await restoreSnapshot()
        })

        it("should revert", async () => {
          // Each header encodes a `difficulty target` field in bytes 72-76.
          // The given header's hash (interpreted as uint) must be bigger than
          // the `difficulty target`. To test this scenario, we change the
          // last byte of the last header in such a way their hash becomes
          // lower than their `difficulty target`.
          const properHeaders = data.redemptionProof.bitcoinHeaders.toString()
          data.redemptionProof.bitcoinHeaders = `${properHeaders.substring(
            0,
            properHeaders.length - 2
          )}ff`

          await expect(runRedemptionScenario(data)).to.be.revertedWith(
            "Insufficient work in a header"
          )
        })
      })

      context(
        "when accumulated difficulty in headers chain is insufficient",
        () => {
          let otherBridge: Bridge
          const data: RedemptionTestData = JSON.parse(
            JSON.stringify(SinglePendingRequestedRedemption)
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
              otherBridge.submitRedemptionProof(
                data.redemptionTx,
                data.redemptionProof,
                data.mainUtxo,
                data.wallet.pubKeyHash
              )
            ).to.be.revertedWith(
              "Insufficient accumulated difficulty in header chain"
            )
          })
        }
      )
    })
  })

  describe("submitFraudChallenge", () => {
    const fraudChallengeDepositAmount = ethers.utils.parseEther("2")
    const data = witnessSignSingleInputTx

    context("when the amount of sent ether is too small", () => {
      before(async () => {
        await createSnapshot()
        await bridge.setWallet(fraudWalletPublicKeyHash, {
          state: 1,
          pendingRedemptionsValue: 0,
        })
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
              fraudWalletPublicKey,
              data.sighash,
              data.signature.v,
              data.signature.r,
              data.signature.s,
              {
                value: fraudChallengeDepositAmount.sub(1),
              }
            )
        ).to.be.revertedWith("The amount of ETH deposited is too low")
      })
    })

    context("when incorrect wallet public key is used", () => {
      const incorrectWalletPublicKey =
        "0xffc045ade19f8a5d464299146ce069049cdcc2390a9b44d9abcd83f11d8cce4" +
        "01ea6800e307b87aadebdcd2f7293cc60f0526afaff1a7b1abddfd787e6c5871e"

      const incorrectWalletPublicKeyHash =
        "0xb5222794425b9b8cd8c3358e73a50dea73480927"

      before(async () => {
        await createSnapshot()
        await bridge.setWallet(incorrectWalletPublicKeyHash, {
          state: 1,
          pendingRedemptionsValue: 0,
        })
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
              incorrectWalletPublicKey,
              data.sighash,
              data.signature.v,
              data.signature.r,
              data.signature.s,
              {
                value: fraudChallengeDepositAmount,
              }
            )
        ).to.be.revertedWith("Signature verification failure")
      })
    })

    context("when incorrect sighash is used", () => {
      const incorrectSighash =
        "0x9e8e249791a5636e5e007fc15487b5a5bd6e60f73f7e236a7025cd63b904650b"

      before(async () => {
        await createSnapshot()
        await bridge.setWallet(fraudWalletPublicKeyHash, {
          state: 1,
          pendingRedemptionsValue: 0,
        })
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
              fraudWalletPublicKey,
              incorrectSighash,
              data.signature.v,
              data.signature.r,
              data.signature.s,
              {
                value: fraudChallengeDepositAmount,
              }
            )
        ).to.be.revertedWith("Signature verification failure")
      })
    })

    context("when incorrect recovery ID is used", () => {
      const incorrectV = data.signature.v + 1

      before(async () => {
        await createSnapshot()
        await bridge.setWallet(fraudWalletPublicKeyHash, {
          state: 1,
          pendingRedemptionsValue: 0,
        })
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
              fraudWalletPublicKey,
              data.sighash,
              incorrectV,
              data.signature.r,
              data.signature.s,
              {
                value: fraudChallengeDepositAmount,
              }
            )
        ).to.be.revertedWith("Signature verification failure")
      })
    })

    context("when incorrect signature data is used", () => {
      // just swap r and s
      const incorrectS = data.signature.r
      const incorrectR = data.signature.s

      before(async () => {
        await createSnapshot()
        await bridge.setWallet(fraudWalletPublicKeyHash, {
          state: 1,
          pendingRedemptionsValue: 0,
        })
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
              fraudWalletPublicKey,
              data.sighash,
              data.signature.v,
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
        await bridge.setWallet(fraudWalletPublicKeyHash, {
          state: 1,
          pendingRedemptionsValue: 0,
        })
        await bridge
          .connect(thirdParty)
          .submitFraudChallenge(
            fraudWalletPublicKey,
            data.sighash,
            data.signature.v,
            data.signature.r,
            data.signature.s,
            {
              value: fraudChallengeDepositAmount,
            }
          )
      })

      after(async () => {
        await restoreSnapshot()
      })

      it("should revert", async () => {
        await expect(
          bridge
            .connect(thirdParty)
            .submitFraudChallenge(
              fraudWalletPublicKey,
              data.sighash,
              data.signature.v,
              data.signature.r,
              data.signature.s,
              {
                value: fraudChallengeDepositAmount,
              }
            )
        ).to.be.revertedWith("Fraud challenge already exists")
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
          await bridge.setWallet(fraudWalletPublicKeyHash, {
            state: 1,
            pendingRedemptionsValue: 0,
          })
          tx = await bridge
            .connect(thirdParty)
            .submitFraudChallenge(
              fraudWalletPublicKey,
              data.sighash,
              data.signature.v,
              data.signature.r,
              data.signature.s,
              {
                value: fraudChallengeDepositAmount,
              }
            )
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
            fraudWalletPublicKey,
            data.sighash,
            data.signature.v,
            data.signature.r,
            data.signature.s
          )
          const fraudChallenge = await bridge.fraudChallenges(challengeKey)
          expect(fraudChallenge.challenger).to.equal(
            await thirdParty.getAddress()
          )
          expect(fraudChallenge.ethDepositAmount).to.equal(
            fraudChallengeDepositAmount
          )
          expect(fraudChallenge.reportedAt).to.equal(await lastBlockTime())
          expect(fraudChallenge.closed).to.equal(false)
        })

        it("should emit FraudChallengeSubmitted event", async () => {
          await expect(tx)
            .to.emit(bridge, "FraudChallengeSubmitted")
            .withArgs(
              fraudWalletPublicKeyHash,
              data.sighash,
              data.signature.v,
              data.signature.r,
              data.signature.s
            )
        })
      }
    )
  })

  describe("defeatFraudChallenge", () => {
    const fraudChallengeDepositAmount = ethers.utils.parseEther("2")

    context("when the challenge exists", () => {
      context("when the challenge is open", () => {
        context("when the sighash type is correct", () => {
          context("when the input is non-witness", () => {
            context("when the transaction has single input", () => {
              context(
                "when the inputs are marked correctly spent in the Bridge",
                () => {
                  const data = nonWitnessSignSingleInputTx
                  let tx: Transaction

                  before(async () => {
                    await createSnapshot()
                    await bridge.setWallet(fraudWalletPublicKeyHash, {
                      state: 1,
                      pendingRedemptionsValue: 0,
                    })
                    await bridge
                      .connect(governance)
                      .setFraudChallengeDepositAmount(
                        fraudChallengeDepositAmount
                      )
                    await bridge.setSweptDeposits(data.deposits)
                    await bridge.setSpentMainUtxos(data.spentMainUtxos)
                    await bridge
                      .connect(thirdParty)
                      .submitFraudChallenge(
                        fraudWalletPublicKey,
                        data.sighash,
                        data.signature.v,
                        data.signature.r,
                        data.signature.s,
                        {
                          value: fraudChallengeDepositAmount,
                        }
                      )
                    tx = await bridge
                      .connect(thirdParty)
                      .defeatFraudChallenge(
                        fraudWalletPublicKey,
                        data.preimage,
                        data.signature.v,
                        data.signature.r,
                        data.signature.s,
                        false
                      )
                  })

                  after(async () => {
                    await restoreSnapshot()
                  })

                  it("should mark the challenge as closed", async () => {
                    const challengeKey = buildChallengeKey(
                      fraudWalletPublicKey,
                      data.sighash,
                      data.signature.v,
                      data.signature.r,
                      data.signature.s
                    )
                    const fraudChallenge = await bridge.fraudChallenges(
                      challengeKey
                    )
                    expect(fraudChallenge.closed).to.equal(true)
                  })

                  it("should send the ether deposited by the challenger to the treasury", async () => {
                    await expect(tx).to.changeEtherBalance(
                      bridge,
                      fraudChallengeDepositAmount.mul(-1)
                    )
                    await expect(tx).to.changeEtherBalance(
                      treasury,
                      fraudChallengeDepositAmount
                    )
                  })

                  it("should emit FraudChallengeDefeated event", async () => {
                    await expect(tx)
                      .to.emit(bridge, "FraudChallengeDefeated")
                      .withArgs(
                        fraudWalletPublicKeyHash,
                        data.sighash,
                        data.signature.v,
                        data.signature.r,
                        data.signature.s
                      )
                  })
                }
              )

              context(
                "when the inputs are not marked as correctly spent in the Bridge",
                () => {
                  const data = nonWitnessSignSingleInputTx

                  before(async () => {
                    await createSnapshot()
                    await bridge.setWallet(fraudWalletPublicKeyHash, {
                      state: 1,
                      pendingRedemptionsValue: 0,
                    })
                    await bridge
                      .connect(governance)
                      .setFraudChallengeDepositAmount(
                        fraudChallengeDepositAmount
                      )
                    await bridge
                      .connect(thirdParty)
                      .submitFraudChallenge(
                        fraudWalletPublicKey,
                        data.sighash,
                        data.signature.v,
                        data.signature.r,
                        data.signature.s,
                        {
                          value: fraudChallengeDepositAmount,
                        }
                      )
                  })

                  after(async () => {
                    await restoreSnapshot()
                  })

                  it("should revert", async () => {
                    await expect(
                      bridge
                        .connect(thirdParty)
                        .defeatFraudChallenge(
                          fraudWalletPublicKey,
                          data.preimage,
                          data.signature.v,
                          data.signature.r,
                          data.signature.s,
                          false
                        )
                    ).to.be.revertedWith(
                      "Spent UTXO not found among correctly spent UTXOs"
                    )
                  })
                }
              )
            })

            context("when the transaction has multiple inputs", () => {
              context(
                "when the inputs are marked correctly spent in the Bridge",
                () => {
                  const data = nonWitnessSignMultipleInputsTx
                  let tx: Transaction

                  before(async () => {
                    await createSnapshot()
                    await bridge
                      .connect(governance)
                      .setFraudChallengeDepositAmount(
                        fraudChallengeDepositAmount
                      )
                    await bridge.setWallet(fraudWalletPublicKeyHash, {
                      state: 1,
                      pendingRedemptionsValue: 0,
                    })
                    await bridge.setSweptDeposits(data.deposits)
                    await bridge.setSpentMainUtxos(data.spentMainUtxos)
                    await bridge
                      .connect(thirdParty)
                      .submitFraudChallenge(
                        fraudWalletPublicKey,
                        data.sighash,
                        data.signature.v,
                        data.signature.r,
                        data.signature.s,
                        {
                          value: fraudChallengeDepositAmount,
                        }
                      )
                    tx = await bridge
                      .connect(thirdParty)
                      .defeatFraudChallenge(
                        fraudWalletPublicKey,
                        data.preimage,
                        data.signature.v,
                        data.signature.r,
                        data.signature.s,
                        false
                      )
                  })

                  after(async () => {
                    await restoreSnapshot()
                  })

                  it("should mark the challenge as closed", async () => {
                    const challengeKey = buildChallengeKey(
                      fraudWalletPublicKey,
                      data.sighash,
                      data.signature.v,
                      data.signature.r,
                      data.signature.s
                    )
                    const fraudChallenge = await bridge.fraudChallenges(
                      challengeKey
                    )
                    expect(fraudChallenge.closed).to.equal(true)
                  })

                  it("should send the ether deposited by the challenger to the treasury", async () => {
                    await expect(tx).to.changeEtherBalance(
                      bridge,
                      fraudChallengeDepositAmount.mul(-1)
                    )
                    await expect(tx).to.changeEtherBalance(
                      treasury,
                      fraudChallengeDepositAmount
                    )
                  })

                  it("should emit FraudChallengeDefeated event", async () => {
                    await expect(tx)
                      .to.emit(bridge, "FraudChallengeDefeated")
                      .withArgs(
                        fraudWalletPublicKeyHash,
                        data.sighash,
                        data.signature.v,
                        data.signature.r,
                        data.signature.s
                      )
                  })
                }
              )

              context(
                "when the inputs are not marked as correctly spent in the Bridge",
                () => {
                  const data = nonWitnessSignMultipleInputsTx

                  before(async () => {
                    await createSnapshot()
                    await bridge
                      .connect(governance)
                      .setFraudChallengeDepositAmount(
                        fraudChallengeDepositAmount
                      )
                    await bridge.setWallet(fraudWalletPublicKeyHash, {
                      state: 1,
                      pendingRedemptionsValue: 0,
                    })
                    await bridge
                      .connect(thirdParty)
                      .submitFraudChallenge(
                        fraudWalletPublicKey,
                        data.sighash,
                        data.signature.v,
                        data.signature.r,
                        data.signature.s,
                        {
                          value: fraudChallengeDepositAmount,
                        }
                      )
                  })

                  after(async () => {
                    await restoreSnapshot()
                  })

                  it("should revert", async () => {
                    await expect(
                      bridge
                        .connect(thirdParty)
                        .defeatFraudChallenge(
                          fraudWalletPublicKey,
                          data.preimage,
                          data.signature.v,
                          data.signature.r,
                          data.signature.s,
                          false
                        )
                    ).to.be.revertedWith(
                      "Spent UTXO not found among correctly spent UTXOs"
                    )
                  })
                }
              )
            })
          })

          context("when the input is witness", () => {
            context("when the transaction has single input", () => {
              context(
                "when the inputs are marked correctly spent in the Bridge",
                () => {
                  //  TODO: Implement
                }
              )

              context(
                "when the inputs are not marked as correctly spent in the Bridge",
                () => {
                  // TODO: Implement
                }
              )
            })

            context("when the transaction has multiple inputs", () => {
              context(
                "when the inputs are marked correctly spent in the Bridge",
                () => {
                  // TODO: Implement
                }
              )

              context(
                "when the inputs are not marked as correctly spent in the Bridge",
                () => {
                  // TODO:Implement
                }
              )
            })
          })
        })

        context("when the sighash type is incorrect", () => {
          // TODO: Implement
        })
      })

      context("when the challenge is closed", () => {
        // TODO: Implement
      })
    })

    context("when the challenge does not exist", () => {
      const data = nonWitnessSignMultipleInputsTx

      before(async () => {
        await createSnapshot()
      })

      after(async () => {
        await restoreSnapshot()
      })

      it("should revert", async () => {
        await expect(
          bridge
            .connect(thirdParty)
            .defeatFraudChallenge(
              fraudWalletPublicKey,
              data.preimage,
              data.signature.v,
              data.signature.r,
              data.signature.s,
              false
            )
        ).to.be.revertedWith("Fraud challenge does not exist")
      })
    })
  })

  describe("notifyChallengeTimeout", () => {
    const fraudChallengeDepositAmount = ethers.utils.parseEther("2")
    const fraudChallengeDefendTimeout = 7 * 24 * 3600 // 7 days
    const data = nonWitnessSignSingleInputTx

    describe("when the fraud challenge exists", () => {
      describe("when the fraud challenge is open", () => {
        describe("when the fraud challenge has timed out", () => {
          let tx: Transaction

          before(async () => {
            await createSnapshot()
            await bridge.setWallet(fraudWalletPublicKeyHash, {
              state: 1,
              pendingRedemptionsValue: 0,
            })
            await bridge
              .connect(governance)
              .setFraudChallengeDepositAmount(fraudChallengeDepositAmount)
            await bridge
              .connect(governance)
              .setFraudChallengeDefendTimeout(fraudChallengeDefendTimeout)
            await bridge.setSweptDeposits(data.deposits)
            await bridge.setSpentMainUtxos(data.spentMainUtxos)
            await bridge
              .connect(thirdParty)
              .submitFraudChallenge(
                fraudWalletPublicKey,
                data.sighash,
                data.signature.v,
                data.signature.r,
                data.signature.s,
                {
                  value: fraudChallengeDepositAmount,
                }
              )
            await increaseTime(fraudChallengeDefendTimeout)
            tx = await bridge
              .connect(thirdParty)
              .notifyFraudChallengeTimeout(
                fraudWalletPublicKey,
                data.sighash,
                data.signature.v,
                data.signature.r,
                data.signature.s
              )
          })

          after(async () => {
            await restoreSnapshot()
          })

          it("should mark the fraud challenge as closed", async () => {
            const challengeKey = buildChallengeKey(
              fraudWalletPublicKey,
              data.sighash,
              data.signature.v,
              data.signature.r,
              data.signature.s
            )
            const fraudChallenge = await bridge.fraudChallenges(challengeKey)
            expect(fraudChallenge.closed).to.be.true
          })

          it("should return the deposited ether to the challenger", async () => {
            await expect(tx).to.changeEtherBalance(
              bridge,
              fraudChallengeDepositAmount.mul(-1)
            )
            await expect(tx).to.changeEtherBalance(
              thirdParty,
              fraudChallengeDepositAmount
            )
          })

          it("should emit FraudChallengeTimeout event", async () => {
            await expect(tx)
              .to.emit(bridge, "FraudChallengeTimeout")
              .withArgs(
                fraudWalletPublicKeyHash,
                data.sighash,
                data.signature.v,
                data.signature.r,
                data.signature.s
              )
          })
        })

        describe("when the fraud challenge has not timed out yet", () => {
          before(async () => {
            await createSnapshot()
            await bridge.setWallet(fraudWalletPublicKeyHash, {
              state: 1,
              pendingRedemptionsValue: 0,
            })
            await bridge
              .connect(governance)
              .setFraudChallengeDepositAmount(fraudChallengeDepositAmount)
            await bridge
              .connect(governance)
              .setFraudChallengeDefendTimeout(fraudChallengeDefendTimeout)
            await bridge.setSweptDeposits(data.deposits)
            await bridge.setSpentMainUtxos(data.spentMainUtxos)
            await bridge
              .connect(thirdParty)
              .submitFraudChallenge(
                fraudWalletPublicKey,
                data.sighash,
                data.signature.v,
                data.signature.r,
                data.signature.s,
                {
                  value: fraudChallengeDepositAmount,
                }
              )
            await increaseTime(fraudChallengeDefendTimeout - 2)
          })

          after(async () => {
            await restoreSnapshot()
          })

          it("should revert", async () => {
            await expect(
              bridge
                .connect(thirdParty)
                .notifyFraudChallengeTimeout(
                  fraudWalletPublicKey,
                  data.sighash,
                  data.signature.v,
                  data.signature.r,
                  data.signature.s
                )
            ).to.be.revertedWith(
              "Fraud challenge defend timeout has not elapsed"
            )
          })
        })
      })

      describe("when the fraud challenge is closed by challenge defeat", () => {
        before(async () => {
          await createSnapshot()
          await bridge.setWallet(fraudWalletPublicKeyHash, {
            state: 1,
            pendingRedemptionsValue: 0,
          })
          await bridge
            .connect(governance)
            .setFraudChallengeDepositAmount(fraudChallengeDepositAmount)
          await bridge.setSweptDeposits(data.deposits)
          await bridge.setSpentMainUtxos(data.spentMainUtxos)
          await bridge
            .connect(thirdParty)
            .submitFraudChallenge(
              fraudWalletPublicKey,
              data.sighash,
              data.signature.v,
              data.signature.r,
              data.signature.s,
              {
                value: fraudChallengeDepositAmount,
              }
            )
          await bridge
            .connect(thirdParty)
            .defeatFraudChallenge(
              fraudWalletPublicKey,
              data.preimage,
              data.signature.v,
              data.signature.r,
              data.signature.s,
              false
            )
        })

        after(async () => {
          await restoreSnapshot()
        })

        it("should revert", async () => {
          await expect(
            bridge
              .connect(thirdParty)
              .notifyFraudChallengeTimeout(
                fraudWalletPublicKey,
                data.sighash,
                data.signature.v,
                data.signature.r,
                data.signature.s
              )
          ).to.be.revertedWith("Fraud challenge is closed")
        })
      })

      describe("when the fraud challenge is closed by previous timeout notification", () => {
        before(async () => {
          await createSnapshot()
          await bridge.setWallet(fraudWalletPublicKeyHash, {
            state: 1,
            pendingRedemptionsValue: 0,
          })
          await bridge
            .connect(governance)
            .setFraudChallengeDepositAmount(fraudChallengeDepositAmount)
          await bridge
            .connect(governance)
            .setFraudChallengeDefendTimeout(fraudChallengeDefendTimeout)
          await bridge.setSweptDeposits(data.deposits)
          await bridge.setSpentMainUtxos(data.spentMainUtxos)
          await bridge
            .connect(thirdParty)
            .submitFraudChallenge(
              fraudWalletPublicKey,
              data.sighash,
              data.signature.v,
              data.signature.r,
              data.signature.s,
              {
                value: fraudChallengeDepositAmount,
              }
            )
          await increaseTime(fraudChallengeDefendTimeout)
          await bridge
            .connect(thirdParty)
            .notifyFraudChallengeTimeout(
              fraudWalletPublicKey,
              data.sighash,
              data.signature.v,
              data.signature.r,
              data.signature.s
            )
        })

        after(async () => {
          await restoreSnapshot()
        })

        it("should revert", async () => {
          await expect(
            bridge
              .connect(thirdParty)
              .notifyFraudChallengeTimeout(
                fraudWalletPublicKey,
                data.sighash,
                data.signature.v,
                data.signature.r,
                data.signature.s
              )
          ).to.be.revertedWith("Fraud challenge is closed")
        })
      })
    })

    describe("when the fraud challenge does not exist", () => {
      before(async () => {
        await createSnapshot()
      })

      after(async () => {
        await restoreSnapshot()
      })

      it("should revert", async () => {
        await expect(
          bridge
            .connect(thirdParty)
            .notifyFraudChallengeTimeout(
              fraudWalletPublicKey,
              data.sighash,
              data.signature.v,
              data.signature.r,
              data.signature.s
            )
        ).to.be.revertedWith("Fraud challenge does not exist")
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

  interface RedemptionScenarioOutcome {
    tx: ContractTransaction
    bridgeBalance: RedemptionBalanceChange
    walletPendingRedemptionsValue: RedemptionBalanceChange
    treasuryBalance: RedemptionBalanceChange
    redeemersBalances: RedemptionBalanceChange[]
  }

  async function runRedemptionScenario(
    data: RedemptionTestData,
    beforeProofActions?: () => Promise<void>
  ): Promise<RedemptionScenarioOutcome> {
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

      await makeRedemptionAllowance(redeemerSigner, amount)

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

    if (beforeProofActions) {
      await beforeProofActions()
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

  async function makeRedemptionAllowance(
    redeemer: SignerWithAddress,
    amount: BigNumberish
  ) {
    // Simulate the redeemer has a TBTC balance allowing to make the request.
    await bank.setBalance(redeemer.address, amount)
    // Redeemer must allow the Bridge to spent the requested amount.
    await bank
      .connect(redeemer)
      .increaseBalanceAllowance(bridge.address, amount)
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
