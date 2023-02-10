import { Storage as StorageClient, File } from "@google-cloud/storage"
import {
  Persistence as SystemEventPersistence,
  ReceiverId as SystemEventReceiverId,
  SystemEvent
} from "./system-event"
import {context} from "./context"

type Data = {
  checkpointBlock: number
  handledSystemEvents: Record<SystemEventReceiverId, SystemEvent[]>
}

export class GcsPersistence implements SystemEventPersistence {
  private file: File

  private readonly defaultValue: Data = {
    checkpointBlock: 0,
    handledSystemEvents: {}
  }

  constructor() {
    // Creates a client using Application Default Credentials.
    const storageClient = new StorageClient()
    const bucket = storageClient.bucket(context.gcsBucket)
    this.file = bucket.file("persistence.json")
  }

  private async read(): Promise<Data> {
    try {
      const contents = (await this.file.download())[0]
      return JSON.parse(contents.toString())
    } catch (error: any) {
      // Check for file not found case.
      if (error.code === 404) {
        await this.write(this.defaultValue)
        return this.defaultValue
      } else {
        throw error
      }
    }
  }

  private async write(data: Data): Promise<void> {
    const contents = JSON.stringify(data)
    await this.file.save(contents, {
      gzip: true,
      metadata: {
        contentType: 'application/json',
        cacheControl: 'no-cache',
      },
    })
  }

  async checkpointBlock(): Promise<number> {
    const { checkpointBlock } = await this.read()
    return checkpointBlock
  }

  async updateCheckpointBlock(block: number): Promise<void> {
    const data = await this.read()
    data.checkpointBlock = block
    await this.write(data)
  }

  async handledSystemEvents(): Promise<Record<string, SystemEvent[]>> {
    const { handledSystemEvents } = await this.read()
    return handledSystemEvents
  }

  // TODO: Consider deleting old events to optimize database file size.
  async storeHandledSystemEvents(systemEvents: Record<string, SystemEvent[]>): Promise<void> {
    const data = await this.read()

    Object.keys(systemEvents).forEach(receiverId => {
      data.handledSystemEvents[receiverId] = data.handledSystemEvents[receiverId] ?? []
      data.handledSystemEvents[receiverId].push(...systemEvents[receiverId])
    })

    await this.write(data)
  }
}