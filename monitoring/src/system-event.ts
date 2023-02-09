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
  receive: (systemEvents: SystemEvent[]) => Promise<void>
}

export interface ManagerReport {
  fromBlock: number
  toBlock: number
  status: "success" | "failure"
  errors: string[]
}

export class Manager {
  private monitors: Monitor[]
  private receivers: Receiver[]

  constructor(monitors: Monitor[], receivers: Receiver[]) {
    this.monitors = monitors
    this.receivers = receivers
  }

  async check(fromBlock: number, toBlock: number): Promise<ManagerReport> {
    const systemEvents: SystemEvent[] = []
    const errors: string[] = []

    const monitorsResults = await Promise.allSettled(
      this.monitors.map(monitor => monitor.check(fromBlock, toBlock))
    )

    monitorsResults.forEach((result, index) => {
      switch (result.status) {
        case "fulfilled": {
          systemEvents.push(...result.value)
          break
        }
        case "rejected":{
          errors.push(`monitor ${index} error: ${result.reason}`)
          break
        }
      }
    })

    const receiversResults = await Promise.allSettled(
      this.receivers.map(receiver => receiver.receive(systemEvents))
    )

    receiversResults.forEach((result, index) => {
      if (result.status === "rejected") {
        errors.push(`receiver ${index} error: ${result.reason}`)
      }
    })

    return {
      fromBlock,
      toBlock,
      status: errors.length === 0 ? "success" : "failure",
      errors,
    }
  }
}