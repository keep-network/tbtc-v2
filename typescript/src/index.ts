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
import { Client as ElectrumClient } from "./electrum"
import { Bridge as EthereumBridge } from "./ethereum"
import { TBTCVault as EthereumTBTCVault } from "./ethereum"
import { requestOptimisticMint } from "./optimistic-minting"

const TBTC = {
  calculateDepositAddress,
  suggestDepositWallet,
  revealDeposit,
  getRevealedDeposit,
  requestRedemption,
  getRedemptionRequest,
  requestOptimisticMint,
}

const SpvMaintainer = {
  submitDepositSweepProof,
  submitRedemptionProof,
}

export {
  TBTC,
  SpvMaintainer,
  ElectrumClient,
  EthereumBridge,
  EthereumTBTCVault,
}
