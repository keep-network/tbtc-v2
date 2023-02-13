import { Manager as SystemEventManager } from "./system-event"
import { DepositMonitor } from "./deposit-monitor"
import { contracts } from "./contracts"
import { DiscordReceiver } from "./discord-receiver"
import { SentryReceiver } from "./sentry-receiver"
import { FilePersistence } from "./file-persistence"

import type {
  Monitor as SystemEventMonitor,
  Receiver as SystemEventReceiver,
} from "./system-event"

const monitors: SystemEventMonitor[] = [new DepositMonitor(contracts.bridge)]

const receivers: SystemEventReceiver[] = [
  new DiscordReceiver(),
  new SentryReceiver(),
]

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
