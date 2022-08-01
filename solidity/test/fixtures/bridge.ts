import { deployments, ethers, helpers } from "hardhat"
import { randomBytes } from "crypto"
import { smock } from "@defi-wonderland/smock"
import type {
  Bank,
  BankStub,
  Bridge,
  BridgeStub,
  IWalletRegistry,
  TestRelay,
  ReimbursementPool,
  MaintainerProxy,
  TBTC,
  TBTCVault,
  VendingMachine,
  BridgeGovernance,
} from "../../typechain"

/**
 * Common fixture for tests suites targeting the Bridge contract.
 */
export default async function bridgeFixture() {
  await deployments.fixture()

  const { deployer, governance, spvMaintainer, treasury } =
    await helpers.signers.getNamedSigners()
  const [thirdParty] = await helpers.signers.getUnnamedSigners()

  const tbtc: TBTC = await helpers.contracts.getContract("TBTC")

  const vendingMachine: VendingMachine = await helpers.contracts.getContract(
    "VendingMachine"
  )

  const tbtcVault: TBTCVault = await helpers.contracts.getContract("TBTCVault")

  const bank: Bank & BankStub = await helpers.contracts.getContract("Bank")

  const bridge: Bridge & BridgeStub = await helpers.contracts.getContract(
    "Bridge"
  )

  const bridgeGovernance: BridgeGovernance =
    await helpers.contracts.getContract("BridgeGovernance")

  const walletRegistry = await smock.fake<IWalletRegistry>("IWalletRegistry", {
    address: await (await bridge.contractReferences()).ecdsaWalletRegistry,
  })
  // Fund the `walletRegistry` account so it's possible to mock sending requests
  // from it.
  await deployer.sendTransaction({
    to: walletRegistry.address,
    value: ethers.utils.parseEther("100"),
  })

  const reimbursementPool: ReimbursementPool =
    await helpers.contracts.getContract("ReimbursementPool")

  const maintainerProxy: MaintainerProxy = await helpers.contracts.getContract(
    "MaintainerProxy"
  )

  const relay = await smock.fake<TestRelay>("TestRelay", {
    address: await (await bridge.contractReferences()).relay,
  })

  await bank.connect(governance).updateBridge(bridge.address)

  // Deploys a new instance of `Bridge` contract behind a proxy. Allows to
  // specify bridge type (e.g. `Bridge`, `BridgeStub`, `BridgeFraudStub`) and
  // `txProofDifficultyFactor`.
  //
  // Deployment scripts deploy `BridgeStub` for hardhat network. `BridgeStub`
  // may not be enough for all unit tests, so if another version is needed
  // (e.g. `BridgeFraudStub`), this function should be used to deploy the 
  // desired instance for tests.
  //
  // The new instance is deployed with a random name to do not conflict with the
  // main deployed instance.
  //
  // Same parameters as in `05_deploy_bridge.ts` deployment script are used.
  const deployBridge = async (
    bridgeType: string,
    txProofDifficultyFactor: number
  ) =>
    helpers.upgrades.deployProxy(`Bridge_${randomBytes(8).toString("hex")}`, {
      contractName: bridgeType,
      initializerArgs: [
        bank.address,
        relay.address,
        treasury.address,
        walletRegistry.address,
        txProofDifficultyFactor,
      ],
      factoryOpts: {
        signer: deployer,
        libraries: {
          Deposit: (await helpers.contracts.getContract("Deposit")).address,
          DepositSweep: (await helpers.contracts.getContract("DepositSweep"))
            .address,
          Redemption: (await helpers.contracts.getContract("Redemption"))
            .address,
          Wallets: (await helpers.contracts.getContract("Wallets")).address,
          Fraud: (await helpers.contracts.getContract("Fraud")).address,
          MovingFunds: (await helpers.contracts.getContract("MovingFunds"))
            .address,
        },
      },
      proxyOpts: {
        kind: "transparent",
        // Allow external libraries linking. We need to ensure manually that the
        // external  libraries we link are upgrade safe, as the OpenZeppelin plugin
        // doesn't perform such a validation yet.
        // See: https://docs.openzeppelin.com/upgrades-plugins/1.x/faq#why-cant-i-use-external-libraries
        unsafeAllow: ["external-library-linking"],
      },
    })

  return {
    deployer,
    governance,
    spvMaintainer,
    thirdParty,
    treasury,
    tbtc,
    vendingMachine,
    tbtcVault,
    bank,
    relay,
    walletRegistry,
    bridge,
    reimbursementPool,
    maintainerProxy,
    bridgeGovernance,
    deployBridge,
  }
}
