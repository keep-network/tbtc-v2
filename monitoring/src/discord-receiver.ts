import {
  SystemEvent,
  BaseReceiver as BaseSystemEventReceiver,
  SystemEventType,
} from "./system-event"

export class DiscordReceiver extends BaseSystemEventReceiver {
  constructor() {
    super()
    // TODO: Initialize receiver.
  }

  isSupportedSystemEvent(systemEvent: SystemEvent): boolean {
    return systemEvent.type === SystemEventType.Informational
  }

  async propagate(systemEvent: SystemEvent): Promise<void> {
    // TODO: Send to Discord webhook. For now just print it.
    console.log(`system event ${systemEvent.title} (${JSON.stringify(systemEvent.data)}) propagated to Discord`)
  }
}