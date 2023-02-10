import {
  SystemEvent,
  BaseReceiver as BaseSystemEventReceiver,
  SystemEventType,
  ReceiverId as SystemEventReceiverId
} from "./system-event"

export class SentryReceiver extends BaseSystemEventReceiver {
  constructor() {
    super()
    // TODO: Initialize receiver.
  }

  id(): SystemEventReceiverId {
    return "Sentry"
  }

  isSupportedSystemEvent(systemEvent: SystemEvent): boolean {
    return systemEvent.type === SystemEventType.Warning ||
      systemEvent.type === SystemEventType.Critical
  }

  async handle(systemEvent: SystemEvent): Promise<void> {
    // TODO: Send to Sentry DSN. For now just print it.
    console.log(`system event ${systemEvent.title} (${JSON.stringify(systemEvent.data)}) propagated to Sentry`)
  }
}