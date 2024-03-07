export * from "./bridge"
export * from "./chain-event"
export * from "./chain-identifier"
export * from "./depositor-proxy"
export * from "./tbtc-token"
export * from "./tbtc-vault"
export * from "./wallet-registry"

import { Bridge } from "./bridge"
import { TBTCToken } from "./tbtc-token"
import { TBTCVault } from "./tbtc-vault"
import { WalletRegistry } from "./wallet-registry"

/**
 * Convenience type aggregating all TBTC contracts handles.
 */
export type TBTCContracts = {
  bridge: Bridge
  tbtcToken: TBTCToken
  tbtcVault: TBTCVault
  walletRegistry: WalletRegistry
}
