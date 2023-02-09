import { Incident, Receiver as IncidentReceiver, Severity as IncidentSeverity } from "./incident"

export class DiscordReceiver implements IncidentReceiver {
  private incidentFilter = (incident: Incident) => {
    return incident.severity === IncidentSeverity.Minor
  }

  constructor() {
    // TODO: Initialize receiver.
  }

  async receive(incidents: Incident[]): Promise<void> {
    const results = await Promise.allSettled(
      incidents.filter(this.incidentFilter).map(this.propagate)
    )

    const errors = results
      .filter(result => result.status === "rejected")
      .map(result => `${(result as PromiseRejectedResult).reason}`)

    if (errors.length !== 0) {
      throw new Error(`Discord propagation errors: ${errors.join(",")}`)
    }
  }

  private async propagate(incident: Incident): Promise<void> {
    // TODO: Send to Discord webhook. For now just print it.
    console.log(`incident ${incident.title} (${JSON.stringify(incident.data)}) propagated to Discord`)
  }
}