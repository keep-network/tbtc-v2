import { deployments, ethers, helpers } from "hardhat"
import { smock } from "@defi-wonderland/smock"
import type { SignerWithAddress } from "@nomiclabs/hardhat-ethers/signers"
import type {
  Bank,
  BankStub,
  Bridge,
  BridgeStub,
  IWalletRegistry,
  BridgeStub__factory,
  TestRelay,
  T,
  TokenStaking,
  WalletRegistry,
  WalletRegistryGovernance,
  ReimbursementPool,
} from "../../typechain"
import {
  Operator,
  registerOperators,
  constants,
  params,
} from "../integration/helpers/contract-test-helpers"

/**
 * Common fixture for tests suites targeting the Bridge contract.
 */
export default async function bridgeFullDeploymentFixture() {
  await deployments.fixture()

  const { deployer, governance, treasury } = await ethers.getNamedSigners()
  const [thirdParty] = await ethers.getUnnamedSigners()

  const bank: Bank & BankStub = await ethers.getContract("Bank")

  const bridge: Bridge & BridgeStub = await ethers.getContract("Bridge")

  const tToken: T = await ethers.getContract("T")
  const staking: TokenStaking = await ethers.getContract("TokenStaking")

  const reimbursementPool: ReimbursementPool = await ethers.getContract(
    "ReimbursementPool"
  )

  const walletRegistry: WalletRegistry = await ethers.getContract(
    "WalletRegistry"
  )
  const walletRegistryGovernance: WalletRegistryGovernance =
    await ethers.getContract("WalletRegistryGovernance")

  await walletRegistryGovernance
    .connect(governance)
    .initializeWalletOwner(bridge.address)

  const relay = await smock.fake<TestRelay>("TestRelay", {
    address: (await bridge.contractReferences()).relay,
  })

  await bank.connect(governance).updateBridge(bridge.address)

  // Accounts offset provided to slice getUnnamedAccounts have to include number
  // of unnamed accounts that were already used.
  const unnamedAccountsOffset = 1
  const operators: Operator[] = await registerOperators(
    walletRegistry,
    tToken,
    constants.groupSize,
    unnamedAccountsOffset
  )

  // Set up TokenStaking parameters
  await updateTokenStakingParams(tToken, staking, deployer)

  // Set parameters with tweaked values to reduce test execution time.
  await updateWalletRegistryParams(walletRegistryGovernance, governance)

  await fundReimbursementPool(deployer, reimbursementPool)

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
    deployer,
    thirdParty,
    treasury,
    bank,
    relay,
    walletRegistry,
    bridge,
    BridgeFactory,
  }
}

async function updateTokenStakingParams(
  tToken: T,
  staking: TokenStaking,
  deployer: SignerWithAddress
) {
  const initialNotifierTreasury = constants.tokenStakingNotificationReward.mul(
    constants.groupSize
  )
  await tToken
    .connect(deployer)
    .approve(staking.address, initialNotifierTreasury)
  await staking
    .connect(deployer)
    .pushNotificationReward(initialNotifierTreasury)
  await staking
    .connect(deployer)
    .setNotificationReward(constants.tokenStakingNotificationReward)
}

export async function updateWalletRegistryParams(
  walletRegistryGovernance: WalletRegistryGovernance,
  governance: SignerWithAddress
): Promise<void> {
  await walletRegistryGovernance
    .connect(governance)
    .beginMinimumAuthorizationUpdate(params.minimumAuthorization)

  await walletRegistryGovernance
    .connect(governance)
    .beginAuthorizationDecreaseDelayUpdate(params.authorizationDecreaseDelay)

  // await walletRegistryGovernance
  //   .connect(governance)
  //   .beginAuthorizationDecreaseChangePeriodUpdate(
  //     params.authorizationDecreaseChangePeriod
  //   )

  await walletRegistryGovernance
    .connect(governance)
    .beginDkgSeedTimeoutUpdate(params.dkgSeedTimeout)

  await walletRegistryGovernance
    .connect(governance)
    .beginDkgResultChallengePeriodLengthUpdate(
      params.dkgResultChallengePeriodLength
    )

  await walletRegistryGovernance
    .connect(governance)
    .beginDkgResultSubmissionTimeoutUpdate(params.dkgResultSubmissionTimeout)

  await walletRegistryGovernance
    .connect(governance)
    .beginDkgSubmitterPrecedencePeriodLengthUpdate(
      params.dkgSubmitterPrecedencePeriodLength
    )

  await walletRegistryGovernance
    .connect(governance)
    .beginSortitionPoolRewardsBanDurationUpdate(
      params.sortitionPoolRewardsBanDuration
    )

  await helpers.time.increaseTime(constants.governanceDelay)

  await walletRegistryGovernance
    .connect(governance)
    .finalizeMinimumAuthorizationUpdate()

  await walletRegistryGovernance
    .connect(governance)
    .finalizeAuthorizationDecreaseDelayUpdate()

  // await walletRegistryGovernance
  //   .connect(governance)
  //   .finalizeAuthorizationDecreaseChangePeriodUpdate()

  await walletRegistryGovernance
    .connect(governance)
    .finalizeDkgSeedTimeoutUpdate()

  await walletRegistryGovernance
    .connect(governance)
    .finalizeDkgResultChallengePeriodLengthUpdate()

  await walletRegistryGovernance
    .connect(governance)
    .finalizeDkgResultSubmissionTimeoutUpdate()

  await walletRegistryGovernance
    .connect(governance)
    .finalizeDkgSubmitterPrecedencePeriodLengthUpdate()

  await walletRegistryGovernance
    .connect(governance)
    .finalizeSortitionPoolRewardsBanDurationUpdate()
}

async function fundReimbursementPool(
  deployer: SignerWithAddress,
  reimbursementPool: ReimbursementPool
) {
  await deployer.sendTransaction({
    to: reimbursementPool.address,
    value: ethers.utils.parseEther("100.0"), // Send 100.0 ETH
  })
}
