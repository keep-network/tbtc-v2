import {
  SystemEvent,
  Receiver as SystemEventReceiver,
  SystemEventType
} from "./system-event"

export class SentryReceiver implements SystemEventReceiver {
  constructor() {
    // TODO: Initialize receiver.
  }

  async receive(systemEvent: SystemEvent): Promise<void> {
    if (!this.isSupportedType(systemEvent)) {
      return
    }

    // TODO: Send to Sentry DSN. For now just print it.
    console.log(`system event ${systemEvent.title} (${JSON.stringify(systemEvent.data)}) propagated to Sentry`)
  }

  private isSupportedType(systemEvent: SystemEvent) {
    return systemEvent.type === SystemEventType.Warning ||
      systemEvent.type === SystemEventType.Critical
  }
}