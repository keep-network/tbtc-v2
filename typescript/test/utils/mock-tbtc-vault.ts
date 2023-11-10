import {
  TBTCVault,
  OptimisticMintingCancelledEvent,
  OptimisticMintingFinalizedEvent,
  OptimisticMintingRequestedEvent,
  ChainIdentifier,
  GetChainEvents,
  OptimisticMintingRequest,
} from "../../src/lib/contracts"
import { BitcoinTxHash } from "../../src/lib/bitcoin"
import { Hex } from "../../src/lib/utils"
import { EthereumAddress } from "../../src"

export class MockTBTCVault implements TBTCVault {
  getOptimisticMintingCancelledEvents(
    options?: GetChainEvents.Options,
    ...filterArgs: Array<unknown>
  ): Promise<OptimisticMintingCancelledEvent[]> {
    throw new Error("not implemented")
  }

  getOptimisticMintingFinalizedEvents(
    options?: GetChainEvents.Options,
    ...filterArgs: Array<unknown>
  ): Promise<OptimisticMintingFinalizedEvent[]> {
    throw new Error("not implemented")
  }

  getOptimisticMintingRequestedEvents(
    options?: GetChainEvents.Options,
    ...filterArgs: Array<unknown>
  ): Promise<OptimisticMintingRequestedEvent[]> {
    throw new Error("not implemented")
  }

  cancelOptimisticMint(
    depositTxHash: BitcoinTxHash,
    depositOutputIndex: number
  ): Promise<Hex> {
    throw new Error("not implemented")
  }

  finalizeOptimisticMint(
    depositTxHash: BitcoinTxHash,
    depositOutputIndex: number
  ): Promise<Hex> {
    throw new Error("not implemented")
  }

  getChainIdentifier(): ChainIdentifier {
    return EthereumAddress.from("0x594cfd89700040163727828AE20B52099C58F02C")
  }

  getMinters(): Promise<ChainIdentifier[]> {
    throw new Error("not implemented")
  }

  isGuardian(identifier: ChainIdentifier): Promise<boolean> {
    throw new Error("not implemented")
  }

  isMinter(identifier: ChainIdentifier): Promise<boolean> {
    throw new Error("not implemented")
  }

  optimisticMintingDelay(): Promise<number> {
    throw new Error("not implemented")
  }

  optimisticMintingRequests(
    depositTxHash: BitcoinTxHash,
    depositOutputIndex: number
  ): Promise<OptimisticMintingRequest> {
    throw new Error("not implemented")
  }

  requestOptimisticMint(
    depositTxHash: BitcoinTxHash,
    depositOutputIndex: number
  ): Promise<Hex> {
    throw new Error("not implemented")
  }
}
