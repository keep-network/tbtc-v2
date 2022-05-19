/* eslint-disable @typescript-eslint/no-extra-semi */
import { ethers, waffle } from "hardhat"
import { expect } from "chai"

import type { FakeContract } from "@defi-wonderland/smock"
import type { BigNumberish, ContractTransaction } from "ethers"
import type { SignerWithAddress } from "@nomiclabs/hardhat-ethers/signers"
import type { Bridge, IRandomBeacon, WalletRegistry } from "../../typechain"

import {
  produceEcdsaDkgResult,
  updateWalletRegistryDkgResultChallengePeriodLength,
} from "./utils/ecdsa-wallet-registry"
import { ecdsaWalletTestData } from "../data/ecdsa"
import { produceRelayEntry } from "./utils/random-beacon"

import { assertGasUsed } from "./utils/gas"
import { fixture } from "./utils/fixture"

const NO_MAIN_UTXO = {
  txHash: "0x0000000000000000000000000000000000000000000000000000000000000000",
  txOutputIndex: 0,
  txOutputValue: 0,
}

const describeFn =
  process.env.NODE_ENV === "integration-test" ? describe : describe.skip

describeFn("Integration Test - Wallet Creation", async () => {
  let bridge: Bridge
  let walletRegistry: WalletRegistry
  let randomBeacon: FakeContract<IRandomBeacon>
  let governance: SignerWithAddress

  const dkgResultChallengePeriodLength = 10

  // TODO: Generate a random public key
  const walletPublicKey = ecdsaWalletTestData.publicKey
  const walletPubKeyHash = ecdsaWalletTestData.pubKeyHash160

  before(async () => {
    ;({ governance, bridge, walletRegistry, randomBeacon } =
      await waffle.loadFixture(fixture))

    // Update only the parameters that are crucial for this test.
    await updateWalletRegistryDkgResultChallengePeriodLength(
      walletRegistry,
      governance,
      dkgResultChallengePeriodLength
    )
  })

  describe("new wallet creation (happy path)", async () => {
    let requestNewWalletTx: ContractTransaction

    before(async () => {
      expect(await bridge.activeWalletPubKeyHash()).to.be.equal(
        ethers.constants.AddressZero
      )

      requestNewWalletTx = await bridge.requestNewWallet(NO_MAIN_UTXO)
      const startBlock = requestNewWalletTx.blockNumber

      const relayEntry: BigNumberish = await produceRelayEntry(
        walletRegistry,
        randomBeacon
      )

      await produceEcdsaDkgResult(
        walletRegistry,
        walletPublicKey,
        relayEntry,
        startBlock
      )
    })

    it("should register a new wallet", async () => {
      expect(await bridge.activeWalletPubKeyHash()).to.be.equal(
        walletPubKeyHash
      )
    })

    it("should consume around 93 000 gas for Bridge.requestNewWallet transaction", async () => {
      await assertGasUsed(requestNewWalletTx, 93_000)
    })

    // TODO: Should we also validate gas used by Random Beacon and ECDSA Wallet Registry transactions?
  })
})
