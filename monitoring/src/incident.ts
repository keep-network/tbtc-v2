export enum Severity {
  Minor = "minor",
  Major = "major",
  Critical = "critical",
}

export interface Incident {
  title: string
  severity: Severity
}

export interface Monitor {
  check: (fromBlock: number, toBlock: number) => Promise<Incident[]>
}

export interface Receiver {
  receive: (incidents: Incident[]) => Promise<void>
}

export class Manager {
  private monitors: Monitor[]
  private receivers: Receiver[]

  constructor(monitors: Monitor[], receivers: Receiver[]) {
    this.monitors = monitors
    this.receivers = receivers
  }

  async check() {
    const fromBlock = 0 // TODO: Get latest checkpoint block from storage.
    const toBlock = 100 // TODO: Get new checkpoint block from chain.

    const incidents: Incident[] = []

    // TODO: Avoid await in loop.
    for (let i = 0; i < this.monitors.length; i++) {
      const result = await this.monitors[i].check(fromBlock, toBlock)
      incidents.push(...result)
    }

    // TODO: Avoid await in loop.
    for (let i = 0; i < this.receivers.length; i++) {
      await this.receivers[i].receive(incidents)
    }

    // TODO: Update the checkpoint block.
  }
}