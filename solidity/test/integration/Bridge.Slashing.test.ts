/* eslint-disable no-underscore-dangle */
import { ethers, helpers, waffle } from "hardhat"
import chai, { expect } from "chai"
import { smock } from "@defi-wonderland/smock"
import { BigNumber, ContractTransaction, BytesLike, Signer } from "ethers"
import { SignerWithAddress } from "@nomiclabs/hardhat-ethers/signers"
import {
  walletPublicKey,
  walletPublicKeyHash,
  nonWitnessSignSingleInputTx,
} from "../data/fraud"
import type {
  Bridge,
  BridgeStub,
  IRandomBeacon,
  WalletRegistry,
  SortitionPool,
} from "../../typechain"
import bridgeFullDeploymentFixture from "../fixtures/bridge-full-deployment"
import { createNewWallet, Operator } from "./helpers/contract-test-helpers"
import { walletState } from "../fixtures"
import { ecdsaWalletTestData } from "../data/ecdsa"

chai.use(smock.matchers)

const { createSnapshot, restoreSnapshot } = helpers.snapshot
const { increaseTime } = helpers.time

describe("Bridge - Slashing", () => {
  let governance: SignerWithAddress
  let thirdParty: SignerWithAddress
  let bridge: Bridge & BridgeStub
  let walletRegistry: WalletRegistry
  let walletID: string
  let members: Operator[]

  before(async () => {
    // eslint-disable-next-line @typescript-eslint/no-extra-semi
    ;({ governance, thirdParty, bridge, walletRegistry } =
      await waffle.loadFixture(bridgeFullDeploymentFixture))
    ;({ walletID, members } = await createNewWallet(
      walletRegistry,
      bridge,
      walletPublicKey
    ))
  })

  describe("notifyFraudChallengeDefeatTimeout", () => {
    const data = nonWitnessSignSingleInputTx
    const walletDraft = {
      ecdsaWalletID: ecdsaWalletTestData.walletID,
      mainUtxoHash: ethers.constants.HashZero,
      pendingRedemptionsValue: 0,
      createdAt: 0,
      movingFundsRequestedAt: 0,
      closingStartedAt: 0,
      pendingMovedFundsSweepRequestsCount: 0,
      state: walletState.Live,
      movingFundsTargetWalletsCommitmentHash: ethers.constants.HashZero,
    }
    const walletMembersIDs = [1, 2, 3, 4, 5]

    let fraudChallengeDepositAmount: BigNumber
    let fraudChallengeDefeatTimeout: BigNumber
    let tx: ContractTransaction

    before(async () => {
      await createSnapshot()
      ;({ fraudChallengeDepositAmount, fraudChallengeDefeatTimeout } =
        await bridge.fraudParameters())
      await bridge.setWallet(walletPublicKeyHash, walletDraft)

      await bridge
        .connect(thirdParty)
        .submitFraudChallenge(walletPublicKey, data.sighash, data.signature, {
          value: fraudChallengeDepositAmount,
        })

      await increaseTime(fraudChallengeDefeatTimeout)

      tx = await bridge
        .connect(thirdParty)
        .notifyFraudChallengeDefeatTimeout(
          walletPublicKey,
          walletMembersIDs,
          data.sighash
        )
    })

    after(async () => {
      await restoreSnapshot()
    })

    it("should use acceptable amount of gas", async () => {})
  })

  describe("notifyRedemptionTimeout", () => {
    // TODO: Implement
  })

  describe("notifyMovingFundsTimeout", () => {
    // TODO: Implement
  })
})
