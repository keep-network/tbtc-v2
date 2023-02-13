import axios from "axios"

import {
  BaseReceiver as BaseSystemEventReceiver,
  SystemEventType,
} from "./system-event"

import type {
  SystemEvent,
  ReceiverId as SystemEventReceiverId,
} from "./system-event"

export class DiscordReceiver extends BaseSystemEventReceiver {
  private readonly webhookUrl: string

  constructor(webhookUrl: string) {
    super()
    this.webhookUrl = webhookUrl
  }

  id(): SystemEventReceiverId {
    return "Discord"
  }

  isSupportedSystemEvent(systemEvent: SystemEvent): boolean {
    return systemEvent.type === SystemEventType.Informational
  }

  async handle(systemEvent: SystemEvent): Promise<void> {
    const fields = Object.entries(systemEvent.data).map((entry) => ({
      name: entry[0],
      value: entry[1],
    }))

    fields.push({ name: "block", value: `${systemEvent.block}` })

    const discordEmbeds = [
      {
        title: systemEvent.title,
        color: 0x003399, // Blue as everything is informational.
        fields,
      },
    ]

    await axios.post(
      this.webhookUrl,
      { embeds: discordEmbeds },
      {
        headers: { "Content-Type": "application/json" },
      }
    )
  }
}
