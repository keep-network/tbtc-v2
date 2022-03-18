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
import { walletState } from "../fixtures"

chai.use(smock.matchers)

const { createSnapshot, restoreSnapshot } = helpers.snapshot

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

    // TODO: Implement wallet creation rules

    context("when called by a third party", async () => {
      it("should call ECDSA Wallet Registry's requestNewWallet function", async () => {
        await bridge.connect(thirdParty).requestNewWallet(NO_MAIN_UTXO)

        await expect(walletRegistry.requestNewWallet).to.have.been.calledOnce
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

        it("should transition Wallet to Live state", async () => {
          await expect(
            (
              await bridge.getRegisteredWallet(
                ecdsaWalletTestData.pubKeyHash160
              )
            ).state
          ).equals(walletState.Live)
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
