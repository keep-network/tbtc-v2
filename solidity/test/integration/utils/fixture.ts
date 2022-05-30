/* eslint-disable no-await-in-loop */

import { FakeContract, smock } from "@defi-wonderland/smock"
import { SignerWithAddress } from "@nomiclabs/hardhat-ethers/signers"
import { Contract } from "ethers"
import { deployments, ethers, helpers } from "hardhat"
import {
  TBTC,
  Bridge,
  TBTCVault,
  TestRelay,
  IRandomBeacon,
  WalletRegistry,
  VendingMachine,
} from "../../../typechain"
import { Bank } from "../../../typechain/Bank"
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
    deployer: SignerWithAddress
    governance: SignerWithAddress
    tbtc: TBTC
    bridge: Bridge
    bank: Bank
    tbtcVault: TBTCVault
    walletRegistry: WalletRegistry
    staking: Contract
    randomBeacon: FakeContract<IRandomBeacon>
    relay: FakeContract<TestRelay>
  }> => {
    await deployments.fixture()
    const { deployer, governance } = await helpers.signers.getNamedSigners()

    const tbtc = await helpers.contracts.getContract<TBTC>("TBTC")
    const bridge = await helpers.contracts.getContract<Bridge>("Bridge")
    const bank = await helpers.contracts.getContract<Bank>("Bank")
    const tbtcVault: TBTCVault = await helpers.contracts.getContract(
      "TBTCVault"
    )
    const walletRegistry = await helpers.contracts.getContract<WalletRegistry>(
      "WalletRegistry"
    )
    const t = await helpers.contracts.getContract("T")
    const staking = await helpers.contracts.getContract("TokenStaking")

    // TODO: Vault registration and upgrade from VendingMachine should be a part
    // of the deployment scripts.
    await prepareVault(
      bridge,
      tbtcVault,
      await helpers.contracts.getContract("VendingMachine"),
      governance,
      deployer,
      deployer
    )

    // TODO: INTEGRATE WITH THE REAL BEACON
    const randomBeacon = await fakeRandomBeacon(walletRegistry)

    const sortitionPool = await ethers.getContractAt(
      "SortitionPool",
      await walletRegistry.sortitionPool()
    )

    const relay = await smock.fake<TestRelay>("TestRelay", {
      address: await (await bridge.contractReferences()).relay,
    })

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
      await registerOperator(
        walletRegistry,
        sortitionPool,
        stakingProvider,
        operator
      )
    }

    return {
      deployer,
      governance,
      tbtc,
      bridge,
      bank,
      tbtcVault,
      walletRegistry,
      staking,
      randomBeacon,
      relay,
    }
  }
)

async function prepareVault(
  bridge: Bridge,
  tbtcVault: TBTCVault,
  vendingMachine: VendingMachine,
  governance: SignerWithAddress,
  vendingMachineUpgradeInitiator: SignerWithAddress,
  vendingMachineOwner: SignerWithAddress
) {
  // Deployment scripts deploy both `VendingMachine` and `TBTCVault` but they
  // do not transfer the ownership of `TBTC` token to `TBTCVault`.
  // We need to do it manually in tests covering `TBTCVault` behavior.
  // Also, please note that `03_transfer_roles.ts` assigning `VendingMachine`
  // upgrade initiator role to Keep Technical Wallet is skipped for Hardhat
  // env deployment. That's why the upgrade initiator and `VendingMachine`
  // owner is the deployer.
  await vendingMachine
    .connect(vendingMachineUpgradeInitiator)
    .initiateVendingMachineUpgrade(tbtcVault.address)
  await helpers.time.increaseTime(await vendingMachine.GOVERNANCE_DELAY())
  await vendingMachine
    .connect(vendingMachineOwner)
    .finalizeVendingMachineUpgrade()

  await bridge.connect(governance).setVaultStatus(tbtcVault.address, true)
}
