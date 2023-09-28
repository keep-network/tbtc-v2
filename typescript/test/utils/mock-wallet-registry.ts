import {
  GetChainEvents,
  WalletRegistry,
  DkgResultApprovedEvent,
  DkgResultChallengedEvent,
  DkgResultSubmittedEvent,
} from "../../src/lib/contracts"
import { Hex } from "../../src/lib/utils"

export class MockWalletRegistry implements WalletRegistry {
  getDkgResultApprovedEvents(
    options?: GetChainEvents.Options,
    ...filterArgs: Array<unknown>
  ): Promise<DkgResultApprovedEvent[]> {
    throw new Error("not implemented")
  }

  getDkgResultChallengedEvents(
    options?: GetChainEvents.Options,
    ...filterArgs: Array<unknown>
  ): Promise<DkgResultChallengedEvent[]> {
    throw new Error("not implemented")
  }

  getDkgResultSubmittedEvents(
    options?: GetChainEvents.Options,
    ...filterArgs: Array<unknown>
  ): Promise<DkgResultSubmittedEvent[]> {
    throw new Error("not implemented")
  }

  getWalletPublicKey(walletID: Hex): Promise<Hex> {
    throw new Error("not implemented")
  }
}
