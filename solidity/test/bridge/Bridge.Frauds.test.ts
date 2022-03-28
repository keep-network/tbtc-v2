/* eslint-disable no-underscore-dangle */
/* eslint-disable @typescript-eslint/no-unused-expressions */

import { ethers, helpers, waffle } from "hardhat"
import { SignerWithAddress } from "@nomiclabs/hardhat-ethers/signers"
import chai, { expect } from "chai"
import { ContractTransaction } from "ethers"
import { BytesLike } from "@ethersproject/bytes"
import { smock } from "@defi-wonderland/smock"
import type {
  Bank,
  BankStub,
  BankStub__factory,
  BitcoinTx__factory,
  Bridge,
  BridgeStub,
  BridgeStub__factory,
  TestRelay,
  TestRelay__factory,
  IWalletRegistry,
  Frauds,
  Frauds__factory,
} from "../../typechain"
import {
  walletPublicKey,
  walletPublicKeyHash,
  nonWitnessSignSingleInputTx,
  nonWitnessSignMultipleInputsTx,
  witnessSignSingleInputTx,
  witnessSignMultipleInputTx,
  wrongSighashType,
} from "../data/fraud"
import { walletState } from "../fixtures"
import { Wallets__factory } from "../../typechain"

chai.use(smock.matchers)

const { createSnapshot, restoreSnapshot } = helpers.snapshot
const { lastBlockTime, increaseTime } = helpers.time

const fixture = async () => {
  const [deployer, governance, thirdParty, treasury] = await ethers.getSigners()

  const Bank = await ethers.getContractFactory<BankStub__factory>("BankStub")
  const bank: Bank & BankStub = await Bank.deploy()
  await bank.deployed()

  // TODO: Use Smock fake and get rid of `TestRelay` contract.
  const TestRelay = await ethers.getContractFactory<TestRelay__factory>(
    "TestRelay"
  )
  const relay: TestRelay = await TestRelay.deploy()
  await relay.deployed()

  const walletRegistry = await smock.fake<IWalletRegistry>("IWalletRegistry")
  // Fund the `walletRegistry` account so it's possible to mock sending requests
  // from it.
  await deployer.sendTransaction({
    to: walletRegistry.address,
    value: ethers.utils.parseEther("1"),
  })

  const BitcoinTx = await ethers.getContractFactory<BitcoinTx__factory>(
    "BitcoinTx"
  )
  const bitcoinTx = await BitcoinTx.deploy()
  await bitcoinTx.deployed()

  const Wallets = await ethers.getContractFactory<Wallets__factory>("Wallets")
  const wallets = await Wallets.deploy()
  await wallets.deployed()

  const Frauds = await ethers.getContractFactory<Frauds__factory>("Frauds")
  const frauds: Frauds = await Frauds.deploy()
  await frauds.deployed()

  const Bridge = await ethers.getContractFactory<BridgeStub__factory>(
    "BridgeStub",
    {
      libraries: {
        BitcoinTx: bitcoinTx.address,
        Wallets: wallets.address,
        Frauds: frauds.address,
      },
    }
  )
  const bridge: Bridge & BridgeStub = await Bridge.deploy(
    bank.address,
    relay.address,
    treasury.address,
    walletRegistry.address,
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
    walletRegistry,
    Bridge,
    bridge,
  }
}

describe("Bridge - Frauds", () => {
  let thirdParty: SignerWithAddress
  let treasury: SignerWithAddress
  let bridge: Bridge & BridgeStub

  before(async () => {
    // eslint-disable-next-line @typescript-eslint/no-extra-semi
    ;({ thirdParty, treasury, bridge } = await waffle.loadFixture(fixture))
  })

  describe("submitFraudChallenge", () => {
    const data = witnessSignSingleInputTx

    context("when the wallet is in Live state", () => {
      context("when the amount of ETH deposited is enough", () => {
        context(
          "when the data needed for signature verification is correct",
          () => {
            context("when the fraud challenge does not exist yet", () => {
              let tx: ContractTransaction

              before(async () => {
                await createSnapshot()

                await bridge.setWallet(walletPublicKeyHash, {
                  ecdsaWalletID: ethers.constants.HashZero,
                  mainUtxoHash: ethers.constants.HashZero,
                  pendingRedemptionsValue: 0,
                  createdAt: await lastBlockTime(),
                  moveFundsRequestedAt: 0,
                  state: walletState.Live,
                })

                tx = await bridge
                  .connect(thirdParty)
                  .submitFraudChallenge(
                    walletPublicKey,
                    data.sighash,
                    data.signature,
                    {
                      value: (
                        await bridge.getFraudParameters()
                      ).challengeDepositAmount,
                    }
                  )
              })

              after(async () => {
                await restoreSnapshot()
              })

              it("should transfer ether from the caller to the bridge", async () => {
                await expect(tx).to.changeEtherBalance(
                  thirdParty,
                  (
                    await bridge.getFraudParameters()
                  ).challengeDepositAmount.mul(-1)
                )
                await expect(tx).to.changeEtherBalance(
                  bridge,
                  (
                    await bridge.getFraudParameters()
                  ).challengeDepositAmount
                )
              })

              it("should store the fraud challenge data", async () => {
                const challengeKey = buildChallengeKey(
                  walletPublicKey,
                  data.sighash
                )

                const fraudChallenge = await bridge.fraudChallenges(
                  challengeKey
                )

                expect(fraudChallenge.challenger).to.equal(
                  await thirdParty.getAddress()
                )
                expect(fraudChallenge.depositAmount).to.equal(
                  (await bridge.getFraudParameters()).challengeDepositAmount
                )
                expect(fraudChallenge.reportedAt).to.equal(
                  await lastBlockTime()
                )
                expect(fraudChallenge.resolved).to.equal(false)
              })

              it("should emit FraudChallengeSubmitted event", async () => {
                await expect(tx)
                  .to.emit(bridge, "FraudChallengeSubmitted")
                  .withArgs(
                    walletPublicKeyHash,
                    data.sighash,
                    data.signature.v,
                    data.signature.r,
                    data.signature.s
                  )
              })
            })

            context("when the fraud challenge already exists", () => {
              before(async () => {
                await createSnapshot()

                await bridge.setWallet(walletPublicKeyHash, {
                  ecdsaWalletID: ethers.constants.HashZero,
                  mainUtxoHash: ethers.constants.HashZero,
                  pendingRedemptionsValue: 0,
                  createdAt: await lastBlockTime(),
                  moveFundsRequestedAt: 0,
                  state: walletState.Live,
                })

                await bridge
                  .connect(thirdParty)
                  .submitFraudChallenge(
                    walletPublicKey,
                    data.sighash,
                    data.signature,
                    {
                      value: (
                        await bridge.getFraudParameters()
                      ).challengeDepositAmount,
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
                      walletPublicKey,
                      data.sighash,
                      data.signature,
                      {
                        value: (
                          await bridge.getFraudParameters()
                        ).challengeDepositAmount,
                      }
                    )
                ).to.be.revertedWith("Fraud challenge already exists")
              })
            })
          }
        )

        context("when incorrect wallet public key is used", () => {
          // Unrelated Bitcoin public key
          const incorrectWalletPublicKey =
            "0xffc045ade19f8a5d464299146ce069049cdcc2390a9b44d9abcd83f11d8cce4" +
            "01ea6800e307b87aadebdcd2f7293cc60f0526afaff1a7b1abddfd787e6c5871e"

          const incorrectWalletPublicKeyHash =
            "0xb5222794425b9b8cd8c3358e73a50dea73480927"

          before(async () => {
            await createSnapshot()
            await bridge.setWallet(incorrectWalletPublicKeyHash, {
              ecdsaWalletID: ethers.constants.HashZero,
              mainUtxoHash: ethers.constants.HashZero,
              pendingRedemptionsValue: 0,
              createdAt: await lastBlockTime(),
              moveFundsRequestedAt: 0,
              state: walletState.Live,
            })
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
                  data.signature,
                  {
                    value: (
                      await bridge.getFraudParameters()
                    ).challengeDepositAmount,
                  }
                )
            ).to.be.revertedWith("Signature verification failure")
          })
        })

        context("when incorrect sighash is used", () => {
          // Random hex-string
          const incorrectSighash =
            "0x9e8e249791a5636e5e007fc15487b5a5bd6e60f73f7e236a7025cd63b904650b"

          before(async () => {
            await createSnapshot()
            await bridge.setWallet(walletPublicKeyHash, {
              ecdsaWalletID: ethers.constants.HashZero,
              mainUtxoHash: ethers.constants.HashZero,
              pendingRedemptionsValue: 0,
              createdAt: await lastBlockTime(),
              moveFundsRequestedAt: 0,
              state: walletState.Live,
            })
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
                  incorrectSighash,
                  data.signature,
                  {
                    value: (
                      await bridge.getFraudParameters()
                    ).challengeDepositAmount,
                  }
                )
            ).to.be.revertedWith("Signature verification failure")
          })
        })

        context("when incorrect recovery ID is used", () => {
          // Increase the value of v by 1
          const incorrectV = data.signature.v + 1

          before(async () => {
            await createSnapshot()
            await bridge.setWallet(walletPublicKeyHash, {
              ecdsaWalletID: ethers.constants.HashZero,
              mainUtxoHash: ethers.constants.HashZero,
              pendingRedemptionsValue: 0,
              createdAt: await lastBlockTime(),
              moveFundsRequestedAt: 0,
              state: walletState.Live,
            })
          })

          after(async () => {
            await restoreSnapshot()
          })

          it("should revert", async () => {
            await expect(
              bridge.connect(thirdParty).submitFraudChallenge(
                walletPublicKey,
                data.sighash,
                {
                  r: data.signature.r,
                  s: data.signature.s,
                  v: incorrectV,
                },
                {
                  value: (
                    await bridge.getFraudParameters()
                  ).challengeDepositAmount,
                }
              )
            ).to.be.revertedWith("Signature verification failure")
          })
        })

        context("when incorrect signature data is used", () => {
          // Swap r and s
          const incorrectS = data.signature.r
          const incorrectR = data.signature.s

          before(async () => {
            await createSnapshot()
            await bridge.setWallet(walletPublicKeyHash, {
              ecdsaWalletID: ethers.constants.HashZero,
              mainUtxoHash: ethers.constants.HashZero,
              pendingRedemptionsValue: 0,
              createdAt: await lastBlockTime(),
              moveFundsRequestedAt: 0,
              state: walletState.Live,
            })
          })

          after(async () => {
            await restoreSnapshot()
          })

          it("should revert", async () => {
            await expect(
              bridge.connect(thirdParty).submitFraudChallenge(
                walletPublicKey,
                data.sighash,
                {
                  r: incorrectR,
                  s: incorrectS,
                  v: data.signature.v,
                },
                {
                  value: (
                    await bridge.getFraudParameters()
                  ).challengeDepositAmount,
                }
              )
            ).to.be.revertedWith("Signature verification failure")
          })
        })
      })

      context("when the amount of ETH deposited is too low", () => {
        before(async () => {
          await createSnapshot()
          await bridge.setWallet(walletPublicKeyHash, {
            ecdsaWalletID: ethers.constants.HashZero,
            mainUtxoHash: ethers.constants.HashZero,
            pendingRedemptionsValue: 0,
            createdAt: await lastBlockTime(),
            moveFundsRequestedAt: 0,
            state: walletState.Live,
          })
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
                data.sighash,
                data.signature,
                {
                  value: (
                    await bridge.getFraudParameters()
                  ).challengeDepositAmount.sub(1),
                }
              )
          ).to.be.revertedWith("The amount of ETH deposited is too low")
        })
      })
    })

    context("when the wallet is in MovingFunds state", () => {
      before(async () => {
        await createSnapshot()
        await bridge.setWallet(walletPublicKeyHash, {
          ecdsaWalletID: ethers.constants.HashZero,
          mainUtxoHash: ethers.constants.HashZero,
          pendingRedemptionsValue: 0,
          createdAt: await lastBlockTime(),
          moveFundsRequestedAt: 0,
          state: walletState.MovingFunds,
        })
      })

      after(async () => {
        await restoreSnapshot()
      })

      it("should succeed", async () => {
        await expect(
          bridge
            .connect(thirdParty)
            .submitFraudChallenge(
              walletPublicKey,
              data.sighash,
              data.signature,
              {
                value: (
                  await bridge.getFraudParameters()
                ).challengeDepositAmount,
              }
            )
        ).to.not.be.reverted
      })
    })

    context("when the wallet is in neither Live nor MovingFunds state", () => {
      const testData = [
        {
          testName: "when wallet state is Unknown",
          walletState: walletState.Unknown,
        },
        {
          testName: "when wallet state is Closed",
          walletState: walletState.Closed,
        },
        {
          testName: "when wallet state is Terminated",
          walletState: walletState.Terminated,
        },
      ]

      testData.forEach((test) => {
        context(test.testName, () => {
          before(async () => {
            await createSnapshot()
            await bridge.setWallet(walletPublicKeyHash, {
              ecdsaWalletID: ethers.constants.HashZero,
              mainUtxoHash: ethers.constants.HashZero,
              pendingRedemptionsValue: 0,
              createdAt: await lastBlockTime(),
              moveFundsRequestedAt: 0,
              state: test.walletState,
            })
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
                  data.sighash,
                  data.signature,
                  {
                    value: (
                      await bridge.getFraudParameters()
                    ).challengeDepositAmount,
                  }
                )
            ).to.be.revertedWith(
              "Wallet is neither in Live nor MovingFunds state"
            )
          })
        })
      })
    })
  })

  describe("defeatFraudChallenge", () => {
    context("when the challenge exists", () => {
      context("when the challenge is open", () => {
        context("when the sighash type is correct", () => {
          context("when the input is non-witness", () => {
            context("when the transaction has single input", () => {
              context(
                "when the input is marked as correctly spent in the Bridge",
                () => {
                  const data = nonWitnessSignSingleInputTx
                  let tx: ContractTransaction

                  before(async () => {
                    await createSnapshot()

                    await bridge.setWallet(walletPublicKeyHash, {
                      ecdsaWalletID: ethers.constants.HashZero,
                      mainUtxoHash: ethers.constants.HashZero,
                      pendingRedemptionsValue: 0,
                      createdAt: await lastBlockTime(),
                      moveFundsRequestedAt: 0,
                      state: walletState.Live,
                    })
                    await bridge.setSweptDeposits(data.deposits)
                    await bridge.setSpentMainUtxos(data.spentMainUtxos)

                    await bridge
                      .connect(thirdParty)
                      .submitFraudChallenge(
                        walletPublicKey,
                        data.sighash,
                        data.signature,
                        {
                          value: (
                            await bridge.getFraudParameters()
                          ).challengeDepositAmount,
                        }
                      )

                    tx = await bridge
                      .connect(thirdParty)
                      .defeatFraudChallenge(
                        walletPublicKey,
                        data.preimage,
                        data.witness
                      )
                  })

                  after(async () => {
                    await restoreSnapshot()
                  })

                  it("should mark the challenge as resolved", async () => {
                    const challengeKey = buildChallengeKey(
                      walletPublicKey,
                      data.sighash
                    )

                    const fraudChallenge = await bridge.fraudChallenges(
                      challengeKey
                    )

                    expect(fraudChallenge.resolved).to.equal(true)
                  })

                  it("should send the ether deposited by the challenger to the treasury", async () => {
                    await expect(tx).to.changeEtherBalance(
                      bridge,
                      (
                        await bridge.getFraudParameters()
                      ).challengeDepositAmount.mul(-1)
                    )
                    await expect(tx).to.changeEtherBalance(
                      treasury,
                      (
                        await bridge.getFraudParameters()
                      ).challengeDepositAmount
                    )
                  })

                  it("should emit FraudChallengeDefeated event", async () => {
                    await expect(tx)
                      .to.emit(bridge, "FraudChallengeDefeated")
                      .withArgs(walletPublicKeyHash, data.sighash)
                  })
                }
              )

              context(
                "when the input is not marked as correctly spent in the Bridge",
                () => {
                  const data = nonWitnessSignSingleInputTx

                  before(async () => {
                    await createSnapshot()

                    await bridge.setWallet(walletPublicKeyHash, {
                      ecdsaWalletID: ethers.constants.HashZero,
                      mainUtxoHash: ethers.constants.HashZero,
                      pendingRedemptionsValue: 0,
                      createdAt: await lastBlockTime(),
                      moveFundsRequestedAt: 0,
                      state: walletState.Live,
                    })

                    await bridge
                      .connect(thirdParty)
                      .submitFraudChallenge(
                        walletPublicKey,
                        data.sighash,
                        data.signature,
                        {
                          value: (
                            await bridge.getFraudParameters()
                          ).challengeDepositAmount,
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
                          walletPublicKey,
                          data.preimage,
                          data.witness
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
                "when the input is marked as correctly spent in the Bridge",
                () => {
                  const data = nonWitnessSignMultipleInputsTx
                  let tx: ContractTransaction

                  before(async () => {
                    await createSnapshot()

                    await bridge.setWallet(walletPublicKeyHash, {
                      ecdsaWalletID: ethers.constants.HashZero,
                      mainUtxoHash: ethers.constants.HashZero,
                      pendingRedemptionsValue: 0,
                      createdAt: await lastBlockTime(),
                      moveFundsRequestedAt: 0,
                      state: walletState.Live,
                    })
                    await bridge.setSweptDeposits(data.deposits)
                    await bridge.setSpentMainUtxos(data.spentMainUtxos)

                    await bridge
                      .connect(thirdParty)
                      .submitFraudChallenge(
                        walletPublicKey,
                        data.sighash,
                        data.signature,
                        {
                          value: (
                            await bridge.getFraudParameters()
                          ).challengeDepositAmount,
                        }
                      )

                    tx = await bridge
                      .connect(thirdParty)
                      .defeatFraudChallenge(
                        walletPublicKey,
                        data.preimage,
                        data.witness
                      )
                  })

                  after(async () => {
                    await restoreSnapshot()
                  })

                  it("should mark the challenge as resolved", async () => {
                    const challengeKey = buildChallengeKey(
                      walletPublicKey,
                      data.sighash
                    )

                    const fraudChallenge = await bridge.fraudChallenges(
                      challengeKey
                    )

                    expect(fraudChallenge.resolved).to.equal(true)
                  })

                  it("should send the ether deposited by the challenger to the treasury", async () => {
                    await expect(tx).to.changeEtherBalance(
                      bridge,
                      (
                        await bridge.getFraudParameters()
                      ).challengeDepositAmount.mul(-1)
                    )
                    await expect(tx).to.changeEtherBalance(
                      treasury,
                      (
                        await bridge.getFraudParameters()
                      ).challengeDepositAmount
                    )
                  })

                  it("should emit FraudChallengeDefeated event", async () => {
                    await expect(tx)
                      .to.emit(bridge, "FraudChallengeDefeated")
                      .withArgs(walletPublicKeyHash, data.sighash)
                  })
                }
              )

              context(
                "when the input is not marked as correctly spent in the Bridge",
                () => {
                  const data = nonWitnessSignMultipleInputsTx

                  before(async () => {
                    await createSnapshot()

                    await bridge.setWallet(walletPublicKeyHash, {
                      ecdsaWalletID: ethers.constants.HashZero,
                      mainUtxoHash: ethers.constants.HashZero,
                      pendingRedemptionsValue: 0,
                      createdAt: await lastBlockTime(),
                      moveFundsRequestedAt: 0,
                      state: walletState.Live,
                    })

                    await bridge
                      .connect(thirdParty)
                      .submitFraudChallenge(
                        walletPublicKey,
                        data.sighash,
                        data.signature,
                        {
                          value: (
                            await bridge.getFraudParameters()
                          ).challengeDepositAmount,
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
                          walletPublicKey,
                          data.preimage,
                          data.witness
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
                "when the input is marked as correctly spent in the Bridge",
                () => {
                  const data = witnessSignSingleInputTx
                  let tx: ContractTransaction

                  before(async () => {
                    await createSnapshot()

                    await bridge.setWallet(walletPublicKeyHash, {
                      ecdsaWalletID: ethers.constants.HashZero,
                      mainUtxoHash: ethers.constants.HashZero,
                      pendingRedemptionsValue: 0,
                      createdAt: await lastBlockTime(),
                      moveFundsRequestedAt: 0,
                      state: walletState.Live,
                    })
                    await bridge.setSweptDeposits(data.deposits)
                    await bridge.setSpentMainUtxos(data.spentMainUtxos)

                    await bridge
                      .connect(thirdParty)
                      .submitFraudChallenge(
                        walletPublicKey,
                        data.sighash,
                        data.signature,
                        {
                          value: (
                            await bridge.getFraudParameters()
                          ).challengeDepositAmount,
                        }
                      )

                    tx = await bridge
                      .connect(thirdParty)
                      .defeatFraudChallenge(
                        walletPublicKey,
                        data.preimage,
                        data.witness
                      )
                  })

                  after(async () => {
                    await restoreSnapshot()
                  })

                  it("should mark the challenge as resolved", async () => {
                    const challengeKey = buildChallengeKey(
                      walletPublicKey,
                      data.sighash
                    )

                    const fraudChallenge = await bridge.fraudChallenges(
                      challengeKey
                    )

                    expect(fraudChallenge.resolved).to.equal(true)
                  })

                  it("should send the ether deposited by the challenger to the treasury", async () => {
                    await expect(tx).to.changeEtherBalance(
                      bridge,
                      (
                        await bridge.getFraudParameters()
                      ).challengeDepositAmount.mul(-1)
                    )
                    await expect(tx).to.changeEtherBalance(
                      treasury,
                      (
                        await bridge.getFraudParameters()
                      ).challengeDepositAmount
                    )
                  })

                  it("should emit FraudChallengeDefeated event", async () => {
                    await expect(tx)
                      .to.emit(bridge, "FraudChallengeDefeated")
                      .withArgs(walletPublicKeyHash, data.sighash)
                  })
                }
              )

              context(
                "when the input is not marked as correctly spent in the Bridge",
                () => {
                  const data = witnessSignSingleInputTx

                  before(async () => {
                    await createSnapshot()

                    await bridge.setWallet(walletPublicKeyHash, {
                      ecdsaWalletID: ethers.constants.HashZero,
                      mainUtxoHash: ethers.constants.HashZero,
                      pendingRedemptionsValue: 0,
                      createdAt: await lastBlockTime(),
                      moveFundsRequestedAt: 0,
                      state: walletState.Live,
                    })

                    await bridge
                      .connect(thirdParty)
                      .submitFraudChallenge(
                        walletPublicKey,
                        data.sighash,
                        data.signature,
                        {
                          value: (
                            await bridge.getFraudParameters()
                          ).challengeDepositAmount,
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
                          walletPublicKey,
                          data.preimage,
                          data.witness
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
                "when the input is marked as correctly spent in the Bridge",
                () => {
                  const data = witnessSignMultipleInputTx
                  let tx: ContractTransaction

                  before(async () => {
                    await createSnapshot()

                    await bridge.setWallet(walletPublicKeyHash, {
                      ecdsaWalletID: ethers.constants.HashZero,
                      mainUtxoHash: ethers.constants.HashZero,
                      pendingRedemptionsValue: 0,
                      createdAt: await lastBlockTime(),
                      moveFundsRequestedAt: 0,
                      state: walletState.Live,
                    })
                    await bridge.setSweptDeposits(data.deposits)
                    await bridge.setSpentMainUtxos(data.spentMainUtxos)

                    await bridge
                      .connect(thirdParty)
                      .submitFraudChallenge(
                        walletPublicKey,
                        data.sighash,
                        data.signature,
                        {
                          value: (
                            await bridge.getFraudParameters()
                          ).challengeDepositAmount,
                        }
                      )

                    tx = await bridge
                      .connect(thirdParty)
                      .defeatFraudChallenge(
                        walletPublicKey,
                        data.preimage,
                        data.witness
                      )
                  })

                  after(async () => {
                    await restoreSnapshot()
                  })

                  it("should mark the challenge as resolved", async () => {
                    const challengeKey = buildChallengeKey(
                      walletPublicKey,
                      data.sighash
                    )

                    const fraudChallenge = await bridge.fraudChallenges(
                      challengeKey
                    )

                    expect(fraudChallenge.resolved).to.equal(true)
                  })

                  it("should send the ether deposited by the challenger to the treasury", async () => {
                    await expect(tx).to.changeEtherBalance(
                      bridge,
                      (
                        await bridge.getFraudParameters()
                      ).challengeDepositAmount.mul(-1)
                    )
                    await expect(tx).to.changeEtherBalance(
                      treasury,
                      (
                        await bridge.getFraudParameters()
                      ).challengeDepositAmount
                    )
                  })

                  it("should emit FraudChallengeDefeated event", async () => {
                    await expect(tx)
                      .to.emit(bridge, "FraudChallengeDefeated")
                      .withArgs(walletPublicKeyHash, data.sighash)
                  })
                }
              )

              context(
                "when the input is not marked as correctly spent in the Bridge",
                () => {
                  const data = witnessSignMultipleInputTx

                  before(async () => {
                    await createSnapshot()

                    await bridge.setWallet(walletPublicKeyHash, {
                      ecdsaWalletID: ethers.constants.HashZero,
                      mainUtxoHash: ethers.constants.HashZero,
                      pendingRedemptionsValue: 0,
                      createdAt: await lastBlockTime(),
                      moveFundsRequestedAt: 0,
                      state: walletState.Live,
                    })

                    await bridge
                      .connect(thirdParty)
                      .submitFraudChallenge(
                        walletPublicKey,
                        data.sighash,
                        data.signature,
                        {
                          value: (
                            await bridge.getFraudParameters()
                          ).challengeDepositAmount,
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
                          walletPublicKey,
                          data.preimage,
                          data.witness
                        )
                    ).to.be.revertedWith(
                      "Spent UTXO not found among correctly spent UTXOs"
                    )
                  })
                }
              )
            })
          })
        })

        context("when the sighash type is incorrect", () => {
          // Wrong sighash was used (SIGHASH_NONE | SIGHASH_ANYONECANPAY) during
          // input signing
          const data = wrongSighashType

          before(async () => {
            await createSnapshot()

            await bridge.setWallet(walletPublicKeyHash, {
              ecdsaWalletID: ethers.constants.HashZero,
              mainUtxoHash: ethers.constants.HashZero,
              pendingRedemptionsValue: 0,
              createdAt: await lastBlockTime(),
              moveFundsRequestedAt: 0,
              state: walletState.Live,
            })
            await bridge.setSweptDeposits(data.deposits)
            await bridge.setSpentMainUtxos(data.spentMainUtxos)

            await bridge
              .connect(thirdParty)
              .submitFraudChallenge(
                walletPublicKey,
                data.sighash,
                data.signature,
                {
                  value: (
                    await bridge.getFraudParameters()
                  ).challengeDepositAmount,
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
                  walletPublicKey,
                  data.preimage,
                  data.witness
                )
            ).to.be.revertedWith("Wrong sighash type")
          })
        })
      })

      context("when the challenge is resolved by defeat", () => {
        const data = nonWitnessSignSingleInputTx

        before(async () => {
          await createSnapshot()

          await bridge.setWallet(walletPublicKeyHash, {
            ecdsaWalletID: ethers.constants.HashZero,
            mainUtxoHash: ethers.constants.HashZero,
            pendingRedemptionsValue: 0,
            createdAt: await lastBlockTime(),
            moveFundsRequestedAt: 0,
            state: walletState.Live,
          })
          await bridge.setSweptDeposits(data.deposits)
          await bridge.setSpentMainUtxos(data.spentMainUtxos)

          await bridge
            .connect(thirdParty)
            .submitFraudChallenge(
              walletPublicKey,
              data.sighash,
              data.signature,
              {
                value: (
                  await bridge.getFraudParameters()
                ).challengeDepositAmount,
              }
            )

          await bridge
            .connect(thirdParty)
            .defeatFraudChallenge(walletPublicKey, data.preimage, false)
        })

        after(async () => {
          await restoreSnapshot()
        })

        it("should revert", async () => {
          await expect(
            bridge
              .connect(thirdParty)
              .defeatFraudChallenge(walletPublicKey, data.preimage, false)
          ).to.be.revertedWith("Fraud challenge has already been resolved")
        })
      })

      context("when the challenge is resolved by timeout", () => {
        const data = nonWitnessSignSingleInputTx

        before(async () => {
          await createSnapshot()

          await bridge.setWallet(walletPublicKeyHash, {
            ecdsaWalletID: ethers.constants.HashZero,
            mainUtxoHash: ethers.constants.HashZero,
            pendingRedemptionsValue: 0,
            createdAt: await lastBlockTime(),
            moveFundsRequestedAt: 0,
            state: walletState.Live,
          })
          await bridge.setSweptDeposits(data.deposits)
          await bridge.setSpentMainUtxos(data.spentMainUtxos)

          await bridge
            .connect(thirdParty)
            .submitFraudChallenge(
              walletPublicKey,
              data.sighash,
              data.signature,
              {
                value: (
                  await bridge.getFraudParameters()
                ).challengeDepositAmount,
              }
            )

          await increaseTime(
            (
              await bridge.getFraudParameters()
            ).challengeDefeatTimeout
          )

          await bridge
            .connect(thirdParty)
            .notifyFraudChallengeDefeatTimeout(walletPublicKey, data.sighash)
        })

        after(async () => {
          await restoreSnapshot()
        })

        it("should revert", async () => {
          await expect(
            bridge
              .connect(thirdParty)
              .defeatFraudChallenge(walletPublicKey, data.preimage, false)
          ).to.be.revertedWith("Fraud challenge has already been resolved")
        })
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
            .defeatFraudChallenge(walletPublicKey, data.preimage, false)
        ).to.be.revertedWith("Fraud challenge does not exist")
      })
    })
  })

  describe("notifyFraudChallengeDefeatTimeout", () => {
    const data = nonWitnessSignSingleInputTx

    describe("when the fraud challenge exists", () => {
      describe("when the fraud challenge is open", () => {
        describe("when the fraud challenge has timed out", () => {
          let tx: ContractTransaction

          before(async () => {
            await createSnapshot()

            await bridge.setWallet(walletPublicKeyHash, {
              ecdsaWalletID: ethers.constants.HashZero,
              mainUtxoHash: ethers.constants.HashZero,
              pendingRedemptionsValue: 0,
              createdAt: await lastBlockTime(),
              moveFundsRequestedAt: 0,
              state: walletState.Live,
            })
            await bridge.setSweptDeposits(data.deposits)
            await bridge.setSpentMainUtxos(data.spentMainUtxos)

            await bridge
              .connect(thirdParty)
              .submitFraudChallenge(
                walletPublicKey,
                data.sighash,
                data.signature,
                {
                  value: (
                    await bridge.getFraudParameters()
                  ).challengeDepositAmount,
                }
              )

            await increaseTime(
              (
                await bridge.getFraudParameters()
              ).challengeDefeatTimeout
            )

            tx = await bridge
              .connect(thirdParty)
              .notifyFraudChallengeDefeatTimeout(walletPublicKey, data.sighash)
          })

          after(async () => {
            await restoreSnapshot()
          })

          it("should mark the fraud challenge as resolved", async () => {
            const challengeKey = buildChallengeKey(
              walletPublicKey,
              data.sighash
            )

            const fraudChallenge = await bridge.fraudChallenges(challengeKey)

            expect(fraudChallenge.resolved).to.be.true
          })

          it("should return the deposited ether to the challenger", async () => {
            await expect(tx).to.changeEtherBalance(
              bridge,
              (await bridge.getFraudParameters()).challengeDepositAmount.mul(-1)
            )
            await expect(tx).to.changeEtherBalance(
              thirdParty,
              (
                await bridge.getFraudParameters()
              ).challengeDepositAmount
            )
          })

          it("should emit FraudChallengeDefeatTimedOut event", async () => {
            await expect(tx)
              .to.emit(bridge, "FraudChallengeDefeatTimedOut")
              .withArgs(walletPublicKeyHash, data.sighash)
          })
        })

        describe("when the fraud challenge has not timed out yet", () => {
          before(async () => {
            await createSnapshot()

            await bridge.setWallet(walletPublicKeyHash, {
              ecdsaWalletID: ethers.constants.HashZero,
              mainUtxoHash: ethers.constants.HashZero,
              pendingRedemptionsValue: 0,
              createdAt: await lastBlockTime(),
              moveFundsRequestedAt: 0,
              state: walletState.Live,
            })
            await bridge.setSweptDeposits(data.deposits)
            await bridge.setSpentMainUtxos(data.spentMainUtxos)

            await bridge
              .connect(thirdParty)
              .submitFraudChallenge(
                walletPublicKey,
                data.sighash,
                data.signature,
                {
                  value: (
                    await bridge.getFraudParameters()
                  ).challengeDepositAmount,
                }
              )

            await increaseTime(
              (await bridge.getFraudParameters()).challengeDefeatTimeout.sub(2)
            )
          })

          after(async () => {
            await restoreSnapshot()
          })

          it("should revert", async () => {
            await expect(
              bridge
                .connect(thirdParty)
                .notifyFraudChallengeDefeatTimeout(
                  walletPublicKey,
                  data.sighash
                )
            ).to.be.revertedWith(
              "Fraud challenge defeat period did not time out yet"
            )
          })
        })
      })

      describe("when the fraud challenge is resolved by challenge defeat", () => {
        before(async () => {
          await createSnapshot()

          await bridge.setWallet(walletPublicKeyHash, {
            ecdsaWalletID: ethers.constants.HashZero,
            mainUtxoHash: ethers.constants.HashZero,
            pendingRedemptionsValue: 0,
            createdAt: await lastBlockTime(),
            moveFundsRequestedAt: 0,
            state: walletState.Live,
          })
          await bridge.setSweptDeposits(data.deposits)
          await bridge.setSpentMainUtxos(data.spentMainUtxos)

          await bridge
            .connect(thirdParty)
            .submitFraudChallenge(
              walletPublicKey,
              data.sighash,
              data.signature,
              {
                value: (
                  await bridge.getFraudParameters()
                ).challengeDepositAmount,
              }
            )

          await bridge
            .connect(thirdParty)
            .defeatFraudChallenge(walletPublicKey, data.preimage, false)
        })

        after(async () => {
          await restoreSnapshot()
        })

        it("should revert", async () => {
          await expect(
            bridge
              .connect(thirdParty)
              .notifyFraudChallengeDefeatTimeout(walletPublicKey, data.sighash)
          ).to.be.revertedWith("Fraud challenge has already been resolved")
        })
      })

      describe("when the fraud challenge is resolved by previous timeout notification", () => {
        before(async () => {
          await createSnapshot()

          await bridge.setWallet(walletPublicKeyHash, {
            ecdsaWalletID: ethers.constants.HashZero,
            mainUtxoHash: ethers.constants.HashZero,
            pendingRedemptionsValue: 0,
            createdAt: await lastBlockTime(),
            moveFundsRequestedAt: 0,
            state: walletState.Live,
          })
          await bridge.setSweptDeposits(data.deposits)
          await bridge.setSpentMainUtxos(data.spentMainUtxos)

          await bridge
            .connect(thirdParty)
            .submitFraudChallenge(
              walletPublicKey,
              data.sighash,
              data.signature,
              {
                value: (
                  await bridge.getFraudParameters()
                ).challengeDepositAmount,
              }
            )

          await increaseTime(
            (
              await bridge.getFraudParameters()
            ).challengeDefeatTimeout
          )

          await bridge
            .connect(thirdParty)
            .notifyFraudChallengeDefeatTimeout(walletPublicKey, data.sighash)
        })

        after(async () => {
          await restoreSnapshot()
        })

        it("should revert", async () => {
          await expect(
            bridge
              .connect(thirdParty)
              .notifyFraudChallengeDefeatTimeout(walletPublicKey, data.sighash)
          ).to.be.revertedWith("Fraud challenge has already been resolved")
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
            .notifyFraudChallengeDefeatTimeout(walletPublicKey, data.sighash)
        ).to.be.revertedWith("Fraud challenge does not exist")
      })
    })
  })

  function buildChallengeKey(publicKey: BytesLike, sighash: BytesLike): string {
    return ethers.utils.solidityKeccak256(
      ["bytes", "bytes32"],
      [publicKey, sighash]
    )
  }
})
