import {
  calculateDepositAddress,
  getRevealedDeposit,
  revealDeposit,
} from "./deposit"
import { submitDepositSweepProof } from "./deposit-sweep"
import {
  requestRedemption,
  submitRedemptionProof,
  getRedemptionRequest,
} from "./redemption"
import { Client as ElectrumClient } from "./electrum"
import { Bridge as EthereumBridge } from "./ethereum"

const TBTC = {
  calculateDepositAddress,
  revealDeposit,
  getRevealedDeposit,
  requestRedemption,
  getRedemptionRequest,
}

const SpvMaintainer = {
  submitDepositSweepProof,
  submitRedemptionProof,
}

export { TBTC, SpvMaintainer, ElectrumClient, EthereumBridge }
