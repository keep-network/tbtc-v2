/* eslint-disable no-await-in-loop */

import { FakeContract } from "@defi-wonderland/smock"
import { SignerWithAddress } from "@nomiclabs/hardhat-ethers/signers"
import { Contract } from "ethers"
import { deployments, ethers, helpers } from "hardhat"
import { Bridge, IRandomBeacon, WalletRegistry } from "../../../typechain"
import { registerOperator } from "./ecdsa-wallet-registry"
import { fakeRandomBeacon } from "./random-beacon"
import { authorizeApplication, stake } from "./staking"

const { to1e18 } = helpers.number

// Number of operators to register in the sortition pool
const numberOfOperators = 110

const unnamedSignersOffset = 0
const stakeAmount = to1e18(40_000)

// eslint-disable-next-line import/prefer-default-export
export const fixture = deployments.createFixture(
  async (): Promise<{
    governance: SignerWithAddress
    bridge: Bridge
    walletRegistry: WalletRegistry
    t: Contract
    staking: Contract
    randomBeacon: FakeContract<IRandomBeacon>
    walletMembersIDs: number[]
  }> => {
    await deployments.fixture()
    const { governance } = await helpers.signers.getNamedSigners()

    const bridge = await helpers.contracts.getContract<Bridge>("Bridge")
    const walletRegistry = await helpers.contracts.getContract<WalletRegistry>(
      "WalletRegistry"
    )
    const t = await helpers.contracts.getContract("T")
    const staking = await helpers.contracts.getContract("TokenStaking")

    // TODO: INTEGRATE WITH THE REAL BEACON
    const randomBeacon = await fakeRandomBeacon(walletRegistry)

    const sortitionPool = await ethers.getContractAt(
      "SortitionPool",
      await walletRegistry.sortitionPool()
    )

    const signers = (await helpers.signers.getUnnamedSigners()).slice(
      unnamedSignersOffset
    )

    // We use unique accounts for each staking role for each operator.
    if (signers.length < numberOfOperators * 5) {
      throw new Error(
        "not enough unnamed signers; update hardhat network's configuration account count"
      )
    }

    const walletMembersIDs: number[] = []

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
      const operatorID = await registerOperator(
        walletRegistry,
        sortitionPool,
        stakingProvider,
        operator
      )

      walletMembersIDs.push(operatorID)
    }

    return {
      governance,
      bridge,
      walletRegistry,
      t,
      staking,
      randomBeacon,
      walletMembersIDs,
    }
  }
)
