import { ethers } from "hardhat"
import { smock } from "@defi-wonderland/smock"
import type {
  Bank,
  BankStub,
  BankStub__factory,
  BitcoinTx__factory,
  Bridge,
  BridgeStub,
  BridgeStub__factory,
  IWalletRegistry,
  Frauds,
  Frauds__factory,
  IRelay,
  Wallets__factory,
} from "../../typechain"

/**
 * Common fixture for tests suites targeting the Bridge contract.
 */
const bridgeFixture = async () => {
  const [deployer, governance, thirdParty, treasury] = await ethers.getSigners()

  const Bank = await ethers.getContractFactory<BankStub__factory>("BankStub")
  const bank: Bank & BankStub = await Bank.deploy()
  await bank.deployed()

  const relay = await smock.fake<IRelay>("IRelay")

  const walletRegistry = await smock.fake<IWalletRegistry>("IWalletRegistry")
  // Fund the `walletRegistry` account so it's possible to mock sending requests
  // from it.
  await deployer.sendTransaction({
    to: walletRegistry.address,
    value: ethers.utils.parseEther("1"),
  })

  const BitcoinTx = await ethers.getContractFactory<BitcoinTx__factory>(
    "BitcoinTx"
  )
  const bitcoinTx = await BitcoinTx.deploy()
  await bitcoinTx.deployed()

  const Wallets = await ethers.getContractFactory<Wallets__factory>("Wallets")
  const wallets = await Wallets.deploy()
  await wallets.deployed()

  const Frauds = await ethers.getContractFactory<Frauds__factory>("Frauds")
  const frauds: Frauds = await Frauds.deploy()
  await frauds.deployed()

  const Bridge = await ethers.getContractFactory<BridgeStub__factory>(
    "BridgeStub",
    {
      libraries: {
        BitcoinTx: bitcoinTx.address,
        Wallets: wallets.address,
        Frauds: frauds.address,
      },
    }
  )
  const bridge: Bridge & BridgeStub = await Bridge.deploy(
    bank.address,
    relay.address,
    treasury.address,
    walletRegistry.address,
    1
  )
  await bridge.deployed()

  await bank.updateBridge(bridge.address)
  await bridge.connect(deployer).transferOwnership(governance.address)

  return {
    governance,
    thirdParty,
    treasury,
    bank,
    relay,
    walletRegistry,
    bridge,
  }
}

export default bridgeFixture
