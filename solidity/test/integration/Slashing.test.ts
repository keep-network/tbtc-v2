/* eslint-disable no-await-in-loop */
/* eslint-disable @typescript-eslint/no-extra-semi */
import { ethers, helpers, waffle } from "hardhat"
import { expect } from "chai"

import type { FakeContract } from "@defi-wonderland/smock"
import type { ContractTransaction, Contract, BigNumberish } from "ethers"
import type { SignerWithAddress } from "@nomiclabs/hardhat-ethers/signers"

import type {
  Bridge,
  TBTCVault,
  TestRelay,
  IRandomBeacon,
  WalletRegistry,
} from "../../typechain"

import {
  Operators,
  performEcdsaDkg,
  produceOperatorInactivityClaim,
  updateWalletRegistryDkgResultChallengePeriodLength,
} from "./utils/ecdsa-wallet-registry"
import { produceRelayEntry } from "./utils/random-beacon"

import { assertGasUsed } from "./utils/gas"
import { fixture } from "./utils/fixture"

import {
  wallet as fraudulentWallet,
  nonWitnessSignSingleInputTx,
} from "../data/fraud"
import { SinglePendingRequestedRedemption } from "../data/redemption"
import { walletState } from "../fixtures"
import { SingleP2SHDeposit } from "../data/deposit-sweep"

const { wallet: redemptionWallet } = SinglePendingRequestedRedemption

const { increaseTime } = helpers.time
const { createSnapshot, restoreSnapshot } = helpers.snapshot

const NO_MAIN_UTXO = {
  txHash: "0x0000000000000000000000000000000000000000000000000000000000000000",
  txOutputIndex: 0,
  txOutputValue: 0,
}

const describeFn =
  process.env.NODE_ENV === "integration-test" ? describe : describe.skip

describeFn("Integration Test - Slashing", async () => {
  let bridge: Bridge
  let tbtcVault: TBTCVault
  let staking: Contract
  let walletRegistry: WalletRegistry
  let randomBeacon: FakeContract<IRandomBeacon>
  let relay: FakeContract<TestRelay>
  let governance: SignerWithAddress
  let thirdParty: SignerWithAddress

  const dkgResultChallengePeriodLength = 10

  before(async () => {
    ;({
      governance,
      bridge,
      tbtcVault,
      staking,
      walletRegistry,
      relay,
      randomBeacon,
    } = await waffle.loadFixture(fixture))
    ;[thirdParty] = await helpers.signers.getUnnamedSigners()

    // Update only the parameters that are crucial for this test.
    await updateWalletRegistryDkgResultChallengePeriodLength(
      walletRegistry,
      governance,
      dkgResultChallengePeriodLength
    )
  })

  describe("notifyFraudChallengeDefeatTimeout", async () => {
    before(async () => {
      await createSnapshot()
    })

    after(async () => {
      await restoreSnapshot()
    })

    describe("when wallet is created", async () => {
      const {
        publicKey: walletPublicKey,
        ecdsaWalletID,
        pubKeyHash160: walletPubKeyHash160,
      } = fraudulentWallet

      let walletMembers: Operators

      before("create a wallet", async () => {
        expect(await bridge.activeWalletPubKeyHash()).to.be.equal(
          ethers.constants.AddressZero
        )

        const requestNewWalletTx = await bridge.requestNewWallet(NO_MAIN_UTXO)

        await produceRelayEntry(walletRegistry, randomBeacon)
        ;({ walletMembers } = await performEcdsaDkg(
          walletRegistry,
          walletPublicKey,
          requestNewWalletTx.blockNumber
        ))
      })

      describe("when a fraud is reported", async () => {
        const fraudulentBtcTx = nonWitnessSignSingleInputTx
        let notifyFraudChallengeDefeatTimeoutTx: ContractTransaction

        before(async () => {
          const { fraudChallengeDepositAmount, fraudChallengeDefeatTimeout } =
            await bridge.fraudParameters()

          await bridge
            .connect(thirdParty)
            .submitFraudChallenge(
              walletPublicKey,
              fraudulentBtcTx.preimageSha256,
              fraudulentBtcTx.signature,
              {
                value: fraudChallengeDepositAmount,
              }
            )

          await increaseTime(fraudChallengeDefeatTimeout)

          notifyFraudChallengeDefeatTimeoutTx = await bridge
            .connect(thirdParty)
            .notifyFraudChallengeDefeatTimeout(
              walletPublicKey,
              walletMembers.getIds(),
              fraudulentBtcTx.preimageSha256
            )
        })

        it("should slash wallet members", async () => {
          const { fraudSlashingAmount: amountToSlash } =
            await bridge.fraudParameters()

          expect(await staking.getSlashingQueueLength()).to.equal(
            walletMembers.length
          )

          for (let i = 0; i < walletMembers.length; i++) {
            const slashing = await staking.slashingQueue(i)

            expect(slashing.amount).to.equal(
              amountToSlash,
              `unexpected slashing amount for ${i}`
            )

            expect(slashing.stakingProvider).to.equal(
              walletMembers[i].stakingProvider,
              `unexpected staking provider for ${i}`
            )
          }
        })

        it("should close the wallet in the wallet registry", async () => {
          // eslint-disable-next-line @typescript-eslint/no-unused-expressions
          expect(await walletRegistry.isWalletRegistered(ecdsaWalletID)).to.be
            .false
        })

        it("should close the wallet in the bridge", async () => {
          const storedWallet = await bridge.wallets(walletPubKeyHash160)

          expect(storedWallet.state).to.be.equal(walletState.Terminated)
        })

        it("should consume around 3 100 000 gas for Bridge.notifyMovingFundsTimeoutTx transaction", async () => {
          await assertGasUsed(
            notifyFraudChallengeDefeatTimeoutTx,
            3_150_000,
            100_000
          )
        })
      })
    })
  })

  describe("notifyRedemptionTimeout", async () => {
    before(async () => {
      await createSnapshot()
    })

    after(async () => {
      await restoreSnapshot()
    })

    describe("when wallet is created", async () => {
      const { publicKey: walletPublicKey } = redemptionWallet

      before("create a wallet", async () => {
        expect(await bridge.activeWalletPubKeyHash()).to.be.equal(
          ethers.constants.AddressZero
        )

        const requestNewWalletTx = await bridge.requestNewWallet(NO_MAIN_UTXO)

        await produceRelayEntry(walletRegistry, randomBeacon)

        await performEcdsaDkg(
          walletRegistry,
          walletPublicKey,
          requestNewWalletTx.blockNumber
        )
      })

      describe("when a redemption timeout is reported", async () => {
        // TODO: Implement
      })
    })
  })

  describe("notifyMovingFundsTimeout", async () => {
    before(async () => {
      await createSnapshot()
    })

    after(async () => {
      await restoreSnapshot()
    })

    describe("when wallet is created", async () => {
      const deposit = SingleP2SHDeposit.deposits[0]

      const walletPubKeyHash160 = deposit.reveal.walletPubKeyHash
      const { walletPublicKey, walletID: ecdsaWalletID } = deposit.ecdsaWallet

      let walletMembers: Operators

      before(async () => {
        const requestNewWalletTx = await bridge.requestNewWallet(NO_MAIN_UTXO)

        await produceRelayEntry(walletRegistry, randomBeacon)
        ;({ walletMembers } = await performEcdsaDkg(
          walletRegistry,
          walletPublicKey,
          requestNewWalletTx.blockNumber
        ))

        const { fundingTx, reveal } = SingleP2SHDeposit.deposits[0]
        reveal.vault = tbtcVault.address

        // We use a deposit funding bitcoin transaction with a very low amount,
        // so we need to update the dust threshold to be below it.
        await updateDepositDustThreshold(10000) // 0.0001 BTC)

        await bridge.revealDeposit(fundingTx, reveal)

        // TODO: Replace mocks with the real implementation
        relay.getCurrentEpochDifficulty.returns(
          SingleP2SHDeposit.chainDifficulty
        )
        relay.getPrevEpochDifficulty.returns(SingleP2SHDeposit.chainDifficulty)

        await bridge.submitDepositSweepProof(
          SingleP2SHDeposit.sweepTx,
          SingleP2SHDeposit.sweepProof,
          SingleP2SHDeposit.mainUtxo,
          tbtcVault.address
        )

        // Switch the wallet to moving funds state by reporting wallet members
        // inactivity.
        const nonce = 0
        const walletMembersIDs = walletMembers.getIds()

        const inactiveMembersIndices = [26, 40, 63, 78, 89]
        const claim = await produceOperatorInactivityClaim(
          ecdsaWalletID,
          walletMembers,
          nonce,
          walletPublicKey,
          true,
          inactiveMembersIndices,
          walletMembers.length / 2 + 1
        )

        await walletRegistry
          .connect(walletMembers[0].signer)
          .notifyOperatorInactivity(claim, nonce, walletMembersIDs)
      })

      describe("when moving funds timeout is reported", async () => {
        let notifyMovingFundsTimeoutTx: ContractTransaction

        before(async () => {
          expect(
            await (
              await bridge.wallets(walletPubKeyHash160)
            ).state
          ).to.be.equal(walletState.MovingFunds)

          const { movingFundsTimeout } = await bridge.movingFundsParameters()

          await helpers.time.increaseTime(movingFundsTimeout)

          notifyMovingFundsTimeoutTx = await bridge
            .connect(thirdParty)
            .notifyMovingFundsTimeout(
              walletPubKeyHash160,
              walletMembers.getIds()
            )
        })

        it("should slash wallet members", async () => {
          const { movingFundsTimeoutSlashingAmount: amountToSlash } =
            await bridge.movingFundsParameters()

          expect(await staking.getSlashingQueueLength()).to.equal(
            walletMembers.length
          )

          for (let i = 0; i < walletMembers.length; i++) {
            const slashing = await staking.slashingQueue(i)

            expect(slashing.amount).to.equal(
              amountToSlash,
              `unexpected slashing amount for ${i}`
            )

            expect(slashing.stakingProvider).to.equal(
              walletMembers[i].stakingProvider,
              `unexpected staking provider for ${i}`
            )
          }
        })

        it("should close the wallet in the wallet registry", async () => {
          // eslint-disable-next-line @typescript-eslint/no-unused-expressions
          expect(await walletRegistry.isWalletRegistered(ecdsaWalletID)).to.be
            .false
        })

        it("should close the wallet in the bridge", async () => {
          const storedWallet = await bridge.wallets(walletPubKeyHash160)

          expect(storedWallet.state).to.be.equal(walletState.Terminated)
        })

        it("should consume around 3 100 000 gas for Bridge.notifyMovingFundsTimeoutTx transaction", async () => {
          await assertGasUsed(notifyMovingFundsTimeoutTx, 3_100_000, 50_000)
        })
      })
    })
  })

  async function updateDepositDustThreshold(
    newDepositDustThreshold: BigNumberish
  ) {
    const currentDepositParameters = await bridge.depositParameters()
    await bridge
      .connect(governance)
      .updateDepositParameters(
        newDepositDustThreshold,
        currentDepositParameters.depositTreasuryFeeDivisor,
        currentDepositParameters.depositTxMaxFee
      )
  }
})
