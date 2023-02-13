import { Config, JsonDB } from "node-json-db"

import { context } from "./context"

import type {
  Persistence as SystemEventPersistence,
  ReceiverId as SystemEventReceiverId,
  SystemEvent,
} from "./system-event"

const checkpointBlockPath = "/checkpointBlock"
const handledSystemEventsPath = "/handledSystemEvents"

export class FilePersistence implements SystemEventPersistence {
  private db: JsonDB

  constructor() {
    this.db = new JsonDB(
      new Config(`${context.dataDirPath}/db.json`, true, true, "/")
    )
  }

  async checkpointBlock(): Promise<number> {
    if (!(await this.db.exists(checkpointBlockPath))) {
      return 0
    }

    return this.db.getObject<number>(checkpointBlockPath)
  }

  async updateCheckpointBlock(block: number): Promise<void> {
    await this.db.push(checkpointBlockPath, block)
  }

  async handledSystemEvents(): Promise<
    Record<SystemEventReceiverId, SystemEvent[]>
  > {
    if (!(await this.db.exists(handledSystemEventsPath))) {
      return {}
    }

    return this.db.getObject<Record<SystemEventReceiverId, SystemEvent[]>>(
      handledSystemEventsPath
    )
  }

  // TODO: Consider deleting old events to optimize database file size.
  async storeHandledSystemEvents(
    systemEvents: Record<SystemEventReceiverId, SystemEvent[]>
  ): Promise<void> {
    const handledSystemEvents = await this.handledSystemEvents()

    Object.keys(systemEvents).forEach((receiverId) => {
      handledSystemEvents[receiverId] = handledSystemEvents[receiverId] ?? []
      handledSystemEvents[receiverId].push(...systemEvents[receiverId])
    })

    await this.db.push(handledSystemEventsPath, handledSystemEvents)
  }
}
