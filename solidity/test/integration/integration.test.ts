/* eslint-disable no-await-in-loop */
import { deployments, ethers, helpers } from "hardhat"
import { expect } from "chai"

import type { FakeContract } from "@defi-wonderland/smock"
import type { BigNumberish, Contract, ContractTransaction } from "ethers"
import type { SignerWithAddress } from "@nomiclabs/hardhat-ethers/signers"
import type { Bridge, IRandomBeacon, WalletRegistry } from "../../typechain"

import {
  registerOperator,
  produceEcdsaDkgResult,
} from "./utils/ecdsa-wallet-registry"
import { ecdsaWalletTestData } from "../data/ecdsa"
import { fakeRandomBeacon, produceRelayEntry } from "./utils/random-beacon"
import { authorizeApplication, stake } from "./utils/staking"
import { assertGasUsed } from "./utils/gas"

const { to1e18 } = helpers.number

const NO_MAIN_UTXO = {
  txHash: "0x0000000000000000000000000000000000000000000000000000000000000000",
  txOutputIndex: 0,
  txOutputValue: 0,
}

const describeFn =
  process.env.NODE_ENV === "integration-test" ? describe : describe.skip

describeFn("Integration Test", async () => {
  let bridge: Bridge
  let walletRegistry: WalletRegistry
  let t: Contract
  let staking: Contract
  let randomBeacon: FakeContract<IRandomBeacon>
  let governance: SignerWithAddress

  // Number of operators to register in the sortition pool
  const numberOfOperators = 110
  // Number of ECDSA wallet members to select
  const groupSize = 100

  const unnamedSignersOffset = 0
  const stakeAmount = to1e18(40_000)
  const dkgResultChallengePeriodLength = 10

  // TODO: Generate a random public key
  const ecdsaGroupPublicKey = ecdsaWalletTestData.publicKey
  const walletPubKeyHash = ecdsaWalletTestData.pubKeyHash160

  before(async () => {
    await deployments.fixture()
    ;({ governance } = await helpers.signers.getNamedSigners())

    bridge = await helpers.contracts.getContract("Bridge")
    walletRegistry = await helpers.contracts.getContract("WalletRegistry")
    t = await helpers.contracts.getContract("T")
    staking = await helpers.contracts.getContract("TokenStaking")

    // TODO: INTEGRATE WITH THE REAL BEACON
    randomBeacon = await fakeRandomBeacon(walletRegistry)

    // Update only the parameters that are crucial for this test.
    await updateWalletRegistryParams()

    const signers = (await helpers.signers.getUnnamedSigners()).slice(
      unnamedSignersOffset
    )

    // We use unique accounts for each staking role for each operator.
    if (signers.length < numberOfOperators * 5) {
      throw new Error(
        "not enough unnamed signers; update hardhat network's configuration account count"
      )
    }

    for (let i = 0; i < numberOfOperators; i++) {
      const owner: SignerWithAddress = signers[i]
      const stakingProvider: SignerWithAddress =
        signers[1 * numberOfOperators + i]
      const operator: SignerWithAddress = signers[2 * numberOfOperators + i]
      const beneficiary: SignerWithAddress = signers[3 * numberOfOperators + i]
      const authorizer: SignerWithAddress = signers[4 * numberOfOperators + i]

      await stake(
        t,
        staking,
        stakeAmount,
        owner,
        stakingProvider.address,
        beneficiary.address,
        authorizer.address
      )
      await authorizeApplication(
        staking,
        walletRegistry.address,
        authorizer,
        stakingProvider.address,
        stakeAmount
      )
      await registerOperator(walletRegistry, stakingProvider, operator)
    }
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
        ecdsaGroupPublicKey,
        relayEntry,
        startBlock,
        groupSize
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

  async function updateWalletRegistryParams() {
    const walletRegistryGovernance = await ethers.getContractAt(
      (
        await deployments.getArtifact("WalletRegistryGovernance")
      ).abi,
      await walletRegistry.governance()
    )

    await walletRegistryGovernance
      .connect(governance)
      .beginDkgResultChallengePeriodLengthUpdate(dkgResultChallengePeriodLength)

    await helpers.time.increaseTime(
      await walletRegistryGovernance.governanceDelay()
    )

    await walletRegistryGovernance
      .connect(governance)
      .finalizeDkgResultChallengePeriodLengthUpdate()
  }
})
