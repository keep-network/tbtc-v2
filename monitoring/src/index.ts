import { ElectrumClient } from "@keep-network/tbtc-v2.ts"

import { Manager as SystemEventManager } from "./system-event"
import { DepositMonitor } from "./deposit-monitor"
import { contracts } from "./contracts"
import { DiscordReceiver } from "./discord-receiver"
import { SentryReceiver } from "./sentry-receiver"
import { FilePersistence } from "./file-persistence"
import { context } from "./context"
import { MintingMonitor } from "./minting-monitor"
import { WalletMonitor } from "./wallet-monitor"
import { SupplyMonitor } from "./supply-monitor"

import type { Client as BitcoinClient } from "@keep-network/tbtc-v2.ts/dist/src/bitcoin"
import type {
  Monitor as SystemEventMonitor,
  Receiver as SystemEventReceiver,
} from "./system-event"

const btcClient: BitcoinClient = ElectrumClient.fromUrl(context.electrumUrl)

const monitors: SystemEventMonitor[] = [
  new DepositMonitor(contracts.bridge),
  new MintingMonitor(contracts.bridge, contracts.tbtcVault, btcClient),
  new SupplyMonitor(contracts.tbtcToken),
  new WalletMonitor(contracts.bridge),
]

const receivers: SystemEventReceiver[] = ((): SystemEventReceiver[] => {
  const registered: SystemEventReceiver[] = []

  if (context.discordWebhookUrl) {
    console.log("registered Discord receiver")
    registered.push(new DiscordReceiver(context.discordWebhookUrl))
  }

  if (context.sentryDsn) {
    console.log("registered Sentry receiver")
    registered.push(new SentryReceiver(context.sentryDsn))
  }

  return registered
})()

const persistence = new FilePersistence()

const manager = new SystemEventManager(monitors, receivers, persistence)

manager.trigger().then((report) => {
  switch (report.status) {
    case "success": {
      console.log(report)
      break
    }
    case "failure": {
      console.error(report)
      break
    }
  }
})
