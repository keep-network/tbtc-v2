import { ethers, helpers, waffle } from "hardhat"
import chai from "chai"
import {
  BigNumber,
  ContractTransaction,
  BytesLike,
  Signer,
  BigNumberish,
} from "ethers"
import { SignerWithAddress } from "@nomiclabs/hardhat-ethers/signers"
import type { FakeContract } from "@defi-wonderland/smock"
import { smock } from "@defi-wonderland/smock"
import { testConfig } from "../../../hardhat.config"
import type {
  Bridge,
  BridgeStub,
  IRandomBeacon,
  WalletRegistry,
  SortitionPool,
  T,
  TokenStaking,
} from "../../../typechain"

chai.use(smock.matchers)

const { provider } = waffle
const { keccak256 } = ethers.utils
const { mineBlocks } = helpers.time
const { to1e18 } = helpers.number

export const constants = {
  groupSize: 100,
  groupThreshold: 51,
  poolWeightDivisor: to1e18(1),
  tokenStakingNotificationReward: to1e18(10000), // 10k T
  governanceDelay: 604800, // 1 week
}

export const DKG_RESULT_PARAMS_SIGNATURE =
  "(uint256 submitterMemberIndex, bytes groupPubKey, uint8[] misbehavedMembersIndices, bytes signatures, uint256[] signingMembersIndices, uint32[] members, bytes32 membersHash)"

export const NO_MAIN_UTXO = {
  txHash: "0x0000000000000000000000000000000000000000000000000000000000000000",
  txOutputIndex: 0,
  txOutputValue: 0,
}

export const ecdsaData = {
  group1: {
    // ecdsa private key
    privateKey:
      "0x937ffe93cfc943d1a8fc0cb8bad44a978090a4623da81eefdff5380d0a290b41",

    // ecdsa public key
    publicKey:
      "0x9a0544440cc47779235ccb76d669590c2cd20c7e431f97e17a1093faf03291c473e661a208a8a565ca1e384059bd2ff7ff6886df081ff1229250099d388c83df",
    publicKeyX:
      "0x9a0544440cc47779235ccb76d669590c2cd20c7e431f97e17a1093faf03291c4",
    publicKeyY:
      "0x73e661a208a8a565ca1e384059bd2ff7ff6886df081ff1229250099d388c83df",

    // digest to sign
    digest1:
      "0x8bacaa8f02ef807f2f61ae8e00a5bfa4528148e0ae73b2bd54b71b8abe61268e",

    // group signature over `digest`
    signature1: {
      r: "0xedc074a86380cc7e2e4702eaf1bec87843bc0eb7ebd490f5bdd7f02493149170",
      s: "0x3f5005a26eb6f065ea9faea543e5ddb657d13892db2656499a43dfebd6e12efc",
      v: 28,
    },
  },
  group2: {
    // ecdsa private key
    privateKey:
      "0x212bd2787dd6b0b9064f0341ff279aaa08eab74077f4b8c5ece576d256b01514",

    // ecdsa public key
    publicKey:
      "0xadba3062ac8cd30319b03c88637fb8c20c868905fad7c86faf3b28791212e8854bc55fecc3a40a1fbd5213de0993604e79a99e234d2cef0b33523e63383574c2",
    publicKeyX:
      "0xadba3062ac8cd30319b03c88637fb8c20c868905fad7c86faf3b28791212e885",
    publicKeyY:
      "0x4bc55fecc3a40a1fbd5213de0993604e79a99e234d2cef0b33523e63383574c2",

    // digest to sign
    digest1: "",

    // group signature over `digest`
    signature1: "",
  },
}

export type OperatorID = number
export type Operator = {
  id: OperatorID
  signer: SignerWithAddress
}

export interface DkgResult {
  submitterMemberIndex: number
  groupPubKey: BytesLike
  misbehavedMembersIndices: number[]
  signatures: string
  signingMembersIndices: number[]
  members: number[]
  membersHash: string
}

export const noMisbehaved: number[] = []

export const params = {
  minimumAuthorization: to1e18(40000),
  authorizationDecreaseDelay: 3888000,
  authorizationDecreaseChangePeriod: 3888000,
  dkgSeedTimeout: 8,
  dkgResultChallengePeriodLength: 10,
  dkgResultSubmissionTimeout: 30,
  dkgSubmitterPrecedencePeriodLength: 5,
  sortitionPoolRewardsBanDuration: 1209600, // 14 days
}

// eslint-disable-next-line import/prefer-default-export
export async function createNewWallet(
  walletRegistry: WalletRegistry,
  bridge: Bridge & BridgeStub,
  publicKey: BytesLike = ecdsaData.group1.publicKey
): Promise<{
  members: Operator[]
  dkgResult: DkgResult
  walletID: string
  tx: ContractTransaction
}> {
  const requestNewWalletTx = await bridge.requestNewWallet(NO_MAIN_UTXO)

  const randomBeacon = await fakeRandomBeacon(walletRegistry)

  const relayEntry = ethers.utils.randomBytes(32)

  const dkgSeed = ethers.BigNumber.from(keccak256(relayEntry))

  // eslint-disable-next-line no-underscore-dangle
  await walletRegistry
    .connect(randomBeacon.wallet)
    .__beaconCallback(relayEntry, 0)

  const {
    dkgResult,
    submitter,
    signers: members,
  } = await signAndSubmitCorrectDkgResult(
    walletRegistry,
    publicKey,
    dkgSeed,
    requestNewWalletTx.blockNumber,
    noMisbehaved
  )

  await mineBlocks(params.dkgResultChallengePeriodLength)

  const approveDkgResultTx = await walletRegistry
    .connect(submitter)
    .approveDkgResult(dkgResult)

  return {
    members,
    dkgResult,
    walletID: keccak256(publicKey),
    tx: approveDkgResultTx,
  }
}

export async function fakeRandomBeacon(
  walletRegistry: WalletRegistry
): Promise<FakeContract<IRandomBeacon>> {
  const randomBeacon = await smock.fake<IRandomBeacon>("IRandomBeacon", {
    address: await walletRegistry.callStatic.randomBeacon(),
  })

  await (
    await ethers.getSigners()
  )[0].sendTransaction({
    to: randomBeacon.address,
    value: ethers.utils.parseEther("1000"),
  })

  return randomBeacon
}

// Sign and submit a correct DKG result which cannot be challenged because used
// signers belong to an actual group selected by the sortition pool for given
// seed.
export async function signAndSubmitCorrectDkgResult(
  walletRegistry: WalletRegistry,
  groupPublicKey: BytesLike,
  seed: BigNumber,
  startBlock: number,
  misbehavedIndices = noMisbehaved,
  submitterIndex = 1,
  numberOfSignatures = 51
): Promise<{
  signers: Operator[]
  dkgResult: DkgResult
  dkgResultHash: string
  submitter: SignerWithAddress
  submitterInitialBalance: BigNumber
  transaction: ContractTransaction
}> {
  const sortitionPool = (await ethers.getContractAt(
    "SortitionPool",
    await walletRegistry.sortitionPool()
  )) as SortitionPool

  const signers = await selectGroup(sortitionPool, seed)

  return {
    signers,
    ...(await signAndSubmitArbitraryDkgResult(
      walletRegistry,
      groupPublicKey,
      signers,
      startBlock,
      misbehavedIndices,
      submitterIndex,
      numberOfSignatures
    )),
  }
}

// Sign and submit an arbitrary DKG result using given signers. Signers don't
// need to be part of the actual sortition pool group. This function is useful
// for preparing invalid or malicious results for testing purposes.
export async function signAndSubmitArbitraryDkgResult(
  walletRegistry: WalletRegistry,
  groupPublicKey: BytesLike,
  signers: Operator[],
  startBlock: number,
  misbehavedIndices: number[],
  submitterIndex = 1,
  numberOfSignatures = 51
): Promise<{
  dkgResult: DkgResult
  dkgResultHash: string
  submitter: SignerWithAddress
  submitterInitialBalance: BigNumber
  transaction: ContractTransaction
}> {
  const { dkgResult } = await signDkgResult(
    signers,
    groupPublicKey,
    misbehavedIndices,
    startBlock,
    submitterIndex,
    numberOfSignatures
  )

  const dkgResultHash = ethers.utils.keccak256(
    ethers.utils.defaultAbiCoder.encode(
      [DKG_RESULT_PARAMS_SIGNATURE],
      [dkgResult]
    )
  )

  const submitter = signers[submitterIndex - 1].signer
  const submitterInitialBalance = await provider.getBalance(
    await submitter.getAddress()
  )

  return {
    dkgResult,
    dkgResultHash,
    submitter,
    submitterInitialBalance,
    ...(await submitDkgResult(walletRegistry, dkgResult, submitter)),
  }
}

export async function signDkgResult(
  signers: Operator[],
  groupPublicKey: BytesLike,
  misbehavedMembersIndices: number[],
  startBlock: number,
  submitterIndex = 1,
  numberOfSignatures = 51
): Promise<{
  dkgResult: DkgResult
  signingMembersIndices: number[]
  signaturesBytes: string
}> {
  const resultHash = ethers.utils.solidityKeccak256(
    ["bytes", "uint8[]", "uint256"],
    [groupPublicKey, misbehavedMembersIndices, startBlock]
  )

  const members: number[] = []
  const signingMembersIndices: number[] = []
  const signatures: string[] = []
  for (let i = 0; i < signers.length; i++) {
    const { id, signer: ethersSigner } = signers[i]
    members.push(id)

    if (signatures.length === numberOfSignatures) {
      // eslint-disable-next-line no-continue
      continue
    }

    const signerIndex: number = i + 1

    signingMembersIndices.push(signerIndex)

    const signature = await ethersSigner.signMessage(
      ethers.utils.arrayify(resultHash)
    )

    signatures.push(signature)
  }

  const signaturesBytes: string = ethers.utils.hexConcat(signatures)

  const dkgResult: DkgResult = {
    submitterMemberIndex: submitterIndex,
    groupPubKey: groupPublicKey,
    misbehavedMembersIndices,
    signatures: signaturesBytes,
    signingMembersIndices,
    members,
    membersHash: hashDKGMembers(members, misbehavedMembersIndices),
  }

  return { dkgResult, signingMembersIndices, signaturesBytes }
}

// Creates a members hash that actively participated in dkg
export function hashDKGMembers(
  members: number[],
  misbehavedMembersIndices?: number[]
): string {
  if (misbehavedMembersIndices && misbehavedMembersIndices.length > 0) {
    const activeDkgMembers = [...members]
    for (let i = 0; i < misbehavedMembersIndices.length; i++) {
      if (misbehavedMembersIndices[i] !== 0) {
        activeDkgMembers.splice(misbehavedMembersIndices[i] - i - 1, 1)
      }
    }

    return ethers.utils.keccak256(
      ethers.utils.defaultAbiCoder.encode(["uint32[]"], [activeDkgMembers])
    )
  }

  return ethers.utils.keccak256(
    ethers.utils.defaultAbiCoder.encode(["uint32[]"], [members])
  )
}

export async function selectGroup(
  sortitionPool: SortitionPool,
  seed: BigNumber
): Promise<Operator[]> {
  const identifiers = await sortitionPool.selectGroup(
    constants.groupSize,
    ethers.utils.hexZeroPad(seed.toHexString(), 32)
  )

  const addresses = await sortitionPool.getIDOperators(identifiers)

  return Promise.all(
    identifiers.map(
      async (identifier, i): Promise<Operator> => ({
        id: identifier,
        signer: await ethers.getSigner(addresses[i]),
      })
    )
  )
}

export async function submitDkgResult(
  walletRegistry: WalletRegistry,
  dkgResult: DkgResult,
  submitter: SignerWithAddress
): Promise<{
  transaction: ContractTransaction
}> {
  const transaction = await walletRegistry
    .connect(submitter)
    .submitDkgResult(dkgResult)

  return { transaction }
}

export async function registerOperators(
  walletRegistry: WalletRegistry,
  t: T,
  numberOfOperators = testConfig.operatorsCount,
  unnamedSignersOffset = testConfig.nonStakingAccountsCount,
  stakeAmount: BigNumber = params.minimumAuthorization
): Promise<Operator[]> {
  const operators: Operator[] = []

  const sortitionPool: SortitionPool = await ethers.getContractAt(
    "SortitionPool",
    await walletRegistry.sortitionPool()
  )

  const staking: TokenStaking = await ethers.getContractAt(
    "TokenStaking",
    await walletRegistry.staking()
  )

  const signers = (await ethers.getUnnamedSigners()).slice(unnamedSignersOffset)

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
      walletRegistry,
      owner,
      stakingProvider,
      stakeAmount,
      beneficiary,
      authorizer
    )

    await walletRegistry
      .connect(stakingProvider)
      .registerOperator(operator.address)

    await walletRegistry.connect(operator).joinSortitionPool()

    const id = await sortitionPool.getOperatorID(operator.address)

    operators.push({ id, signer: operator })
  }

  return operators
}

export async function stake(
  t: T,
  staking: TokenStaking,
  randomBeacon: WalletRegistry,
  owner: SignerWithAddress,
  stakingProvider: SignerWithAddress,
  stakeAmount: BigNumberish,
  beneficiary = stakingProvider,
  authorizer = stakingProvider
): Promise<void> {
  const deployer: SignerWithAddress = await ethers.getNamedSigner("deployer")

  await t.connect(deployer).mint(owner.address, stakeAmount)
  await t.connect(owner).approve(staking.address, stakeAmount)

  await staking
    .connect(owner)
    .stake(
      stakingProvider.address,
      beneficiary.address,
      authorizer.address,
      stakeAmount
    )

  await staking
    .connect(authorizer)
    .increaseAuthorization(
      stakingProvider.address,
      randomBeacon.address,
      stakeAmount
    )
}
