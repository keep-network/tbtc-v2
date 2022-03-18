/* eslint-disable no-underscore-dangle */
import { ethers, helpers, waffle } from "hardhat"
import { SignerWithAddress } from "@nomiclabs/hardhat-ethers/signers"
import chai, { expect } from "chai"
import { smock } from "@defi-wonderland/smock"
import type { FakeContract } from "@defi-wonderland/smock"
import { ContractTransaction } from "ethers"
import type {
  Bank,
  BankStub,
  BankStub__factory,
  BitcoinTx__factory,
  Bridge,
  BridgeStub,
  BridgeStub__factory,
  IWalletRegistry,
  IRelay,
} from "../../typechain"
import { Wallets__factory } from "../../typechain"
import { NO_MAIN_UTXO } from "../data/sweep"
import { ecdsaWalletTestData } from "../data/ecdsa"
import { constants, ecdsaDkgState, walletState } from "../fixtures"

chai.use(smock.matchers)

const { createSnapshot, restoreSnapshot } = helpers.snapshot
const { lastBlockTime, increaseTime } = helpers.time

const fixture = async () => {
  const [deployer, governance, thirdParty, treasury] = await ethers.getSigners()

  const Bank = await ethers.getContractFactory<BankStub__factory>("BankStub")
  const bank: Bank & BankStub = await Bank.deploy()
  await bank.deployed()

  const relay = await smock.fake<IRelay>("IRelay")

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

  const Bridge = await ethers.getContractFactory<BridgeStub__factory>(
    "BridgeStub",
    {
      libraries: {
        BitcoinTx: bitcoinTx.address,
        Wallets: wallets.address,
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

  return {
    governance,
    thirdParty,
    treasury,
    bank,
    relay,
    walletRegistry,
    bridge,
  }
}

describe("Bridge - Wallets", () => {
  let governance: SignerWithAddress
  let thirdParty: SignerWithAddress

  let walletRegistry: FakeContract<IWalletRegistry>
  let bridge: Bridge & BridgeStub

  before(async () => {
    // eslint-disable-next-line @typescript-eslint/no-extra-semi
    ;({ governance, thirdParty, walletRegistry, bridge } =
      await waffle.loadFixture(fixture))
  })

  describe("requestNewWallet", () => {
    before(async () => {
      await createSnapshot()
    })

    after(async () => {
      walletRegistry.requestNewWallet.reset()

      await restoreSnapshot()
    })

    context("when called by a third party", async () => {
      context("when wallet creation is not in progress", () => {
        before(async () => {
          await createSnapshot()

          walletRegistry.getWalletCreationState.returns(ecdsaDkgState.IDLE)
        })

        after(async () => {
          walletRegistry.getWalletCreationState.reset()

          await restoreSnapshot()
        })

        context("when active wallet is not set", () => {
          let tx: ContractTransaction

          before(async () => {
            await createSnapshot()

            tx = await bridge.connect(thirdParty).requestNewWallet(NO_MAIN_UTXO)
          })

          after(async () => {
            walletRegistry.requestNewWallet.reset()

            await restoreSnapshot()
          })

          it("should emit NewWalletRequested event", async () => {
            await expect(tx).to.emit(bridge, "NewWalletRequested")
          })

          it("should call ECDSA Wallet Registry's requestNewWallet function", async () => {
            await expect(walletRegistry.requestNewWallet).to.have.been
              .calledOnce
          })
        })

        context("when active wallet is set", () => {
          before(async () => {
            await createSnapshot()

            await bridge.setActiveWallet(ecdsaWalletTestData.pubKeyHash160)

            await bridge.setRegisteredWallet(
              ecdsaWalletTestData.pubKeyHash160,
              {
                ecdsaWalletID: ecdsaWalletTestData.walletID,
                mainUtxoHash: ethers.constants.HashZero,
                pendingRedemptionsValue: 0,
                createdAt: await lastBlockTime(),
                state: walletState.Live,
              }
            )
          })

          after(async () => {
            await restoreSnapshot()
          })

          context("when active wallet has a main UTXO set", () => {
            context("when the active wallet main UTXO data are valid", () => {
              context("when wallet creation conditions are met", () => {
                context(
                  "when active wallet is old enough and its balance is greater or equal the minimum BTC balance threshold",
                  () => {
                    let tx: ContractTransaction

                    before(async () => {
                      await createSnapshot()

                      // Make the wallet old enough.
                      await increaseTime(constants.walletCreationPeriod)

                      // Simulate the wallet has a BTC balance equal to the
                      // minimum BTC amount threshold by preparing the wallet's
                      // main UTXO accordingly.
                      const activeWalletMainUtxo = {
                        txHash:
                          "0xc9e58780c6c289c25ae1fe293f85a4db4d0af4f305172f2a1868ddd917458bdf",
                        txOutputIndex: 1,
                        txOutputValue: constants.walletMinBtcBalance,
                      }

                      await bridge.setRegisteredWalletMainUtxo(
                        ecdsaWalletTestData.pubKeyHash160,
                        activeWalletMainUtxo
                      )

                      tx = await bridge.requestNewWallet(activeWalletMainUtxo)
                    })

                    after(async () => {
                      walletRegistry.requestNewWallet.reset()

                      await restoreSnapshot()
                    })

                    it("should emit NewWalletRequested event", async () => {
                      await expect(tx).to.emit(bridge, "NewWalletRequested")
                    })

                    it("should call ECDSA Wallet Registry's requestNewWallet function", async () => {
                      await expect(walletRegistry.requestNewWallet).to.have.been
                        .calledOnce
                    })
                  }
                )

                context(
                  "when active wallet is not old enough but its balance is greater or equal the maximum BTC balance threshold",
                  () => {
                    let tx: ContractTransaction

                    before(async () => {
                      await createSnapshot()

                      // Simulate the wallet has a BTC balance equal to the
                      // maximum BTC amount threshold by preparing the wallet's
                      // main UTXO accordingly. Note that the time is not
                      // increased at all so the wallet is not old enough
                      // for sure.
                      const activeWalletMainUtxo = {
                        txHash:
                          "0xc9e58780c6c289c25ae1fe293f85a4db4d0af4f305172f2a1868ddd917458bdf",
                        txOutputIndex: 1,
                        txOutputValue: constants.walletMaxBtcBalance,
                      }

                      await bridge.setRegisteredWalletMainUtxo(
                        ecdsaWalletTestData.pubKeyHash160,
                        activeWalletMainUtxo
                      )

                      tx = await bridge.requestNewWallet(activeWalletMainUtxo)
                    })

                    after(async () => {
                      walletRegistry.requestNewWallet.reset()

                      await restoreSnapshot()
                    })

                    it("should emit NewWalletRequested event", async () => {
                      await expect(tx).to.emit(bridge, "NewWalletRequested")
                    })

                    it("should call ECDSA Wallet Registry's requestNewWallet function", async () => {
                      await expect(walletRegistry.requestNewWallet).to.have.been
                        .calledOnce
                    })
                  }
                )
              })

              context(
                "when active wallet is not old enough and its balance is greater or equal the minimum but lesser than the maximum BTC balance threshold",
                () => {
                  let tx: Promise<ContractTransaction>

                  before(async () => {
                    await createSnapshot()

                    // Simulate the wallet has a BTC balance between the minimum
                    // and maximum BTC amount thresholds by preparing the
                    // wallet's main UTXO accordingly. Note that the time is not
                    // increased at all so the wallet is not old enough for sure.
                    const activeWalletMainUtxo = {
                      txHash:
                        "0xc9e58780c6c289c25ae1fe293f85a4db4d0af4f305172f2a1868ddd917458bdf",
                      txOutputIndex: 1,
                      txOutputValue: constants.walletMaxBtcBalance.sub(1),
                    }

                    await bridge.setRegisteredWalletMainUtxo(
                      ecdsaWalletTestData.pubKeyHash160,
                      activeWalletMainUtxo
                    )

                    tx = bridge.requestNewWallet(activeWalletMainUtxo)
                  })

                  after(async () => {
                    await restoreSnapshot()
                  })

                  it("should revert", async () => {
                    await expect(tx).to.be.revertedWith(
                      "Wallet creation conditions are not met"
                    )
                  })
                }
              )

              context(
                "when active wallet is old enough but its balance is lesser than the minimum BTC balance threshold",
                () => {
                  let tx: Promise<ContractTransaction>

                  before(async () => {
                    await createSnapshot()

                    // Make the wallet old enough.
                    await increaseTime(constants.walletCreationPeriod)

                    // Simulate the wallet has a BTC balance below the minimum
                    // BTC amount threshold by preparing the wallet's main
                    // UTXO accordingly.
                    const activeWalletMainUtxo = {
                      txHash:
                        "0xc9e58780c6c289c25ae1fe293f85a4db4d0af4f305172f2a1868ddd917458bdf",
                      txOutputIndex: 1,
                      txOutputValue: constants.walletMinBtcBalance.sub(1),
                    }

                    await bridge.setRegisteredWalletMainUtxo(
                      ecdsaWalletTestData.pubKeyHash160,
                      activeWalletMainUtxo
                    )

                    tx = bridge.requestNewWallet(activeWalletMainUtxo)
                  })

                  after(async () => {
                    await restoreSnapshot()
                  })

                  it("should revert", async () => {
                    await expect(tx).to.be.revertedWith(
                      "Wallet creation conditions are not met"
                    )
                  })
                }
              )
            })

            context("when the active wallet main UTXO data are invalid", () => {
              const activeWalletMainUtxo = {
                txHash:
                  "0xc9e58780c6c289c25ae1fe293f85a4db4d0af4f305172f2a1868ddd917458bdf",
                txOutputIndex: 1,
                txOutputValue: constants.walletMaxBtcBalance,
              }

              before(async () => {
                await createSnapshot()

                await bridge.setRegisteredWalletMainUtxo(
                  ecdsaWalletTestData.pubKeyHash160,
                  activeWalletMainUtxo
                )
              })

              after(async () => {
                await restoreSnapshot()
              })

              it("should revert", async () => {
                const corruptedActiveWalletMainUtxo = {
                  ...activeWalletMainUtxo,
                  txOutputIndex: 0,
                }

                await expect(
                  bridge.requestNewWallet(corruptedActiveWalletMainUtxo)
                ).to.be.revertedWith("Invalid wallet main UTXO data")
              })
            })
          })

          context("when active wallet has no main UTXO set", () => {
            before(async () => {
              await createSnapshot()
            })

            after(async () => {
              await restoreSnapshot()
            })

            // If the wallet has 0 BTC, the function must revert.
            // This is because the active wallet's balance must be above the
            // minimum BTC balance threshold and that threshold is guaranteed
            // to be always greater than zero.
            it("should revert", async () => {
              await expect(
                bridge.requestNewWallet(NO_MAIN_UTXO)
              ).to.be.revertedWith("Wallet creation conditions are not met")
            })
          })
        })
      })

      context("when wallet creation is already in progress", () => {
        const testData = [
          {
            testName: "when wallet creation state is AWAITING_SEED",
            walletCreationState: ecdsaDkgState.AWAITING_SEED,
          },
          {
            testName: "when wallet creation state is AWAITING_RESULT",
            walletCreationState: ecdsaDkgState.AWAITING_RESULT,
          },
          {
            testName: "when wallet creation state is CHALLENGE",
            walletCreationState: ecdsaDkgState.CHALLENGE,
          },
        ]

        testData.forEach((test) => {
          context(test.testName, () => {
            before(async () => {
              await createSnapshot()

              walletRegistry.getWalletCreationState.returns(
                test.walletCreationState
              )
            })

            after(async () => {
              walletRegistry.getWalletCreationState.reset()

              await restoreSnapshot()
            })

            it("should revert", async () => {
              await expect(
                bridge.requestNewWallet(NO_MAIN_UTXO)
              ).to.be.revertedWith("Wallet creation already in progress")
            })
          })
        })
      })
    })
  })

  describe("__ecdsaWalletCreatedCallback", () => {
    context("when called by a third party", async () => {
      it("should revert", async () => {
        await expect(
          bridge
            .connect(thirdParty)
            .__ecdsaWalletCreatedCallback(
              ecdsaWalletTestData.walletID,
              ecdsaWalletTestData.publicKeyX,
              ecdsaWalletTestData.publicKeyY
            )
        ).to.be.revertedWith("Caller is not the ECDSA Wallet Registry")
      })
    })

    context("when called by the ECDSA Wallet Registry", async () => {
      context("when called with a valid ECDSA Wallet details", async () => {
        let tx: ContractTransaction

        before(async () => {
          await createSnapshot()

          tx = await bridge
            .connect(walletRegistry.wallet)
            .__ecdsaWalletCreatedCallback(
              ecdsaWalletTestData.walletID,
              ecdsaWalletTestData.publicKeyX,
              ecdsaWalletTestData.publicKeyY
            )
        })

        after(async () => {
          await restoreSnapshot()
        })

        it("should register ECDSA wallet reference", async () => {
          await expect(
            (
              await bridge.getRegisteredWallet(
                ecdsaWalletTestData.pubKeyHash160
              )
            ).ecdsaWalletID
          ).equals(ecdsaWalletTestData.walletID)
        })

        it("should transition wallet to Live state", async () => {
          await expect(
            (
              await bridge.getRegisteredWallet(
                ecdsaWalletTestData.pubKeyHash160
              )
            ).state
          ).equals(walletState.Live)
        })

        it("should set the created at timestamp", async () => {
          await expect(
            (
              await bridge.getRegisteredWallet(
                ecdsaWalletTestData.pubKeyHash160
              )
            ).createdAt
          ).equals(await lastBlockTime())
        })

        it("should set the wallet as the active one", async () => {
          await expect(await bridge.getActiveWalletPubKeyHash()).equals(
            ecdsaWalletTestData.pubKeyHash160
          )
        })

        it("should emit NewWalletRegistered event", async () => {
          await expect(tx)
            .to.emit(bridge, "NewWalletRegistered")
            .withArgs(
              ecdsaWalletTestData.walletID,
              ecdsaWalletTestData.pubKeyHash160
            )
        })
      })

      context(
        "when called with the ECDSA Wallet already registered",
        async () => {
          before(async () => {
            await createSnapshot()

            await bridge
              .connect(walletRegistry.wallet)
              .__ecdsaWalletCreatedCallback(
                ecdsaWalletTestData.walletID,
                ecdsaWalletTestData.publicKeyX,
                ecdsaWalletTestData.publicKeyY
              )
          })

          after(async () => {
            await restoreSnapshot()
          })

          const testData = [
            {
              testName: "with unique wallet ID and unique public key",
              walletID: ethers.utils.randomBytes(32),
              publicKeyX: ethers.utils.randomBytes(32),
              publicKeyY: ethers.utils.randomBytes(32),
              expectedError: undefined,
            },
            {
              testName: "with duplicated wallet ID and unique public key",
              walletID: ecdsaWalletTestData.walletID,
              publicKeyX: ethers.utils.randomBytes(32),
              publicKeyY: ethers.utils.randomBytes(32),
              expectedError: undefined,
            },
            {
              testName:
                "with unique wallet ID, unique public key X and duplicated public key Y",
              walletID: ethers.utils.randomBytes(32),
              publicKeyX: ethers.utils.randomBytes(32),
              publicKeyY: ecdsaWalletTestData.publicKeyY,
              expectedError: undefined,
            },
            {
              testName:
                "with unique wallet ID, unique public key Y and duplicated public key X",
              walletID: ethers.utils.randomBytes(32),
              publicKeyX: ecdsaWalletTestData.publicKeyY,
              publicKeyY: ethers.utils.randomBytes(32),
              expectedError: undefined,
            },
            {
              testName: "with unique wallet ID and duplicated public key",
              walletID: ethers.utils.randomBytes(32),
              publicKeyX: ecdsaWalletTestData.publicKeyX,
              publicKeyY: ecdsaWalletTestData.publicKeyY,
              expectedError: "ECDSA wallet has been already registered",
            },
            {
              testName: "with duplicated wallet ID and duplicated public key",
              walletID: ecdsaWalletTestData.walletID,
              publicKeyX: ecdsaWalletTestData.publicKeyX,
              publicKeyY: ecdsaWalletTestData.publicKeyY,
              expectedError: "ECDSA wallet has been already registered",
            },
          ]

          testData.forEach((test) => {
            context(test.testName, async () => {
              beforeEach(async () => {
                await createSnapshot()
              })

              afterEach(async () => {
                await restoreSnapshot()
              })

              it(
                test.expectedError ? "should revert" : "should not revert",
                async () => {
                  const tx: Promise<ContractTransaction> = bridge
                    .connect(walletRegistry.wallet)
                    .__ecdsaWalletCreatedCallback(
                      test.walletID,
                      test.publicKeyX,
                      test.publicKeyY
                    )

                  if (test.expectedError) {
                    await expect(tx).to.be.revertedWith(test.expectedError)
                  } else {
                    await expect(tx).not.to.be.reverted
                  }
                }
              )
            })
          })
        }
      )
    })
  })
})
