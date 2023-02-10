import {
  SystemEvent,
  BaseReceiver as BaseSystemEventReceiver,
  SystemEventType
} from "./system-event"

export class SentryReceiver extends BaseSystemEventReceiver {
  constructor() {
    super()
    // TODO: Initialize receiver.
  }

  isSupportedSystemEvent(systemEvent: SystemEvent): boolean {
    return systemEvent.type === SystemEventType.Warning ||
      systemEvent.type === SystemEventType.Critical
  }

  async propagate(systemEvent: SystemEvent): Promise<void> {
    // TODO: Send to Sentry DSN. For now just print it.
    console.log(`system event ${systemEvent.title} (${JSON.stringify(systemEvent.data)}) propagated to Sentry`)
  }
}