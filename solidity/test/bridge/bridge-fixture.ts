import { ethers } from "hardhat"
import { smock } from "@defi-wonderland/smock"
import type {
  Bank,
  BankStub,
  BankStub__factory,
  BitcoinTx__factory,
  Deposit__factory,
  Sweep__factory,
  Redeem__factory,
  Wallets__factory,
  Bridge,
  BridgeStub,
  BridgeStub__factory,
  IWalletRegistry,
  Frauds,
  Frauds__factory,
  IRelay,
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

  const Deposit = await ethers.getContractFactory<Deposit__factory>("Deposit")
  const deposit = await Deposit.deploy()
  await deposit.deployed()

  const Sweep = await ethers.getContractFactory<Sweep__factory>("Sweep", {
    libraries: {
      BitcoinTx: bitcoinTx.address,
    },
  })
  const sweep = await Sweep.deploy()
  await sweep.deployed()

  const Redeem = await ethers.getContractFactory<Redeem__factory>("Redeem", {
    libraries: {
      BitcoinTx: bitcoinTx.address,
      Wallets: wallets.address,
    },
  })
  const redeem = await Redeem.deploy()
  await redeem.deployed()

  const Frauds = await ethers.getContractFactory<Frauds__factory>("Frauds")
  const frauds: Frauds = await Frauds.deploy()
  await frauds.deployed()

  const Bridge = await ethers.getContractFactory<BridgeStub__factory>(
    "BridgeStub",
    {
      libraries: {
        BitcoinTx: bitcoinTx.address,
        Deposit: deposit.address,
        Sweep: sweep.address,
        Redeem: redeem.address,
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
    Bridge,
    bridge,
  }
}

export default bridgeFixture
