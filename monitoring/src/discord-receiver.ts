import {
  SystemEvent,
  Receiver as SystemEventReceiver,
  SystemEventType
} from "./system-event"

export class DiscordReceiver implements SystemEventReceiver {
  private systemEventFilter = (systemEvent: SystemEvent) => {
    return systemEvent.type === SystemEventType.Informational
  }

  constructor() {
    // TODO: Initialize receiver.
  }

  async receive(systemEvents: SystemEvent[]): Promise<void> {
    const results = await Promise.allSettled(
      systemEvents.filter(this.systemEventFilter).map(this.propagate)
    )

    const errors = results
      .filter(result => result.status === "rejected")
      .map(result => `${(result as PromiseRejectedResult).reason}`)

    if (errors.length !== 0) {
      throw new Error(`Discord propagation errors: ${errors.join(",")}`)
    }
  }

  private async propagate(systemEvent: SystemEvent): Promise<void> {
    // TODO: Send to Discord webhook. For now just print it.
    console.log(`system event ${systemEvent.title} (${JSON.stringify(systemEvent.data)}) propagated to Discord`)
  }
}