import * as ff from "@google-cloud/functions-framework"
import {
  Monitor as SystemEventMonitor,
  Receiver as SystemEventReceiver,
  Manager as SystemEventManager
} from "./system-event"
import { DepositMonitor } from "./deposit-monitor"
import { contracts } from "./contracts"
import { DiscordReceiver } from "./discord-receiver"
import { SentryReceiver } from "./sentry-receiver"
import { GcsPersistence } from "./gcs-persistence";

const monitors: SystemEventMonitor[] = [
  new DepositMonitor(contracts.bridge)
]

const receivers: SystemEventReceiver[] = [
  new DiscordReceiver(),
  new SentryReceiver()
]

const persistence = new GcsPersistence()

const manager = new SystemEventManager(monitors, receivers, persistence)

ff.http('trigger', async (request: ff.Request, response: ff.Response) => {
  const report = await manager.trigger()

  switch (report.status) {
    case "success": {
      response.status(200).send(report)
      break
    }
    case "failure": {
      response.status(500).send(report)
      break
    }
  }
})