export enum Severity {
  Minor = "minor",
  Major = "major",
  Critical = "critical",
}

export interface Incident {
  title: string
  severity: Severity
  data: Record<string, string>
}

export interface Monitor {
  check: (fromBlock: number, toBlock: number) => Promise<Incident[]>
}

export interface Receiver {
  receive: (incidents: Incident[]) => Promise<void>
}

export interface ManagerReport {
  status: "success" | "error"
  errors: string[]
}

export class Manager {
  private monitors: Monitor[]
  private receivers: Receiver[]

  constructor(monitors: Monitor[], receivers: Receiver[]) {
    this.monitors = monitors
    this.receivers = receivers
  }

  async check(): Promise<ManagerReport> {
    const fromBlock = 0 // TODO: Get latest checkpoint block from storage.
    const toBlock = 100 // TODO: Get new checkpoint block from chain.

    const incidents: Incident[] = []
    const errors: string[] = []

    const monitorsResults = await Promise.allSettled(
      this.monitors.map(monitor => monitor.check(fromBlock, toBlock))
    )

    monitorsResults.forEach((result, index) => {
      switch (result.status) {
        case "fulfilled": {
          incidents.push(...result.value)
          break
        }
        case "rejected":{
          errors.push(`monitor ${index} error: ${result.reason}`)
          break
        }
      }
    })

    const receiversResults = await Promise.allSettled(
      this.receivers.map(receiver => receiver.receive(incidents))
    )

    receiversResults.forEach((result, index) => {
      if (result.status === "rejected") {
        errors.push(`receiver ${index} error: ${result.reason}`)
      }
    })

    // TODO: Update the checkpoint block.

    return {
      status: errors.length === 0 ? "success" : "error",
      errors,
    }
  }
}