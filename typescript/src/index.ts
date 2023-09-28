// TODO: Consider exports refactoring as per discussion https://github.com/keep-network/tbtc-v2/pull/460#discussion_r1084530007

import { validateBitcoinSpvProof } from "./lib/bitcoin"

import { submitDepositSweepProof } from "./deposit-sweep"

import {
  requestRedemption,
  submitRedemptionProof,
  getRedemptionRequest,
  findWalletForRedemption,
} from "./redemption"

import {
  requestOptimisticMint,
  cancelOptimisticMint,
  finalizeOptimisticMint,
  getOptimisticMintingRequest,
} from "./optimistic-minting"

export const TBTC = {
  requestRedemption,
  getRedemptionRequest,
  findWalletForRedemption,
}

export const SpvMaintainer = {
  submitDepositSweepProof,
  submitRedemptionProof,
}

export const OptimisticMinting = {
  requestOptimisticMint,
  cancelOptimisticMint,
  finalizeOptimisticMint,
  getOptimisticMintingRequest,
}

export const Bitcoin = {
  validateBitcoinSpvProof,
}

export {
  BitcoinTxHash,
  BitcoinTx,
  BitcoinTxOutput,
  BitcoinLocktimeUtils,
  BitcoinNetwork,
} from "./lib/bitcoin"

export { ElectrumClient } from "./lib/electrum"

export {
  EthereumBridge,
  EthereumWalletRegistry,
  EthereumAddress,
  EthereumTBTCVault,
  EthereumTBTCToken,
} from "./lib/ethereum"

export { Hex } from "./lib/utils"

export {
  OptimisticMintingRequest,
  OptimisticMintingRequestedEvent,
} from "./lib/contracts"
