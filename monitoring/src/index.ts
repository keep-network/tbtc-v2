import * as ff from '@google-cloud/functions-framework'
import {
  Monitor as SystemEventMonitor,
  Receiver as SystemEventReceiver,
  Manager as SystemEventManager
} from "./system-event"
import {DepositMonitor} from "./deposit-monitor"
import {contracts} from "./contracts"
import {DiscordReceiver} from "./discord-receiver"
import {SentryReceiver} from "./sentry-receiver"

const monitors: SystemEventMonitor[] = [
  new DepositMonitor(contracts.Bridge)
]

const receivers: SystemEventReceiver[] = [
  new DiscordReceiver(),
  new SentryReceiver()
]

const manager = new SystemEventManager(monitors, receivers)

ff.http('check', async (request: ff.Request, response: ff.Response) => {
  try {
    // TODO: Manage the block span. Current values are for test purposes.
    const report = await manager.check(16582233, 16582233)
    response.status(200).send(report)
  } catch (error) {
    response.status(500).send(error)
  }
})