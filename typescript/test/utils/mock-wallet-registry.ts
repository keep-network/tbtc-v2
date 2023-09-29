import {
  GetChainEvents,
  WalletRegistry,
  DkgResultApprovedEvent,
  DkgResultChallengedEvent,
  DkgResultSubmittedEvent,
  ChainIdentifier,
} from "../../src/lib/contracts"
import { Hex } from "../../src/lib/utils"
import { EthereumAddress } from "../../src"

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

  getChainIdentifier(): ChainIdentifier {
    return EthereumAddress.from("0x794cfd89700040163727828AE20B52099C58F02C")
  }
}
