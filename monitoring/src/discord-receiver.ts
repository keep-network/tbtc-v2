import {
  SystemEvent,
  Receiver as SystemEventReceiver,
  SystemEventType
} from "./system-event"

export class DiscordReceiver implements SystemEventReceiver {
  constructor() {
    // TODO: Initialize receiver.
  }

  async receive(systemEvent: SystemEvent): Promise<void> {
    if (!this.isSupportedType(systemEvent)) {
      return
    }

    // TODO: Send to Discord webhook. For now just print it.
    console.log(`system event ${systemEvent.title} (${JSON.stringify(systemEvent.data)}) propagated to Discord`)
  }

  private isSupportedType(systemEvent: SystemEvent) {
    return systemEvent.type === SystemEventType.Informational
  }
}