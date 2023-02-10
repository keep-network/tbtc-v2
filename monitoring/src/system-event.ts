import { contracts } from "./contracts";

export enum SystemEventType {
  Informational = "informational",
  Warning = "warning",
  Critical = "critical",
}

export interface SystemEvent {
  title: string
  type: SystemEventType
  data: Record<string, string>
}

export interface Monitor {
  check: (fromBlock: number, toBlock: number) => Promise<SystemEvent[]>
}

export interface Receiver {
  receive: (systemEvent: SystemEvent) => Promise<void>
}

export interface Persistence {
  checkpointBlock: () => Promise<number>
  updateCheckpointBlock: (block: number) => Promise<void>
}

export interface ManagerReport {
  fromBlock?: number
  toBlock?: number
  status: "success" | "failure"
  errors: string[]
}

export class Manager {
  private monitors: Monitor[]
  private receivers: Receiver[]
  private persistence: Persistence

  constructor(monitors: Monitor[], receivers: Receiver[], persistence: Persistence) {
    this.monitors = monitors
    this.receivers = receivers
    this.persistence = persistence
  }

  async trigger(): Promise<ManagerReport> {
    try {
      const checkpointBlock = await this.persistence.checkpointBlock()
      const latestBlock = await contracts.latestBlock()

      const validCheckpoint = checkpointBlock > 0 && checkpointBlock < latestBlock

      const fromBlock = validCheckpoint ? checkpointBlock : latestBlock
      const toBlock = latestBlock

      const errors = await this.check(fromBlock, toBlock)

      if (errors.length === 0) {
        try {
          await this.persistence.updateCheckpointBlock(latestBlock)
        } catch (error) {
          errors.push(`failed checkpoint block update: ${error}`)
        }
      }

      return {
        fromBlock,
        toBlock,
        status: errors.length === 0 ? "success" : "failure",
        errors,
      }
    } catch (error) {
      return {
        status: "failure",
        errors: [`${error}`]
      }
    }
  }

  async check(fromBlock: number, toBlock: number): Promise<string[]> {
    const systemEvents: SystemEvent[] = []
    const errors: string[] = []

    const checks = await Promise.allSettled(
      this.monitors.map(monitor => monitor.check(fromBlock, toBlock))
    )
    checks.forEach((result) => {
      switch (result.status) {
        case "fulfilled": {
          systemEvents.push(...result.value)
          break
        }
        case "rejected":{
          errors.push(`failed monitor check: ${result.reason}`)
          break
        }
      }
    })

    const dispatches = await Promise.allSettled(
      this.receivers.flatMap(
        receiver => systemEvents.map(
          systemEvent => receiver.receive(systemEvent)
        )
      )
    )
    dispatches.forEach((result) => {
      if (result.status === "rejected") {
        errors.push(`failed system event dispatch: ${result.reason}`)
      }
    })

    return errors
  }
}