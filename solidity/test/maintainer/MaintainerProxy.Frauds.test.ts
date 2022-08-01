/* eslint-disable no-underscore-dangle */
import { ethers, helpers, waffle } from "hardhat"
import { SignerWithAddress } from "@nomiclabs/hardhat-ethers/signers"
import { SigningKey } from "ethers/lib/utils"
import { expect } from "chai"
import { Contract, ContractTransaction, BigNumber } from "ethers"
import type { FakeContract } from "@defi-wonderland/smock"
import { smock } from "@defi-wonderland/smock"
import type {
  IWalletRegistry,
  MaintainerProxy,
  ReimbursementPool,
  Bridge,
  BridgeFraudStub,
} from "../../typechain"

import {
  wallet as fraudWallet,
  nonWitnessSignSingleInputTx,
  nonWitnessSignMultipleInputsTx,
  witnessSignSingleInputTx,
  witnessSignMultipleInputTx,
} from "../data/fraud"

import bridgeFixture from "../fixtures/bridge"
import { walletState } from "../fixtures"

const { createSnapshot, restoreSnapshot } = helpers.snapshot
const { provider } = waffle

const { lastBlockTime } = helpers.time
const { keccak256, sha256 } = ethers.utils

const { publicKey: walletPublicKey, pubKeyHash160: walletPublicKeyHash } =
  fraudWallet

// Most of the tests around specific bridge functionality were ported from the
// other tbtc-v2 tests suites and adjusted to check the refund functionality of
// the MaintainerProxy contract.
describe("MaintainerProxy", () => {
  let deployer: SignerWithAddress
  let governance: SignerWithAddress
  let walletMaintainer: SignerWithAddress
  let spvMaintainer: SignerWithAddress
  let thirdParty: SignerWithAddress

  let bridge: Bridge & BridgeFraudStub
  let maintainerProxy: MaintainerProxy
  let reimbursementPool: ReimbursementPool
  let walletRegistry: FakeContract<IWalletRegistry>
  let deployBridge: (bridgeType: string, txProofDifficultyFactor: number) => Promise<Contract>

  let fraudChallengeDepositAmount: BigNumber

  before(async () => {
    // eslint-disable-next-line @typescript-eslint/no-extra-semi
    ;({
      governance,
      maintainerProxy,
      reimbursementPool,
      maintainerProxy,
      deployer,
      deployBridge

    } = await waffle.loadFixture(bridgeFixture))
    
    bridge = (await deployBridge("BridgeFraudStub", 6)) as BridgeFraudStub
    await maintainerProxy.connect(governance).updateBridge(bridge.address)
    
    walletRegistry = await smock.fake<IWalletRegistry>("IWalletRegistry", {
      address: (await bridge.contractReferences()).ecdsaWalletRegistry,
    })

    await deployer.sendTransaction({
      to: walletRegistry.address,
      value: ethers.utils.parseEther("100"),
    })

    await deployer.sendTransaction({
      to: reimbursementPool.address,
      value: ethers.utils.parseEther("100"),
    })
    ;({ fraudChallengeDepositAmount } = await bridge.fraudParameters())
    ;[thirdParty, walletMaintainer, spvMaintainer] =
      await helpers.signers.getUnnamedSigners()
  })

  describe("defeatFraudChallenge", () => {
    context("when the input is non-witness", () => {
      context("when the transaction has single input", () => {
        context(
          "when the input is marked as correctly spent in the Bridge",
          () => {
            const data = nonWitnessSignSingleInputTx
            let initialThirdPartyBalance: BigNumber
            let tx: ContractTransaction

            before(async () => {
              await createSnapshot()

              await bridge.setWallet(walletPublicKeyHash, {
                ecdsaWalletID: ethers.constants.HashZero,
                mainUtxoHash: ethers.constants.HashZero,
                pendingRedemptionsValue: 0,
                createdAt: await lastBlockTime(),
                movingFundsRequestedAt: 0,
                closingStartedAt: 0,
                pendingMovedFundsSweepRequestsCount: 0,
                state: walletState.Live,
                movingFundsTargetWalletsCommitmentHash:
                  ethers.constants.HashZero,
              })
              await bridge.setSweptDeposits(data.deposits)
              await bridge.setSpentMainUtxos(data.spentMainUtxos)
              await bridge.setProcessedMovedFundsSweepRequests(
                data.movedFundsSweepRequests
              )

              await bridge
                .connect(thirdParty)
                .submitFraudChallenge(
                  walletPublicKey,
                  data.preimageSha256,
                  data.signature,
                  {
                    value: fraudChallengeDepositAmount,
                  }
                )

              initialThirdPartyBalance = await provider.getBalance(
                thirdParty.address
              )
              tx = await maintainerProxy
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

            it("should emit FraudChallengeDefeated event", async () => {
              await expect(tx).to.emit(bridge, "FraudChallengeDefeated")
            })

            it("should refund ETH", async () => {
              const postThirdPartyBalance = await provider.getBalance(
                thirdParty.address
              )
              const diff = postThirdPartyBalance.sub(initialThirdPartyBalance)

              expect(diff).to.be.gt(0)
              expect(diff).to.be.lt(
                ethers.utils.parseUnits("2000000", "gwei") // 0,002 ETH
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
            let initialThirdPartyBalance: BigNumber
            let tx: ContractTransaction

            before(async () => {
              await createSnapshot()

              await bridge.setWallet(walletPublicKeyHash, {
                ecdsaWalletID: ethers.constants.HashZero,
                mainUtxoHash: ethers.constants.HashZero,
                pendingRedemptionsValue: 0,
                createdAt: await lastBlockTime(),
                movingFundsRequestedAt: 0,
                closingStartedAt: 0,
                pendingMovedFundsSweepRequestsCount: 0,
                state: walletState.Live,
                movingFundsTargetWalletsCommitmentHash:
                  ethers.constants.HashZero,
              })
              await bridge.setSweptDeposits(data.deposits)
              await bridge.setSpentMainUtxos(data.spentMainUtxos)
              await bridge.setProcessedMovedFundsSweepRequests(
                data.movedFundsSweepRequests
              )

              await bridge
                .connect(thirdParty)
                .submitFraudChallenge(
                  walletPublicKey,
                  data.preimageSha256,
                  data.signature,
                  {
                    value: fraudChallengeDepositAmount,
                  }
                )

              initialThirdPartyBalance = await provider.getBalance(
                thirdParty.address
              )
              tx = await maintainerProxy
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

            it("should emit FraudChallengeDefeated event", async () => {
              await expect(tx).to.emit(bridge, "FraudChallengeDefeated")
            })

            it("should refund ETH", async () => {
              const postThirdPartyBalance = await provider.getBalance(
                thirdParty.address
              )
              const diff = postThirdPartyBalance.sub(initialThirdPartyBalance)

              expect(diff).to.be.gt(0)
              expect(diff).to.be.lt(
                ethers.utils.parseUnits("2000000", "gwei") // 0,002 ETH
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
            let initialThirdPartyBalance: BigNumber
            let tx: ContractTransaction

            before(async () => {
              await createSnapshot()

              await bridge.setWallet(walletPublicKeyHash, {
                ecdsaWalletID: ethers.constants.HashZero,
                mainUtxoHash: ethers.constants.HashZero,
                pendingRedemptionsValue: 0,
                createdAt: await lastBlockTime(),
                movingFundsRequestedAt: 0,
                closingStartedAt: 0,
                pendingMovedFundsSweepRequestsCount: 0,
                state: walletState.Live,
                movingFundsTargetWalletsCommitmentHash:
                  ethers.constants.HashZero,
              })
              await bridge.setSweptDeposits(data.deposits)
              await bridge.setSpentMainUtxos(data.spentMainUtxos)
              await bridge.setProcessedMovedFundsSweepRequests(
                data.movedFundsSweepRequests
              )

              await bridge
                .connect(thirdParty)
                .submitFraudChallenge(
                  walletPublicKey,
                  data.preimageSha256,
                  data.signature,
                  {
                    value: fraudChallengeDepositAmount,
                  }
                )

              initialThirdPartyBalance = await provider.getBalance(
                thirdParty.address
              )
              tx = await maintainerProxy
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

            it("should emit FraudChallengeDefeated event", async () => {
              await expect(tx).to.emit(bridge, "FraudChallengeDefeated")
            })

            it("should refund ETH", async () => {
              const postThirdPartyBalance = await provider.getBalance(
                thirdParty.address
              )
              const diff = postThirdPartyBalance.sub(initialThirdPartyBalance)

              expect(diff).to.be.gt(0)
              expect(diff).to.be.lt(
                ethers.utils.parseUnits("2000000", "gwei") // 0,002 ETH
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
            let initialThirdPartyBalance: BigNumber
            let tx: ContractTransaction

            before(async () => {
              await createSnapshot()

              await bridge.setWallet(walletPublicKeyHash, {
                ecdsaWalletID: ethers.constants.HashZero,
                mainUtxoHash: ethers.constants.HashZero,
                pendingRedemptionsValue: 0,
                createdAt: await lastBlockTime(),
                movingFundsRequestedAt: 0,
                closingStartedAt: 0,
                pendingMovedFundsSweepRequestsCount: 0,
                state: walletState.Live,
                movingFundsTargetWalletsCommitmentHash:
                  ethers.constants.HashZero,
              })
              await bridge.setSweptDeposits(data.deposits)
              await bridge.setSpentMainUtxos(data.spentMainUtxos)
              await bridge.setProcessedMovedFundsSweepRequests(
                data.movedFundsSweepRequests
              )

              await bridge
                .connect(thirdParty)
                .submitFraudChallenge(
                  walletPublicKey,
                  data.preimageSha256,
                  data.signature,
                  {
                    value: fraudChallengeDepositAmount,
                  }
                )

              initialThirdPartyBalance = await provider.getBalance(
                thirdParty.address
              )
              tx = await maintainerProxy
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

            it("should emit FraudChallengeDefeated event", async () => {
              await expect(tx).to.emit(bridge, "FraudChallengeDefeated")
            })

            it("should refund ETH", async () => {
              const postThirdPartyBalance = await provider.getBalance(
                thirdParty.address
              )
              const diff = postThirdPartyBalance.sub(initialThirdPartyBalance)

              expect(diff).to.be.gt(0)
              expect(diff).to.be.lt(
                ethers.utils.parseUnits("2000000", "gwei") // 0,002 ETH
              )
            })
          }
        )
      })
    })
  })

  describe("defeatFraudChallengeWithHeartbeat", () => {
    let heartbeatWalletPublicKey: string
    let heartbeatWalletSigningKey: SigningKey

    let initialThirdPartyBalance: BigNumber
    let tx: ContractTransaction

    before(async () => {
      await createSnapshot()

      // For `defeatFraudChallengeWithHeartbeat` unit tests we do not use test
      // data from `fraud.ts`. Instead, we create random wallet and use its
      // SigningKey.
      //
      // This approach is better long-term. In case the format of the heartbeat
      // message changes or in case we want to add more unit tests, we can simply
      // call appropriate function to compute another signature. Also, we do not
      // use any BTC-specific data for this set of unit tests.
      const wallet = ethers.Wallet.createRandom()
      // We use `ethers.utils.SigningKey` for a `Wallet` instead of
      // `Signer.signMessage` to do not add '\x19Ethereum Signed Message:\n'
      // prefix to the signed message. The format of the heartbeat message is
      // the same no matter on which host chain TBTC is deployed.
      heartbeatWalletSigningKey = new ethers.utils.SigningKey(wallet.privateKey)
      // Public key obtained as `wallet.publicKey` is an uncompressed key,
      // prefixed with `0x04`. To compute raw ECDSA key, we need to drop `0x04`.
      heartbeatWalletPublicKey = `0x${wallet.publicKey.substring(4)}`

      const walletID = keccak256(heartbeatWalletPublicKey)
      const walletPublicKeyX = `0x${heartbeatWalletPublicKey.substring(2, 66)}`
      const walletPublicKeyY = `0x${heartbeatWalletPublicKey.substring(66)}`
      await bridge
        .connect(walletRegistry.wallet)
        .__ecdsaWalletCreatedCallback(
          walletID,
          walletPublicKeyX,
          walletPublicKeyY
        )

      const heartbeatMessage = "0xFFFFFFFFFFFFFFFF0000000000E0EED7"
      const heartbeatMessageSha256 = sha256(heartbeatMessage)
      const sighash = sha256(sha256(heartbeatMessage))

      const signature = ethers.utils.splitSignature(
        heartbeatWalletSigningKey.signDigest(sighash)
      )

      await bridge
        .connect(thirdParty)
        .submitFraudChallenge(
          heartbeatWalletPublicKey,
          heartbeatMessageSha256,
          signature,
          {
            value: fraudChallengeDepositAmount,
          }
        )

      initialThirdPartyBalance = await provider.getBalance(thirdParty.address)
      tx = await maintainerProxy
        .connect(thirdParty)
        .defeatFraudChallengeWithHeartbeat(
          heartbeatWalletPublicKey,
          heartbeatMessage
        )
    })

    after(async () => {
      await restoreSnapshot()
    })

    it("should emit FraudChallengeDefeated event", async () => {
      await expect(tx).to.emit(bridge, "FraudChallengeDefeated")
    })

    it("should refund ETH", async () => {
      const postThirdPartyBalance = await provider.getBalance(
        thirdParty.address
      )
      const diff = postThirdPartyBalance.sub(initialThirdPartyBalance)

      expect(diff).to.be.gt(0)
      expect(diff).to.be.lt(
        ethers.utils.parseUnits("1000000", "gwei") // 0,001 ETH
      )
    })
  })
})
