import { TBTCContracts } from "../../src/lib/contracts"
import { MockBridge } from "./mock-bridge"
import { MockTBTCToken } from "./mock-tbtc-token"
import { MockTBTCVault } from "./mock-tbtc-vault"
import { MockWalletRegistry } from "./mock-wallet-registry"

export class MockTBTCContracts implements TBTCContracts {
  public readonly bridge: MockBridge
  public readonly tbtcToken: MockTBTCToken
  public readonly tbtcVault: MockTBTCVault
  public readonly walletRegistry: MockWalletRegistry

  constructor() {
    this.bridge = new MockBridge()
    this.tbtcToken = new MockTBTCToken()
    this.tbtcVault = new MockTBTCVault()
    this.walletRegistry = new MockWalletRegistry()
  }
}
