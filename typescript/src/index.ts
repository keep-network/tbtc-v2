import * as Bitcoin from "./bitcoin"
import {
  calculateDepositAddress,
  getRevealedDeposit,
  revealDeposit,
  suggestDepositWallet,
} from "./deposit"
import { submitDepositSweepProof } from "./deposit-sweep"
import {
  requestRedemption,
  submitRedemptionProof,
  getRedemptionRequest,
} from "./redemption"
import * as OptimisticMinting from "./optimistic-minting"
import { Client as ElectrumClient } from "./electrum"
import { Bridge as EthereumBridge } from "./ethereum"
import * as Ethereum from "./ethereum"
import { TBTCVault as EthereumTBTCVault } from "./ethereum"

const TBTC = {
  calculateDepositAddress,
  suggestDepositWallet,
  revealDeposit,
  getRevealedDeposit,
  requestRedemption,
  getRedemptionRequest,
}

const SpvMaintainer = {
  submitDepositSweepProof,
  submitRedemptionProof,
}

export {
  Bitcoin,
  TBTC,
  SpvMaintainer,
  OptimisticMinting,
  ElectrumClient,
  Ethereum,
  EthereumBridge,
  EthereumTBTCVault,
}
