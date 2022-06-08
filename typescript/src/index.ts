import { calculateDepositAddress, revealDeposit } from "./deposit"
import { submitDepositSweepProof } from "./deposit-sweep"
import { requestRedemption, submitRedemptionProof } from "./redemption"
import { Client as ElectrumClient } from "./electrum"
import { Bridge as EthereumBridge } from "./ethereum"

const TBTC = {
  calculateDepositAddress,
  revealDeposit,
  requestRedemption,
}

const SpvMaintainer = {
  submitDepositSweepProof,
  submitRedemptionProof,
}

export { TBTC, SpvMaintainer, ElectrumClient, EthereumBridge }
