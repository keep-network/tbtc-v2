/* eslint-disable @typescript-eslint/no-extra-semi */
import { ethers, helpers, waffle } from "hardhat"
import { expect } from "chai"

import type { FakeContract } from "@defi-wonderland/smock"
import type { ContractTransaction } from "ethers"
import type { SignerWithAddress } from "@nomiclabs/hardhat-ethers/signers"
import type { Bridge, IRandomBeacon, WalletRegistry } from "../../typechain"

import {
  performEcdsaDkg,
  updateWalletRegistryDkgResultChallengePeriodLength,
} from "./utils/ecdsa-wallet-registry"
import {
  ecdsaWalletTestData,
  ecdsaWalletTestData as ecdsaWallet,
} from "../data/ecdsa"
import { produceRelayEntry } from "./utils/random-beacon"

import { assertGasUsed } from "./utils/gas"
import { fixture } from "./utils/fixture"

import {
  wallet as fraudulentWallet,
  nonWitnessSignSingleInputTx,
} from "../data/fraud"
import { SinglePendingRequestedRedemption } from "../data/redemption"
import { walletState } from "../fixtures"

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
  let walletRegistry: WalletRegistry
  let randomBeacon: FakeContract<IRandomBeacon>
  let governance: SignerWithAddress
  let thirdParty: SignerWithAddress
  let walletMembersIDs: number[]

  const dkgResultChallengePeriodLength = 10

  before(async () => {
    ;({ governance, bridge, walletRegistry, randomBeacon, walletMembersIDs } =
      await waffle.loadFixture(fixture))
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

        // TODO: Implement validations
        it("should slash wallet members")

        it("should close the wallet in the wallet registry", async () => {
          // eslint-disable-next-line @typescript-eslint/no-unused-expressions
          expect(await walletRegistry.isWalletRegistered(ecdsaWalletID)).to.be
            .false
        })

        it("should close the wallet in the bridge", async () => {
          const storedWallet = await bridge.wallets(walletPubKeyHash160)

          expect(storedWallet.state).to.be.equal(walletState.Terminated)
        })

        it("should consume around X 000 gas for Bridge.notifyMovingFundsTimeoutTx transaction", async () => {
          await assertGasUsed(notifyFraudChallengeDefeatTimeoutTx, 10) // FIXME: Add gas estimate
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
      const {
        publicKey: walletPublicKey,
        walletID: ecdsaWalletID,
        pubKeyHash160: walletPubKeyHash160,
      } = ecdsaWallet

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

      describe.skip("when moving funds timeout is reported", async () => {
        let notifyMovingFundsTimeoutTx: ContractTransaction

        before(async () => {
          const { movingFundsTimeout } = await bridge.movingFundsParameters()

          // TODO: Implement path to get to `MovingFunds` state.

          await helpers.time.increaseTime(movingFundsTimeout)

          notifyMovingFundsTimeoutTx = await bridge
            .connect(thirdParty)
            .notifyMovingFundsTimeout(
              ecdsaWalletTestData.pubKeyHash160,
              walletMembersIDs
            )
        })

        // TODO: Implement
        it("should slash wallet members")

        it("should close the wallet in the wallet registry", async () => {
          // eslint-disable-next-line @typescript-eslint/no-unused-expressions
          expect(await walletRegistry.isWalletRegistered(ecdsaWalletID)).to.be
            .false
        })

        it("should close the wallet in the bridge", async () => {
          const storedWallet = await bridge.wallets(walletPubKeyHash160)

          expect(storedWallet.state).to.be.equal(walletState.Terminated)
        })

        it("should consume around 100 000 gas for Bridge.notifyMovingFundsTimeoutTx transaction", async () => {
          await assertGasUsed(notifyMovingFundsTimeoutTx, 100_000)
        })
      })
    })
  })
})
