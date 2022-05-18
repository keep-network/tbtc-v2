import { deployments, ethers, helpers } from "hardhat"
import { smock } from "@defi-wonderland/smock"
import type {
  Bank,
  BankStub,
  Bridge,
  BridgeStub,
  IWalletRegistry,
  TestRelay,
  TBTC,
  TBTCVault,
} from "../../typechain"

/**
 * Common fixture for tests suites targeting the Bridge contract.
 */
export default async function bridgeFixture() {
  await deployments.fixture()

  const { deployer, governance, treasury } =
    await helpers.signers.getNamedSigners()
  const [thirdParty] = await helpers.signers.getUnnamedSigners()

  const tbtc: TBTC = await helpers.contracts.getContract("TBTC")

  const tbtcVault: TBTCVault = await helpers.contracts.getContract("TBTCVault")

  const bank: Bank & BankStub = await helpers.contracts.getContract("Bank")

  const bridge: Bridge & BridgeStub = await helpers.contracts.getContract(
    "Bridge"
  )

  const walletRegistry = await smock.fake<IWalletRegistry>("IWalletRegistry", {
    address: await (await bridge.contractReferences()).ecdsaWalletRegistry,
  })
  // Fund the `walletRegistry` account so it's possible to mock sending requests
  // from it.
  await deployer.sendTransaction({
    to: walletRegistry.address,
    value: ethers.utils.parseEther("1"),
  })

  const relay = await smock.fake<TestRelay>("TestRelay", {
    address: await (await bridge.contractReferences()).relay,
  })

  await bank.connect(governance).updateBridge(bridge.address)

  const BridgeFactory = await ethers.getContractFactory("BridgeStub", {
    libraries: {
      Deposit: (await helpers.contracts.getContract("Deposit")).address,
      DepositSweep: (
        await helpers.contracts.getContract("DepositSweep")
      ).address,
      Redemption: (await helpers.contracts.getContract("Redemption")).address,
      Wallets: (await helpers.contracts.getContract("Wallets")).address,
      Fraud: (await helpers.contracts.getContract("Fraud")).address,
      MovingFunds: (await helpers.contracts.getContract("MovingFunds")).address,
    },
  })

  return {
    governance,
    thirdParty,
    treasury,
    tbtc,
    tbtcVault,
    bank,
    relay,
    walletRegistry,
    bridge,
    BridgeFactory,
  }
}
