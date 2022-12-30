import { BigNumber } from "ethers"
import { TransactionHash } from "./bitcoin"
import { Identifier, Event } from "./chain"

export type OptimisticMintingRequestedEvent = {
  minter: Identifier
  depositKey: BigNumber
  depositor: Identifier
  amount: BigNumber
  fundingTxHash: TransactionHash
  fundingOutputIndex: number
} & Event

export type OptimisticMintingRequest = {
  requestedAt: number
  finalizedAt: number
}
