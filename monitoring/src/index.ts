import * as ff from '@google-cloud/functions-framework'
import {
  Monitor as IncidentMonitor,
  Receiver as IncidentReceiver,
  Manager as IncidentManager
} from "./incident"
import {DepositMonitor} from "./deposit-monitor"
import {contracts} from "./contracts"
import {DiscordReceiver} from "./discord-receiver"
import {SentryReceiver} from "./sentry-receiver"

const incidentMonitors: IncidentMonitor[] = [
  new DepositMonitor(contracts.Bridge)
]

const incidentReceivers: IncidentReceiver[] = [
  new DiscordReceiver(),
  new SentryReceiver()
]

const incidentManager = new IncidentManager(
  incidentMonitors,
  incidentReceivers
)

ff.http('check', async (request: ff.Request, response: ff.Response) => {
  try {
    const report = await incidentManager.check()
    response.status(200).send(report)
  } catch (error) {
    response.status(500).send(error)
  }
})