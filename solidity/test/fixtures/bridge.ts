import { deployments, ethers } from "hardhat"
import { smock } from "@defi-wonderland/smock"
import type {
  Bank,
  BankStub,
  Bridge,
  BridgeStub,
  IWalletRegistry,
  BridgeStub__factory,
  TestRelay,
} from "../../typechain"

/**
 * Common fixture for tests suites targeting the Bridge contract.
 */
export default async function bridgeFixture() {
  await deployments.fixture()

  const { deployer, governance, treasury } = await ethers.getNamedSigners()
  const [thirdParty] = await ethers.getUnnamedSigners()

  const bank: Bank & BankStub = await ethers.getContract("Bank")

  const bridge: Bridge & BridgeStub = await ethers.getContract("Bridge")

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

  const BridgeFactory = await ethers.getContractFactory<BridgeStub__factory>(
    "BridgeStub",
    {
      libraries: {
        Deposit: (await ethers.getContract("Deposit")).address,
        DepositSweep: (await ethers.getContract("DepositSweep")).address,
        Redemption: (await ethers.getContract("Redemption")).address,
        Wallets: (await ethers.getContract("Wallets")).address,
        Fraud: (await ethers.getContract("Fraud")).address,
        MovingFunds: (await ethers.getContract("MovingFunds")).address,
      },
    }
  )

  return {
    governance,
    thirdParty,
    treasury,
    bank,
    relay,
    walletRegistry,
    bridge,
    BridgeFactory,
  }
}
