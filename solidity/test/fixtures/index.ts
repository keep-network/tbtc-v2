import { to1ePrecision } from "../helpers/contract-test-helpers"

export const constants = {
  unmintFee: to1ePrecision(1, 15), // 0.001
  depositDustThreshold: 1000000, // 1000000 satoshi = 0.01 BTC
  depositTreasuryFeeDivisor: 2000, // 1/2000 == 5bps == 0.05% == 0.0005
  depositTxMaxFee: 10000, // 10000 satoshi
  redemptionDustThreshold: 1000000, // 1000000 satoshi = 0.01 BTC
  redemptionTreasuryFeeDivisor: 2000, // 1/2000 == 5bps == 0.05% == 0.0005
  redemptionTxMaxFee: 10000, // 10000 satoshi
  redemptionTimeout: 172800, // 48 hours
  redemptionTimeoutSlashingAmount: to1ePrecision(10000, 18), // 10000 T
  redemptionTimeoutNotifierRewardMultiplier: 100, // 100%
  movingFundsTxMaxTotalFee: 10000, // 10000 satoshi
  movingFundsTimeout: 604800, // 1 week
  movingFundsTimeoutSlashingAmount: to1ePrecision(10000, 18), // 10000 T
  movingFundsTimeoutNotifierRewardMultiplier: 100, // 100%
  movingFundsDustThreshold: 20000, // 20000 satoshi
  movedFundsMergeTxMaxTotalFee: 10000, // 10000 satoshi
  walletCreationPeriod: 604800, // 1 week
  walletCreationMinBtcBalance: to1ePrecision(1, 8), // 1 BTC
  walletCreationMaxBtcBalance: to1ePrecision(100, 8), // 100 BTC
  walletClosureMinBtcBalance: to1ePrecision(5, 7), // 0.5 BTC
  walletMaxAge: 8 * 604800, // 8 weeks,
  walletMaxBtcTransfer: to1ePrecision(10, 8), // 10 BTC
  walletClosingPeriod: 3456000, // 40 days
  fraudSlashingAmount: to1ePrecision(10000, 18), // 10000 T
  fraudNotifierRewardMultiplier: 100, // 100%
  fraudChallengeDefeatTimeout: 604800, // 1 week
  fraudChallengeDepositAmount: to1ePrecision(2, 18), // 2 ethers
}

export const walletState = {
  Unknown: 0,
  Live: 1,
  MovingFunds: 2,
  Closing: 3,
  Closed: 4,
  Terminated: 5,
}

export const ecdsaDkgState = {
  IDLE: 0,
  AWAITING_SEED: 1,
  AWAITING_RESULT: 2,
  CHALLENGE: 3,
}
